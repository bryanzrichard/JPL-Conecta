import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import { z } from 'zod';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { FileTextIcon, BuildingIcon, PaperclipIcon } from '../../lib/icons';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { createZodResolver } from '../../lib/validators';
import { CartorioRecord } from '../../types';
import { openStorageFile } from '../../lib/utils';

// Form Validation Schema
const cartorioSchema = z.object({
  description: z.string().min(3, 'Descrição precisa ter no mínimo 3 caracteres.'),
  amount: z.number().min(0.01, 'O valor é obrigatório e deve ser maior que zero.'),
  issue_date: z.string().min(1, 'A data é obrigatória.'),
  project_id: z.string().min(1, 'A obra é obrigatória.'),
});

type CartorioFormValues = z.infer<typeof cartorioSchema>;

export const customCartorioResolver = createZodResolver(cartorioSchema);

interface CartorioModalProps {
    isOpen: boolean;
    onClose: () => void;
    record?: CartorioRecord | null;
}

const CartorioModal: React.FC<CartorioModalProps> = ({ isOpen, onClose, record }) => {
    const { profile, user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Fetch Projects
    const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
        queryKey: ['projects', profile?.company_id],
        queryFn: async () => {
            if (!profile?.company_id) return [];
            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .eq('company_id', profile.company_id)
                .order('name');
            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.company_id && isOpen,
    });

    // Convert string to number for UI input
    const parseCurrency = (val: string) => {
        const numeric = val.replace(/\D/g, '');
        return Number(numeric) / 100;
    };

    const formatCurrencyStr = (val: number) => {
        if (isNaN(val)) return '';
        return (val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CartorioFormValues>({
        resolver: customCartorioResolver,
        mode: 'onBlur',
        defaultValues: {
            description: record?.description || '',
            amount: Number(record?.amount) || 0,
            issue_date: record?.issue_date ? record.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
            project_id: record?.project_id || '',
        }
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                description: record?.description || '',
                amount: Number(record?.amount) || 0,
                issue_date: record?.issue_date ? record.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
                project_id: record?.project_id || '',
            });
            setInvoiceFile(null);
            setDocumentFile(null);
        }
    }, [isOpen, record, reset]);

    const amountValue = watch('amount');
    const projectIdValue = watch('project_id');

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseCurrency(e.target.value);
        setValue('amount', val, { shouldValidate: true });
    };

    const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setInvoiceFile(e.target.files[0]);
        }
    };

    const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setDocumentFile(e.target.files[0]);
        }
    };

    const uploadFile = async (file: File): Promise<string | null> => {
        let fileToUpload = file;

        // Compress if it's an image
        if (file.type.startsWith('image/')) {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true
            };
            try {
                fileToUpload = await imageCompression(file, options);
            } catch (error) {
                console.error("Erro na compressão:", error);
                throw new Error("Erro ao comprimir imagem.");
            }
        }

        const sanitizeFileName = (name: string) => {
            return name
                .normalize('NFD') // Decompose accents
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-zA-Z0-9.\-]/g, '_') // Replace anything not alphanumeric, dot, or dash with underscore
                .toLowerCase();
        };

        const fileName = `${Date.now()}_${sanitizeFileName(fileToUpload.name)}`;
        const path = `${profile?.company_id}/${fileName}`;
        
        const { error } = await supabase.storage.from('cartorio_docs').upload(path, fileToUpload);
        
        if (error) {
            console.error("Storage error:", error);
            if (error.message.includes('bucket not found')) {
              toast({ title: "Aviso", description: "Bucket 'cartorio_docs' não encontrado. Crie-o como PRIVADO no Supabase.", variant: "default" });
              return null;
            }
            throw new Error(`Erro ao enviar arquivo: ${error.message}`);
        }
       
        return path;
    };

    const mutation = useMutation({
        mutationFn: async (data: CartorioFormValues) => {
            if (!profile?.company_id || !user?.id) throw new Error("Não autenticado");
            
            setIsUploading(true);
            let invoice_file_url = record?.file_url || null;
            let document_file_url = record?.document_file_url || null;

            try {
                const oldFilesToRemove: string[] = [];
                if (invoiceFile) {
                    const uploadedInvoice = await uploadFile(invoiceFile);
                    if (uploadedInvoice && record?.file_url && record.file_url !== uploadedInvoice) {
                        oldFilesToRemove.push(record.file_url);
                    }
                    invoice_file_url = uploadedInvoice;
                }
                if (documentFile) {
                    const uploadedDoc = await uploadFile(documentFile);
                    if (uploadedDoc && record?.document_file_url && record.document_file_url !== uploadedDoc) {
                        oldFilesToRemove.push(record.document_file_url);
                    }
                    document_file_url = uploadedDoc;
                }
                if (oldFilesToRemove.length > 0) {
                    await supabase.storage.from('cartorio_docs').remove(oldFilesToRemove);
                }
            } catch (err: any) {
                throw new Error(err.message);
            } finally {
                setIsUploading(false);
            }

            const payload = {
                company_id: profile.company_id,
                description: data.description,
                amount: data.amount,
                issue_date: data.issue_date || null,
                project_id: data.project_id,
                file_url: invoice_file_url,
                document_file_url,
                created_by: user.id
            };

            const dbOp = record?.id
                ? supabase.from('cartorio_records').update(payload).eq('id', record.id)
                : supabase.from('cartorio_records').insert([payload]);

            const { error } = await dbOp;
            if (error) throw error;
            
            await logAuditAction(
                profile.company_id,
                user.email,
                record?.id ? 'EDITAR' : 'CRIAR',
                `Cartório/Imóvel: ${payload.description}`,
                { 
                    isEditMode: !!record?.id,
                    amount: payload.amount,
                    project_id: payload.project_id
                }
            );
        },
        onSuccess: () => {
            toast({ title: 'Sucesso!', description: `Registro salvo com sucesso.` });
            queryClient.invalidateQueries({ queryKey: ['cartorio_records'] });
            queryClient.invalidateQueries({ queryKey: ['cartorioSummary'] });
            queryClient.invalidateQueries({ queryKey: ['cartorio_records_dashboard'] });
            setInvoiceFile(null);
            setDocumentFile(null);
            onClose();
        },
        onError: (error) => {
            toast({ title: 'Erro', description: formatApiError(error), variant: 'destructive' });
        }
    });

    const onSubmit = (data: CartorioFormValues) => {
        mutation.mutate(data);
    };

    const handleOpenAttachment = async (path: string) => {
        try {
            await openStorageFile(path);
        } catch {
            toast({ title: 'Erro ao abrir anexo', description: 'Não foi possível gerar link para o documento.', variant: 'destructive' });
        }
    };

    return (
        <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
            <ResponsiveModalContent className="max-w-3xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
                <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-400 shrink-0">
                            <BuildingIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <ResponsiveModalTitle className="text-base text-white font-bold">
                                {record ? 'Editar Registro (Cartório / Imóvel)' : 'Novo Registro de Cartório / Imóvel'}
                            </ResponsiveModalTitle>
                            <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                                Gerencie certidões, matrículas, escrituras ou custas de cartório vinculadas à obra.
                            </ResponsiveModalDescription>
                        </div>
                    </div>
                </ResponsiveModalHeader>
                
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 bg-brand-dark-950/50 space-y-5 custom-scrollbar">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs font-medium text-gray-300">Obra / Projeto Vinculado *</Label>
                                <select
                                    {...register('project_id')}
                                    className="mt-1.5 bg-brand-dark-950 border border-gray-800 h-9 w-full text-white px-3 py-1.5 rounded-lg text-xs font-medium focus:border-brand-blue-500 focus:outline-none"
                                >
                                    <option value="" disabled>Selecione uma obra</option>
                                    {projectsData?.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.project_id && <p className="text-red-400 text-xs mt-1 animate-in fade-in">{String(errors.project_id.message)}</p>}
                            </div>

                            <div>
                                <Label className="text-xs font-medium text-gray-300">Data do Documento / Registro *</Label>
                                <Input type="date" {...register('issue_date')} className="mt-1.5 bg-brand-dark-950 border-gray-800 h-9 text-xs w-full focus:border-brand-blue-500" />
                                {errors.issue_date && <p className="text-red-400 text-xs mt-1 animate-in fade-in">{String(errors.issue_date.message)}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <Label className="text-xs font-medium text-gray-300">Descrição do Documento ou Ato Notarial *</Label>
                                <Input 
                                    {...register('description')} 
                                    className="mt-1.5 bg-brand-dark-950 border-gray-800 h-9 text-xs focus:border-brand-blue-500" 
                                    placeholder="Ex: Matrícula Atualizada do Imóvel, Certidão Negativa..." 
                                />
                                {errors.description && <p className="text-red-400 text-xs mt-1 animate-in fade-in">{String(errors.description.message)}</p>}
                            </div>

                            <div>
                                <Label className="text-xs font-medium text-gray-300">Valor das Custas / Emolumento</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatCurrencyStr(amountValue)}
                                    onChange={handleAmountChange}
                                    className="mt-1.5 bg-brand-dark-950 border-gray-800 h-9 text-xs text-right w-full font-mono text-emerald-400 font-bold focus:border-brand-blue-500"
                                    placeholder="R$ 0,00"
                                />
                                {errors.amount && <p className="text-red-400 text-xs mt-1 animate-in fade-in">{String(errors.amount.message)}</p>}
                            </div>
                        </div>

                        {/* Anexos Section */}
                        <div className="pt-2">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2.5">
                                Anexos e Comprovantes
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Anexo 1: Documento */}
                                <div className="p-3.5 bg-brand-dark-900/60 border border-gray-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-medium text-gray-300">Documento / Matrícula</Label>
                                        {record?.document_file_url && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleOpenAttachment(record.document_file_url!)}
                                                className="text-[11px] text-brand-blue-400 hover:underline flex items-center gap-1"
                                            >
                                                <PaperclipIcon className="h-3 w-3" /> Ver Atual
                                            </button>
                                        )}
                                    </div>
                                    <label 
                                        htmlFor="document-file-upload"
                                        className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-800 hover:border-gray-700 rounded-lg cursor-pointer bg-brand-dark-950/60 transition-colors"
                                    >
                                        <FileTextIcon className="w-5 h-5 text-gray-500 mb-1" />
                                        <p className="text-xs text-gray-400 text-center px-2">
                                            {documentFile ? (
                                                <span className="font-semibold text-brand-blue-400 truncate max-w-[200px] inline-block">{documentFile.name}</span>
                                            ) : (
                                                <span>Clique para enviar PDF ou foto</span>
                                            )}
                                        </p>
                                        <input 
                                            id="document-file-upload"
                                            type="file"
                                            accept="image/*,application/pdf"
                                            className="hidden"
                                            onChange={handleDocumentFileChange}
                                        />
                                    </label>
                                    {documentFile && (
                                        <div className="flex justify-end">
                                            <button type="button" onClick={() => setDocumentFile(null)} className="text-[11px] text-red-400 hover:underline">
                                                Remover novo arquivo
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Anexo 2: Recibo */}
                                <div className="p-3.5 bg-brand-dark-900/60 border border-gray-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-medium text-gray-300">Comprovante / Recibo</Label>
                                        {record?.file_url && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleOpenAttachment(record.file_url!)}
                                                className="text-[11px] text-brand-blue-400 hover:underline flex items-center gap-1"
                                            >
                                                <PaperclipIcon className="h-3 w-3" /> Ver Atual
                                            </button>
                                        )}
                                    </div>
                                    <label 
                                        htmlFor="invoice-file-upload"
                                        className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-800 hover:border-gray-700 rounded-lg cursor-pointer bg-brand-dark-950/60 transition-colors"
                                    >
                                        <FileTextIcon className="w-5 h-5 text-gray-500 mb-1" />
                                        <p className="text-xs text-gray-400 text-center px-2">
                                            {invoiceFile ? (
                                                <span className="font-semibold text-brand-blue-400 truncate max-w-[200px] inline-block">{invoiceFile.name}</span>
                                            ) : (
                                                <span>Clique para enviar comprovante</span>
                                            )}
                                        </p>
                                        <input 
                                            id="invoice-file-upload"
                                            type="file"
                                            accept="image/*,application/pdf"
                                            className="hidden"
                                            onChange={handleInvoiceFileChange}
                                        />
                                    </label>
                                    {invoiceFile && (
                                        <div className="flex justify-end">
                                            <button type="button" onClick={() => setInvoiceFile(null)} className="text-[11px] text-red-400 hover:underline">
                                                Remover novo arquivo
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <ResponsiveModalFooter className="px-6 py-4 border-t border-gray-800 bg-brand-dark-900 flex justify-end gap-3">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={onClose} 
                            disabled={mutation.isPending || isUploading} 
                            className="text-xs h-9 px-4 border-gray-700 hover:bg-gray-800 text-gray-300"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            isLoading={mutation.isPending || isUploading} 
                            loadingText={isUploading ? "Enviando..." : "Salvando..."} 
                            className="text-xs h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-medium"
                        >
                            Salvar Registro
                        </Button>
                    </ResponsiveModalFooter>
                </form>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
};

export default CartorioModal;
