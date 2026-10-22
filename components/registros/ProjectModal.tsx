import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { supabase } from '../../lib/supabaseClient';
import { Project, PROJECT_STATUSES, ProjectStatus } from '../../types';
import { projectSchema, ProjectFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { useAuth } from '../../hooks/useAuth';
import { SearchIcon, BuildingIcon, ChevronDownIcon, ChevronUpIcon } from '../../lib/icons';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
}

const customResolver = createZodResolver(projectSchema);

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, project }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!project;
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  // Memoize default values to ensure stability
  const defaultValues: ProjectFormValues = useMemo(() => {
      if (project) {
          return {
            name: project.name || '',
            status: project.status || 'Planejamento',
            manager: project.manager || '',
            start_date: project.start_date ? project.start_date.split('T')[0] : '',
            end_date: project.end_date ? project.end_date.split('T')[0] : null,
            address_zip: project.address_zip || '',
            address_street: project.address_street || '',
            address_number: project.address_number || '',
            address_district: project.address_district || '',
            address_city: project.address_city || '',
            address_state: project.address_state || '',
          };
      }
      return {
          name: '',
          status: 'Planejamento',
          manager: '',
          start_date: '',
          end_date: null,
          address_zip: '',
          address_street: '',
          address_number: '',
          address_district: '',
          address_city: '',
          address_state: '',
      };
  }, [project]);

  const { 
      register, 
      handleSubmit, 
      reset, 
      watch, 
      setValue, 
      setFocus, 
      formState: { errors, isSubmitted, touchedFields } 
  } = useForm<ProjectFormValues>({
    resolver: customResolver,
    mode: 'onBlur', // Validate on blur for better UX
    defaultValues
  });

  // Reset form when modal opens or project changes
  useEffect(() => {
    if (isOpen) {
        reset(defaultValues);
        // Auto-expand address if editing and has address data
        if (isEditMode && (defaultValues.address_zip || defaultValues.address_street)) {
            setShowAddress(true);
        } else {
            setShowAddress(false);
        }
    }
  }, [isOpen, project, reset, defaultValues, isEditMode]);

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  
  // Status calculation logic
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : null;

    let newStatus: ProjectStatus = 'Planejamento';

    if (end && end < today) {
        newStatus = 'Concluído';
    } else if (start && start <= today) {
        newStatus = 'Em Andamento';
    }
    
    // Only update if value is different to avoid infinite loops, check actual form value not just calculated
    const currentStatus = watch('status');
    if (currentStatus !== newStatus) {
        setValue('status', newStatus, { shouldDirty: true });
    }
  }, [startDate, endDate, setValue, watch]);

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      if (!profile?.company_id || !user?.id) throw new Error("Usuário ou empresa não autenticado.");
      const payload = { ...data, start_date: data.start_date || null, end_date: data.end_date || null };
      
      const { error } = isEditMode
        ? await supabase.from('projects').update(payload).eq('id', project.id)
        : await supabase.from('projects').insert({
            ...payload,
            company_id: profile.company_id,
            created_by: user.id
        });
      if (error) throw error;
      
      await logAuditAction(
          profile?.company_id,
          user?.email,
          isEditMode ? 'EDITAR' : 'CRIAR',
          `Obra: ${payload.name}`,
          { isEditMode, status: payload.status }
      );
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: `Obra ${isEditMode ? 'atualizada' : 'criada'} com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
    }
  });

  const onSubmit = (data: ProjectFormValues) => mutation.mutate(data);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
      const cepValue = e.target.value.replace(/\D/g, '');
      
      if (cepValue.length === 8) {
          setIsLoadingCep(true);
          try {
              const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
              const data = await response.json();
              
              if (data.erro) {
                  toast({ variant: "destructive", title: "CEP não encontrado", description: "Verifique o número e tente novamente." });
                  return;
              }

              // Preenche os campos automaticamente
              setValue('address_street', data.logradouro, { shouldDirty: true, shouldValidate: true });
              setValue('address_district', data.bairro, { shouldDirty: true, shouldValidate: true });
              setValue('address_city', data.localidade, { shouldDirty: true, shouldValidate: true });
              setValue('address_state', data.uf, { shouldDirty: true, shouldValidate: true });
              
              // Foca no número para o usuário completar
              setFocus('address_number');

          } catch (error) {
              console.error(error);
              toast({ variant: "destructive", title: "Erro na busca", description: "Não foi possível buscar o CEP automaticamente." });
          } finally {
              setIsLoadingCep(false);
          }
      }
  };

  const shouldShowError = (fieldName: keyof ProjectFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  // Helper to merge refs/handlers for the CEP input
  const cepRegister = register('address_zip');

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
      <ResponsiveModalContent className="max-w-3xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
            <BuildingIcon className="h-4 w-4 text-blue-500" />
            {isEditMode ? 'Editar Obra/Projeto' : 'Nova Obra/Projeto'}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
            Preencha os dados básicos da obra.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50">
          <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Status Field is hidden but maintained for logic */}
            <input type="hidden" {...register('status')} />

            <InputGroup label="Nome da Obra *" error={shouldShowError('name') ? errors.name?.message as string : undefined}>
                <Input {...register('name')} placeholder="Ex: Residencial Flores" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
            </InputGroup>
            
            <InputGroup label="Mestre de Obra" error={shouldShowError('manager') ? errors.manager?.message as string : undefined}>
                <Input {...register('manager')} placeholder="Nome do encarregado" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
            </InputGroup>

            <div className="grid grid-cols-2 gap-3">
               <InputGroup label="Data de Início *" error={shouldShowError('start_date') ? errors.start_date?.message as string : undefined}>
                   <Input type="date" {...register('start_date')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
               </InputGroup>
               <InputGroup label="Previsão de Término" error={shouldShowError('end_date') ? errors.end_date?.message as string : undefined}>
                  <Input type="date" {...register('end_date')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
            </div>
            
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAddress(!showAddress)}
                className="flex items-center gap-2 text-xs font-medium text-brand-blue-600 dark:text-brand-blue-400 hover:text-brand-blue-700 dark:hover:text-brand-blue-300 transition-colors"
              >
                {showAddress ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                {showAddress ? 'Ocultar endereço' : 'Adicionar endereço da obra'}
              </button>
            </div>

            {showAddress && (
              <div className="p-4 bg-brand-dark-900/50 border border-gray-800/50 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">Endereço</h3>
                  {isLoadingCep && <span className="text-[10px] font-normal text-brand-blue-600 dark:text-brand-blue-400 animate-pulse flex items-center gap-1"><SearchIcon className="h-3 w-3"/> Buscando CEP...</span>}
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                        <InputGroup label="CEP" error={shouldShowError('address_zip') ? errors.address_zip?.message as string : undefined}>
                            <Input 
                                {...cepRegister}
                                placeholder="00000-000" 
                                maxLength={9} 
                                onBlur={(e) => {
                                    cepRegister.onBlur(e);
                                    handleCepBlur(e);
                                }}
                                className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500"
                            />
                        </InputGroup>
                    </div>
                    <div className="col-span-2">
                         <InputGroup label="Cidade" error={shouldShowError('address_city') ? errors.address_city?.message as string : undefined}>
                             <Input {...register('address_city')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                         </InputGroup>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3">
                        <InputGroup label="Rua / Logradouro" error={shouldShowError('address_street') ? errors.address_street?.message as string : undefined}>
                            <Input {...register('address_street')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                        </InputGroup>
                    </div>
                    <div className="col-span-1">
                        <InputGroup label="Número" error={shouldShowError('address_number') ? errors.address_number?.message as string : undefined}>
                            <Input {...register('address_number')} placeholder="S/N" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                        </InputGroup>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <InputGroup label="Bairro" error={shouldShowError('address_district') ? errors.address_district?.message as string : undefined}>
                        <Input {...register('address_district')} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                    </InputGroup>
                    <InputGroup label="Estado (UF)" error={shouldShowError('address_state') ? errors.address_state?.message as string : undefined}>
                        <Input {...register('address_state')} maxLength={2} className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
                    </InputGroup>
                </div>
              </div>
            )}
          </form>
        </div>

        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending} className="text-sm h-9">Cancelar</Button>
          <Button type="submit" form="project-form" isLoading={mutation.isPending} loadingText="Salvando..." className="text-sm h-9 px-6">
            {isEditMode ? 'Salvar Alterações' : 'Salvar Obra'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const InputGroup: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={`text-xs font-medium text-gray-500 dark:text-gray-400 ${error ? "text-red-500" : ""}`}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-[10px] text-red-500 mt-1 font-medium animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
);

export default ProjectModal;