import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription } from '../ui/ResponsiveModal';
import UploadStep from './UploadStep';
import ProcessingStep from './ProcessingStep';
import { AIProcessJob, Supplier, Project } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { computeSha256, enhanceDocumentImage } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';

const FormStep = lazy(() => import('./FormStep'));

interface UploadNotaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    suppliers: Supplier[];
    projects: Project[];
    initialJob?: AIProcessJob | null;
    onFileSelected?: (file: File) => void;
}

type ModalStep = 'upload' | 'verifying' | 'processing' | 'form';

const UploadNotaModal: React.FC<UploadNotaModalProps> = ({ isOpen, onClose, onSuccess, suppliers, projects, initialJob, onFileSelected }) => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [step, setStep] = useState<ModalStep>('upload');
    const [job, setJob] = useState<AIProcessJob | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Effect to handle opening the modal with a pre-selected job
    useEffect(() => {
        if (initialJob) {
            setJob(initialJob);
            if (initialJob.status === 'completed') {
                setStep('form');
            } else if (initialJob.status === 'failed') {
                setError(initialJob.error_message || "Ocorreu uma falha no processamento.");
                setStep('processing'); // Show the error in the processing step
            } else {
                setStep('processing');
            }
        }
    }, [initialJob]);


    // Reset state when modal is closed
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStep('upload');
                setJob(null);
                setError(null);
            }, 300); // Delay reset to allow for closing animation
        }
    }, [isOpen]);

    // Supabase Realtime subscription
    useEffect(() => {
        if (!job || job.status === 'completed' || job.status === 'failed') {
            return;
        }

        const channel = supabase
            .channel(`ai_job_${job.id}`)
            .on<AIProcessJob>(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ai_process_jobs',
                    filter: `id=eq.${job.id}`
                },
                (payload) => {
                    const updatedJob = payload.new as AIProcessJob;
                    setJob(updatedJob); // Update local state with real-time data
                     // Invalidate query to update the list on the main page
                    queryClient.invalidateQueries({ queryKey: ['active_ai_jobs', user?.id] });
                    if (updatedJob.status === 'completed') {
                        setStep('form');
                        channel.unsubscribe();
                    } else if (updatedJob.status === 'failed') {
                        setError(updatedJob.error_message || "Ocorreu um erro desconhecido durante o processamento.");
                        channel.unsubscribe();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [job, queryClient, user?.id]);
    
    const handleUploadAndProcess = async (file: File) => {
        if (!user || !profile?.company_id) return;
        setStep('processing');
        try {
            const fileHash = await computeSha256(file);
            const filePath = `${profile.company_id}/${user.id}/${fileHash}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage.from('jpl-conecta').upload(filePath, file, { upsert: true });
            if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

            const { data: newJob, error: insertError } = await supabase
                .from('ai_process_jobs')
                .insert({
                    user_id: user.id,
                    file_hash: fileHash,
                    storage_path: filePath,
                } as any)
                .select()
                .single();

            if (insertError) throw new Error(`Erro ao criar job: ${insertError.message}`);
            
            setJob(newJob as AIProcessJob);
            queryClient.invalidateQueries({ queryKey: ['active_ai_jobs', user?.id] });
        } catch (err: any) {
             const errorMessage = err.message || 'Ocorreu uma falha inesperada.';
            setError(errorMessage);
            toast({ variant: 'destructive', title: 'Erro no Fluxo de Upload', description: errorMessage });
            setStep('upload');
        }
    };


    const handleFileVerification = async (file: File) => {
        if (!user || !profile?.company_id) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Sessão inválida ou empresa não configurada.' });
            return;
        }
    
        setStep('verifying');
        setError(null);
        
        try {
            let fileToProcess = file;

            // Comprimir a imagem se for JPG, PNG, etc.
            if (file.type.startsWith('image/')) {
                try {
                    // 1. Primeira compressão para evitar estourar a memória do Canvas em celulares
                    const initialOptions = {
                        maxSizeMB: 5, // Reduz fotos gigantes (ex: 15MB) para algo que o Canvas suporte
                        maxWidthOrHeight: 2048,
                        useWebWorker: true,
                        fileType: 'image/jpeg'
                    };
                    let processedFile = await imageCompression(file, initialOptions);

                    // 2. Aplicar filtro de "Scanner de Documento" (Contraste, P&B) para melhorar OCR
                    processedFile = await enhanceDocumentImage(processedFile);

                    // 3. Compressão final para garantir limite da Edge Function e economizar Storage
                    const finalOptions = {
                        maxSizeMB: 1.5,
                        maxWidthOrHeight: 2048,
                        useWebWorker: true,
                        fileType: 'image/jpeg'
                    };
                    fileToProcess = await imageCompression(processedFile, finalOptions);
                } catch (compressionError) {
                    console.error("Erro ao processar imagem:", compressionError);
                    // Se falhar a compressão, tenta seguir com o arquivo original
                }
            }

            // Convert file to base64 to send to the Edge Function
            const fileAsBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(fileToProcess);
            });
    
            // Securely invoke the Edge Function for verification
            const { data, error } = await supabase.functions.invoke('executar-processamento-ia', {
                body: { fileBase64: fileAsBase64, fileType: fileToProcess.type }
            });
    
            if (error) {
                let errorMessage = error.message;
                const errObj = error as any;
                
                // Tenta extrair a mensagem de erro real da resposta da Edge Function
                if (errObj.context && typeof errObj.context.json === 'function') {
                    try {
                        // Clona a resposta para evitar erro de body já lido, caso o supabase-js mude no futuro
                        const responseClone = errObj.context.clone();
                        const errorData = await responseClone.json();
                        if (errorData && errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        console.error("Erro ao fazer parse do erro da Edge Function:", e);
                    }
                }
                
                // Fallback amigável caso ainda seja a mensagem genérica
                if (errorMessage === 'Edge Function returned a non-2xx status code') {
                    errorMessage = 'O documento não é uma nota válida ou ocorreu um erro no servidor.';
                }
                
                throw new Error(errorMessage);
            }
    
            if (data.error) {
                // Handle application-level errors returned by the function logic
                throw new Error(data.error);
            }
    
            if (data.status === 'duplicate') {
                toast({ title: "Nota Duplicada", description: "Esta nota fiscal já existe no sistema e foi descartada.", variant: 'default', duration: 5000 });
                setStep('upload');
                return;
            }
            
            // If verification is successful, proceed to upload and create the processing job
            if (data.status === 'ok') {
                await handleUploadAndProcess(fileToProcess);
            } else {
                throw new Error('Resposta inesperada da função de verificação.');
            }
    
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Falha na Verificação', description: err.message, duration: 6000 });
            setStep('upload');
            setError(null);
        }
    };

    const renderStep = () => {
        switch(step) {
            case 'upload':
                return <UploadStep onFileSelect={(file) => {
                    if (onFileSelected) {
                        onFileSelected(file);
                        onClose();
                    } else {
                        handleFileVerification(file);
                    }
                }} />;
            case 'verifying':
                return <ProcessingStep job={null} error={null} onRetry={() => {}} verificationMode />;
            case 'processing':
                return <ProcessingStep job={job} error={error} onRetry={() => setStep('upload')} />;
            case 'form':
                return (
                    <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-400">Carregando formulário...</div>}>
                        <FormStep
                          job={job}
                          onSuccess={onSuccess}
                          onClose={onClose}
                          suppliers={suppliers}
                          projects={projects}
                        />
                    </Suspense>
                );
            default:
                return null;
        }
    };
    
    const getTitle = () => {
        switch(step) {
            case 'upload': return "Registrar Nota com IA";
            case 'verifying': return "Analisando Documento";
            case 'processing': return "Processando Nota Fiscal";
            case 'form': return "Revise e Salve sua Nota";
        }
    }
    
    const getDescription = () => {
        switch(step) {
            case 'upload': return "Envie um arquivo (PDF ou imagem) para extração automática.";
            case 'verifying': return "Verificando se o documento é válido e se já existe no sistema.";
            case 'processing': return "Aguarde enquanto nossa IA analisa o documento.";
            case 'form': return "Corrija os campos se necessário e salve a nota fiscal.";
        }
    }

    return (
        <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
            <ResponsiveModalContent className="w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[950px] xl:max-w-[1150px] h-[90vh] bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col">
                <ResponsiveModalHeader className="px-5 py-3 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
                    <ResponsiveModalTitle className="text-lg">{getTitle()}</ResponsiveModalTitle>
                    <ResponsiveModalDescription className="text-xs">{getDescription()}</ResponsiveModalDescription>
                </ResponsiveModalHeader>
                <div className="flex-grow overflow-hidden flex flex-col relative">
                    {renderStep()}
                </div>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
};

export default UploadNotaModal;