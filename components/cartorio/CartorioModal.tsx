import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import { z } from 'zod';
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle, 
  ResponsiveModalDescription, 
  ResponsiveModalFooter 
} from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { 
  FileTextIcon, 
  BuildingIcon, 
  PaperclipIcon, 
  ConstructionIcon, 
  CalendarIcon, 
  DollarSignIcon, 
  UploadIcon, 
  XIcon, 
  EditIcon,
  CheckCircle2Icon
} from '../../lib/icons';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { createZodResolver } from '../../lib/validators';
import { CartorioRecord } from '../../types';
import { openStorageFile, formatCurrency } from '../../lib/utils';

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

const CARTORIO_QUICK_PRESETS = [
  'Matrícula Atualizada do Imóvel',
  'Escritura Pública de Compra e Venda',
  'Certidão Negativa de Ônus Reais',
  'Guia de ITBI e Comprovante',
  'Averbação de Construção / Obra',
  'Certidão de Habite-se',
  'Certidão Vintenária',
  'Emolumentos de Registro de Imóveis',
];

const CartorioModal: React.FC<CartorioModalProps> = ({ isOpen, onClose, record }) => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Fetch Projects
  const { data: projectsData } = useQuery({
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

  const parseCurrency = (val: string) => {
    const numeric = val.replace(/\D/g, '');
    return Number(numeric) / 100;
  };

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<CartorioFormValues>({
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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseCurrency(e.target.value);
    setValue('amount', val, { shouldValidate: true, shouldDirty: true });
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
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.\-]/g, '_')
        .toLowerCase();
    };

    const fileName = `${Date.now()}_${sanitizeFileName(fileToUpload.name)}`;
    const path = `${profile?.company_id}/${fileName}`;
    
    const { error } = await supabase.storage.from('cartorio_docs').upload(path, fileToUpload);
    
    if (error) {
      console.error("Storage error:", error);
      if (error.message.includes('bucket not found')) {
        toast({ title: "Aviso", description: "Bucket 'cartorio_docs' não encontrado no Supabase.", variant: "default" });
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

  const handleApplyPreset = (preset: string) => {
    setValue('description', preset, { shouldValidate: true, shouldDirty: true });
  };

  const setDateShortcut = (daysAgo: number) => {
    const targetDate = new Date(Date.now() - (daysAgo * 86400000));
    setValue('issue_date', targetDate.toISOString().split('T')[0], { shouldValidate: true, shouldDirty: true });
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent size="xl" fullHeight className="max-w-4xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
              <BuildingIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                {record ? 'Editar Registro de Cartório / Imóvel' : 'Novo Registro de Cartório / Imóvel'}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Custas, matrículas, escrituras e certidões notariais vinculadas à obra.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            
            {/* Bloco 1: Contexto da Obra e Data */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <ConstructionIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  1. Obra e Data do Registro
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Obra / Empreendimento Vinculado <span className="text-red-500">*</span>
                  </Label>
                  <select
                    {...register('project_id')}
                    className="mt-1.5 bg-white dark:bg-brand-dark-950 border border-gray-300 dark:border-gray-800 h-9 w-full text-gray-900 dark:text-white px-3 py-1.5 rounded-lg text-xs font-medium focus:border-brand-blue-500 focus:outline-none"
                  >
                    <option value="" disabled>Selecione uma obra...</option>
                    {projectsData?.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {errors.project_id && <p className="text-red-500 text-[11px] mt-1">{String(errors.project_id.message)}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Data do Documento / Ato Notarial <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDateShortcut(0)}
                        className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800 font-medium"
                      >
                        Hoje
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setDateShortcut(1)}
                        className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800 font-medium"
                      >
                        Ontem
                      </button>
                    </div>
                  </div>
                  <Input 
                    type="date" 
                    {...register('issue_date')} 
                    className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs text-gray-900 dark:text-white" 
                  />
                  {errors.issue_date && <p className="text-red-500 text-[11px] mt-1">{String(errors.issue_date.message)}</p>}
                </div>
              </div>
            </div>

            {/* Bloco 2: Discriminação do Ato & Valor Notarial */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <FileTextIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  2. Discriminação & Emolumento
                </h3>
              </div>

              {/* Sugestões Rápidas de Documentos */}
              <div>
                <Label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                  Sugestões de Atos Comuns:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {CARTORIO_QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-brand-dark-800 hover:bg-brand-blue-500/10 hover:text-brand-blue-600 dark:hover:text-brand-blue-400 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Descrição do Documento ou Ato Notarial <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    {...register('description')} 
                    className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs text-gray-900 dark:text-white" 
                    placeholder="Ex: Matrícula Atualizada do Imóvel, Certidão Negativa..." 
                  />
                  {errors.description && <p className="text-red-500 text-[11px] mt-1">{String(errors.description.message)}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Valor das Custas / Emolumento (R$) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={amountValue ? formatCurrency(amountValue) : ''}
                    onChange={handleAmountChange}
                    className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold"
                    placeholder="R$ 0,00"
                  />
                  {errors.amount && <p className="text-red-500 text-[11px] mt-1">{String(errors.amount.message)}</p>}
                </div>
              </div>
            </div>

            {/* Bloco 3: Anexos e Comprovantes (Dual Slots Lado a Lado) */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <PaperclipIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  3. Anexos e Comprovantes Notariais
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Slot 1: Documento / Matrícula */}
                <div className="p-4 bg-gray-50/50 dark:bg-brand-dark-950/60 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Documento / Matrícula
                    </Label>
                    {record?.document_file_url && (
                      <button 
                        type="button" 
                        onClick={() => handleOpenAttachment(record.document_file_url!)}
                        className="text-[11px] text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <PaperclipIcon className="h-3 w-3" /> Ver Atual
                      </button>
                    )}
                  </div>

                  <label 
                    htmlFor="document-file-upload"
                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-800 hover:border-brand-blue-500/50 rounded-xl cursor-pointer bg-white dark:bg-brand-dark-900 transition-colors text-center px-3"
                  >
                    <FileTextIcon className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {documentFile ? (
                        <span className="font-semibold text-brand-blue-600 dark:text-brand-blue-400 truncate max-w-[180px] inline-block">
                          {documentFile.name}
                        </span>
                      ) : (
                        <span>Clique para enviar PDF ou foto</span>
                      )}
                    </p>
                    <span className="text-[10px] text-gray-400">Certidão, matrícula ou escritura</span>
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
                      <button 
                        type="button" 
                        onClick={() => setDocumentFile(null)} 
                        className="text-[11px] text-red-500 hover:underline"
                      >
                        Remover novo arquivo
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Slot 2: Comprovante / Recibo de Custas */}
                <div className="p-4 bg-gray-50/50 dark:bg-brand-dark-950/60 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Comprovante de Pagamento
                    </Label>
                    {record?.file_url && (
                      <button 
                        type="button" 
                        onClick={() => handleOpenAttachment(record.file_url!)}
                        className="text-[11px] text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <PaperclipIcon className="h-3 w-3" /> Ver Atual
                      </button>
                    )}
                  </div>

                  <label 
                    htmlFor="invoice-file-upload"
                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-800 hover:border-brand-blue-500/50 rounded-xl cursor-pointer bg-white dark:bg-brand-dark-900 transition-colors text-center px-3"
                  >
                    <DollarSignIcon className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {invoiceFile ? (
                        <span className="font-semibold text-brand-blue-600 dark:text-brand-blue-400 truncate max-w-[180px] inline-block">
                          {invoiceFile.name}
                        </span>
                      ) : (
                        <span>Clique para enviar recibo</span>
                      )}
                    </p>
                    <span className="text-[10px] text-gray-400">Recibo, DAE ou comprovante PIX</span>
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
                      <button 
                        type="button" 
                        onClick={() => setInvoiceFile(null)} 
                        className="text-[11px] text-red-500 hover:underline"
                      >
                        Remover novo arquivo
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Footer Fixo */}
          <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-end border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={mutation.isPending || isUploading} 
              className="text-xs h-9 px-4 font-semibold"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={mutation.isPending || isUploading} 
              loadingText={isUploading ? "Enviando..." : "Salvando..."} 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
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
