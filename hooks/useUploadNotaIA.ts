import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { computeSha256, enhanceDocumentImage } from '../lib/utils';
import imageCompression from 'browser-image-compression';
import { AIProcessJob } from '../types';
import { LocalJob } from '../components/notas/NotasPendentesIA';

export const useUploadNotaIA = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [localJobs, setLocalJobs] = useState<LocalJob[]>([]);
    const cancelledJobsRef = useRef<Set<string>>(new Set());
    const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        const activeTimeouts = timeoutsRef.current;
        return () => {
            activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            activeTimeouts.clear();
        };
    }, []);

    const removeLocalJob = useCallback((id: string) => {
        const existingTimeout = timeoutsRef.current.get(id);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            timeoutsRef.current.delete(id);
        }
        setLocalJobs(prev => prev.filter(job => job.id !== id));
        cancelledJobsRef.current.add(id);
    }, []);

    const scheduleJobRemoval = useCallback((id: string, delayMs = 15000) => {
        const timeoutId = setTimeout(() => {
            timeoutsRef.current.delete(id);
            removeLocalJob(id);
        }, delayMs);
        timeoutsRef.current.set(id, timeoutId);
    }, [removeLocalJob]);

    const updateLocalJob = useCallback((id: string, updates: Partial<LocalJob>) => {
        setLocalJobs(prev => prev.map(job => job.id === id ? { ...job, ...updates } : job));
    }, []);

    const processFile = async (file: File) => {
        if (!user || !profile?.company_id) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Sessão inválida ou empresa não configurada.' });
            return;
        }

        const tempId = `temp_${Date.now()}`;
        const newLocalJob: LocalJob = {
            id: tempId,
            user_id: user.id,
            file_hash: '',
            storage_path: file.name, // Temporary display name
            status: 'processing', // Use processing so it shows the spinner
            customText: 'Etapa 1: Preparando arquivo...',
            result_json: null,
            error_message: null,
            retry_count: 0,
            processing_started_at: new Date().toISOString(),
            processing_completed_at: null,
            created_at: new Date().toISOString(),
        };

        setLocalJobs(prev => [newLocalJob, ...prev]);

        try {
            let fileToProcess = file;

            if (file.type.startsWith('image/')) {
                try {
                    const initialOptions = { maxSizeMB: 5, maxWidthOrHeight: 2048, useWebWorker: true, fileType: 'image/jpeg' };
                    let processedFile = await imageCompression(file, initialOptions);
                    if (cancelledJobsRef.current.has(tempId)) return;
                    processedFile = await enhanceDocumentImage(processedFile);
                    if (cancelledJobsRef.current.has(tempId)) return;
                    const finalOptions = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true, fileType: 'image/jpeg' };
                    fileToProcess = await imageCompression(processedFile, finalOptions);
                } catch (compressionError) {
                    console.error("Erro ao processar imagem:", compressionError);
                }
            }

            if (cancelledJobsRef.current.has(tempId)) return;
            updateLocalJob(tempId, { customText: 'Etapa 2: Analisando documento...' });

            const fileAsBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(fileToProcess);
            });

            if (cancelledJobsRef.current.has(tempId)) return;

            const { data, error } = await supabase.functions.invoke('executar-processamento-ia', {
                body: { fileBase64: fileAsBase64, fileType: fileToProcess.type }
            });

            if (cancelledJobsRef.current.has(tempId)) return;

            if (error) {
                let errorMessage = error.message;
                const errObj = error as any;
                if (errObj.context && typeof errObj.context.json === 'function') {
                    try {
                        const responseClone = errObj.context.clone();
                        const errorData = await responseClone.json();
                        if (errorData && errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        console.error("Erro ao fazer parse do erro da Edge Function:", e);
                    }
                }
                if (errorMessage === 'Edge Function returned a non-2xx status code') {
                    errorMessage = 'O documento não é uma nota válida ou ocorreu um erro no servidor.';
                }
                throw new Error(errorMessage);
            }

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.status === 'duplicate') {
                updateLocalJob(tempId, { status: 'failed', customText: 'Nota Duplicada (Descartada)', error_message: 'Esta nota fiscal já existe no sistema e foi descartada.' });
                toast({ title: "Nota Duplicada", description: "Esta nota fiscal já existe no sistema e foi descartada.", variant: 'default', duration: 15000 });
                scheduleJobRemoval(tempId, 15000);
                return;
            }

            if (data.status === 'ok') {
                updateLocalJob(tempId, { customText: 'Etapa 3: Enviando para processamento...' });
                
                const fileHash = await computeSha256(fileToProcess);
                const filePath = `${profile.company_id}/${user.id}/${fileHash}.${fileToProcess.name.split('.').pop()}`;
                
                const { error: uploadError } = await supabase.storage.from('jpl-conecta').upload(filePath, fileToProcess, { upsert: true });
                if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

                if (cancelledJobsRef.current.has(tempId)) return;

                const { error: insertError } = await supabase
                    .from('ai_process_jobs')
                    .insert({
                        user_id: user.id,
                        file_hash: fileHash,
                        storage_path: filePath,
                    })
                    .select()
                    .single();

                if (insertError) throw new Error(`Erro ao criar job: ${insertError.message}`);
                
                // Success! Remove local job and invalidate queries so the real job shows up
                removeLocalJob(tempId);
                queryClient.invalidateQueries({ queryKey: ['active_ai_jobs', user?.id] });
            } else {
                throw new Error('Resposta inesperada da função de verificação.');
            }

        } catch (err: any) {
            if (cancelledJobsRef.current.has(tempId)) return;
            updateLocalJob(tempId, { status: 'failed', customText: 'Falha na Verificação', error_message: err.message });
            toast({ variant: 'destructive', title: 'Falha na Verificação', description: err.message, duration: 15000 });
            scheduleJobRemoval(tempId, 15000);
        }
    };

    return {
        localJobs,
        processFile,
        removeLocalJob
    };
};
