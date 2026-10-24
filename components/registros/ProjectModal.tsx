import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Project, PROJECT_STATUSES, ProjectStatus } from '../../types';
import { projectSchema, ProjectFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { useAuth } from '../../hooks/useAuth';
import { SearchIcon, BuildingIcon, MapPinIcon, CalendarIcon, ChevronDownIcon, ChevronUpIcon } from '../../lib/icons';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  displayMode?: 'dialog' | 'drawer';
}

const customResolver = createZodResolver(projectSchema);

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, project, displayMode = 'drawer' }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!project;
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

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
    formState: { errors, isSubmitted, touchedFields, isDirty } 
  } = useForm<ProjectFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues
  });

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      if (isEditMode && (defaultValues.address_zip || defaultValues.address_street)) {
        setShowAddress(true);
      } else {
        setShowAddress(false);
      }
    }
  }, [isOpen, project, reset, defaultValues, isEditMode]);

  const startDate = watch('start_date');
  const endDate = watch('end_date');
  
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
      toast({ title: "Sucesso!", description: `Obra ${isEditMode ? 'atualizada' : 'cadastrada'} com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro ao Salvar Obra', description: errorMessage });
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

        setValue('address_street', data.logradouro, { shouldDirty: true, shouldValidate: true });
        setValue('address_district', data.bairro, { shouldDirty: true, shouldValidate: true });
        setValue('address_city', data.localidade, { shouldDirty: true, shouldValidate: true });
        setValue('address_state', data.uf, { shouldDirty: true, shouldValidate: true });
        
        setFocus('address_number');
      } catch (error) {
        toast({ variant: "destructive", title: "Erro na busca", description: "Não foi possível buscar o CEP automaticamente." });
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const cepRegister = register('address_zip');

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode={displayMode}>
      <ResponsiveModalContent size="md" className="max-w-xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
              <BuildingIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Editar Obra / Projeto' : 'Nova Obra / Projeto'}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Defina identificação, responsável técnico, cronograma e localização física.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            <input type="hidden" {...register('status')} />

            {/* Bloco 1: Dados Gerais da Obra */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <BuildingIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  1. Identificação da Construção
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Nome da Obra / Empreendimento <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    {...register('name')} 
                    placeholder="Ex: Residencial Flores do Campo" 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 font-medium" 
                  />
                  {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Mestre de Obra / Engenheiro Responsável
                  </Label>
                  <Input 
                    {...register('manager')} 
                    placeholder="Nome do encarregado ou mestre" 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Cronograma */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <CalendarIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  2. Cronograma de Execução
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Data de Início da Obra <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    type="date" 
                    {...register('start_date')} 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                  {errors.start_date && <p className="text-[11px] text-red-500">{errors.start_date.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Previsão de Entrega / Término
                  </Label>
                  <Input 
                    type="date" 
                    {...register('end_date')} 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                </div>
              </div>
            </div>
            
            {/* Bloco 3: Endereço do Canteiro */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="h-4 w-4 text-brand-blue-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    3. Localização Física & Endereço
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddress(!showAddress)}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
                >
                  {showAddress ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                  {showAddress ? 'Recolher' : 'Expandir Endereço'}
                </button>
              </div>

              {showAddress && (
                <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">CEP</Label>
                        {isLoadingCep && <span className="text-[10px] text-brand-blue-600 animate-pulse">Buscando...</span>}
                      </div>
                      <Input 
                        {...cepRegister}
                        placeholder="00000-000" 
                        maxLength={9} 
                        onBlur={(e) => {
                          cepRegister.onBlur(e);
                          handleCepBlur(e);
                        }}
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 font-mono"
                      />
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cidade</Label>
                      <Input 
                        {...register('address_city')} 
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3 space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Rua / Logradouro</Label>
                      <Input 
                        {...register('address_street')} 
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                    </div>
                    <div className="col-span-1 space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Número</Label>
                      <Input 
                        {...register('address_number')} 
                        placeholder="S/N" 
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Bairro</Label>
                      <Input 
                        {...register('address_district')} 
                        className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Estado (UF)</Label>
                      <Input 
                        {...register('address_state')} 
                        maxLength={2} 
                        className="h-9 text-xs uppercase bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer Fixo */}
          <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-end border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={mutation.isPending} 
              className="text-xs h-9 px-4 font-semibold"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              form="project-form" 
              disabled={!isDirty && isEditMode}
              isLoading={mutation.isPending} 
              loadingText="Salvando..." 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
            >
              {isEditMode ? 'Salvar Alterações' : 'Cadastrar Obra'}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ProjectModal;
