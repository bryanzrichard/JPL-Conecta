import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle, 
  ResponsiveModalDescription, 
  ResponsiveModalFooter,
  ModalDisplayMode
} from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { StarRating } from '../ui/StarRating';
import { supabase } from '../../lib/supabaseClient';
import { Collaborator } from '../../types';
import { collaboratorSchema, CollaboratorFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { useAuth } from '../../hooks/useAuth';
import { UsersIcon, PhoneIcon, StarIcon, EditIcon, BriefcaseIcon } from '../../lib/icons';

interface CollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborator?: Collaborator | null;
  displayMode?: ModalDisplayMode;
}

const customResolver = createZodResolver(collaboratorSchema);

const COLLABORATOR_ROLES_PRESETS = [
  'Pedreiro',
  'Eletricista',
  'Encanador / Bombeiro',
  'Pintor',
  'Gesseiro',
  'Carpinteiro',
  'Serralheiro',
  'Mestre de Obras',
  'Ajudante Geral',
];

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ isOpen, onClose, collaborator, displayMode = 'drawer' }: CollaboratorModalProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!collaborator;
  const [showDetails, setShowDetails] = useState(false);

  const defaultValues: CollaboratorFormValues = useMemo(() => {
    if (collaborator) {
      return {
        name: collaborator.name || '',
        role: collaborator.role || '',
        phone: collaborator.phone || '',
        document: collaborator.document || '',
        rating: collaborator.rating || 0,
        observations: collaborator.observations || '',
      };
    }
    return { 
      name: '', 
      role: '', 
      phone: '', 
      document: '', 
      rating: 0, 
      observations: '' 
    };
  }, [collaborator]);

  const { 
    register, 
    handleSubmit, 
    reset, 
    control, 
    setValue,
    watch,
    formState: { errors, touchedFields, isSubmitted, isDirty } 
  } = useForm<CollaboratorFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues
  });

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      if (isEditMode && (defaultValues.observations || defaultValues.rating > 0)) {
        setShowDetails(true);
      } else {
        setShowDetails(false);
      }
    }
  }, [isOpen, reset, defaultValues, isEditMode]);

  const mutation = useMutation({
    mutationFn: async (data: CollaboratorFormValues) => {
      if (!profile?.company_id || !user?.id) throw new Error("Usuário ou empresa não autenticado.");
      
      const payload = { 
        ...data, 
        role: data.role?.trim() || null,
        phone: data.phone?.trim() || null,
        observations: data.observations?.trim() || null,
        document: data.document?.replace(/\D/g, '') || null 
      };
      
      const { error } = isEditMode
        ? await supabase.from('collaborators').update(payload).eq('id', collaborator.id)
        : await supabase.from('collaborators').insert({
            ...payload,
            company_id: profile.company_id,
            created_by: user.id
          });
      if (error) throw error;

      await logAuditAction(
        profile?.company_id,
        user?.email,
        isEditMode ? 'EDITAR' : 'CRIAR',
        `Colaborador: ${payload.name}`,
        { isEditMode, role: payload.role }
      );
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: `Colaborador ${isEditMode ? 'atualizado' : 'cadastrado'} com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      onClose();
    },
    onError: (err) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro ao Salvar Colaborador', description: errorMessage });
    }
  });

  const onSubmit = (data: CollaboratorFormValues) => mutation.mutate(data);

  const handleRolePreset = (role: string) => {
    setValue('role', role, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode={displayMode}>
      <ResponsiveModalContent size="md" className="max-w-xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Editar Colaborador' : 'Novo Colaborador / Prestador'}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Cadastre profissionais de equipe, mestres e prestadores de serviço para as obras.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form id="collaborator-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            
            {/* Bloco 1: Identificação Profissional */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <BriefcaseIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  1. Identificação & Função
                </h3>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Nome Completo <span className="text-red-500">*</span>
                </Label>
                <Input 
                  {...register('name')} 
                  placeholder="Ex: Carlos Alberto da Silva" 
                  className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 font-medium" 
                />
                {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
              </div>

              {/* Sugestões de Função */}
              <div>
                <Label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                  Funções Comuns:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {COLLABORATOR_ROLES_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleRolePreset(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-brand-dark-800 hover:bg-brand-blue-500/10 hover:text-brand-blue-600 dark:hover:text-brand-blue-400 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Cargo / Função Técnica
                  </Label>
                  <Input 
                    {...register('role')} 
                    placeholder="Ex: Encanador Industrial" 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    CPF / Documento
                  </Label>
                  <Input 
                    {...register('document')} 
                    placeholder="000.000.000-00" 
                    className="h-9 text-xs font-mono bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Contato */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <PhoneIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  2. Contato Direto
                </h3>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Telefone / WhatsApp
                </Label>
                <Input 
                  {...register('phone')} 
                  placeholder="(11) 98765-4321" 
                  className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                />
              </div>
            </div>
            
            {/* Bloco 3: Avaliação & Observações */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <StarIcon className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  3. Avaliação Técnica & Desempenho
                </h3>
              </div>

              <Controller
                name="rating"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className="space-y-1.5 p-3 rounded-xl bg-gray-50/50 dark:bg-brand-dark-950 border border-gray-200 dark:border-gray-800">
                    <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Classificação / Avaliação Geral
                    </Label>
                    <div className="pt-1">
                      <StarRating rating={value ?? 0} onRatingChange={(r) => onChange(r)} />
                    </div>
                  </div>
                )}
              />
              
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Observações e Histórico na Empresa
                </Label>
                <Textarea 
                  {...register('observations')} 
                  placeholder="Informações adicionais, histórico em obras anteriores, certificações..." 
                  className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-xs min-h-[75px] resize-none" 
                />
              </div>
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
              form="collaborator-form"
              disabled={!isDirty && isEditMode}
              isLoading={mutation.isPending} 
              loadingText="Salvando..." 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
            >
              {isEditMode ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default CollaboratorModal;
