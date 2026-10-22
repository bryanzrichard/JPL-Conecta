import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
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
import { UsersIcon, ChevronDownIcon, ChevronUpIcon } from '../../lib/icons';

interface CollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborator?: Collaborator | null;
}

const customResolver = createZodResolver(collaboratorSchema);

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ isOpen, onClose, collaborator }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!collaborator;
  const [showDetails, setShowDetails] = useState(false);

  // Memoize default values to ensure stability
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
      formState: { errors, isSubmitted, touchedFields } 
  } = useForm<CollaboratorFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues
  });

  // Reset form when modal opens
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
      
      // Sanitize optional fields to ensure empty strings are saved as null in DB
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
      toast({ title: "Sucesso!", description: `Colaborador ${isEditMode ? 'atualizado' : 'criado'} com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      onClose();
    },
    onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
    }
  });

  const onSubmit = (data: CollaboratorFormValues) => mutation.mutate(data);

  const shouldShowError = (fieldName: keyof CollaboratorFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-2xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base text-white font-bold">
                {isEditMode ? 'Editar Colaborador' : 'Novo Colaborador'}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                Cadastre profissionais, técnicos e prestadores vinculados às obras.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-brand-dark-950/50">
          <form id="collaborator-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Nome Completo *" error={shouldShowError('name') ? errors.name?.message as string : undefined}>
                  <Input {...register('name')} placeholder="Ex: Carlos Alberto da Silva" className="h-9 text-xs bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
              
              <InputGroup label="CPF / Documento" error={shouldShowError('document') ? errors.document?.message as string : undefined}>
                  <Input {...register('document')} placeholder="000.000.000-00" className="h-9 text-xs font-mono bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputGroup label="Cargo / Função" error={shouldShowError('role') ? errors.role?.message as string : undefined}>
                  <Input {...register('role')} placeholder="Ex: Eletricista, Encanador, Pedreiro" className="h-9 text-xs bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
              <InputGroup label="Telefone / WhatsApp" error={shouldShowError('phone') ? errors.phone?.message as string : undefined}>
                  <Input {...register('phone')} placeholder="(11) 98765-4321" className="h-9 text-xs bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
            </div>
            
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-xs font-medium text-brand-blue-600 dark:text-brand-blue-400 hover:text-brand-blue-700 dark:hover:text-brand-blue-300 transition-colors"
              >
                {showDetails ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                {showDetails ? 'Ocultar detalhes' : 'Adicionar avaliação e observações'}
              </button>
            </div>

            {showDetails && (
              <div className="p-4 bg-brand-dark-900/50 border border-gray-800/50 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                <Controller
                  name="rating"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <InputGroup label="Avaliação do Colaborador">
                      <StarRating rating={value ?? 0} onRatingChange={(r) => onChange(r)} />
                    </InputGroup>
                  )}
                />
                
                <InputGroup label="Observações" error={shouldShowError('observations') ? errors.observations?.message as string : undefined}>
                    <Textarea {...register('observations')} placeholder="Informações adicionais, histórico, etc..." className="bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500 min-h-[80px] text-sm resize-none" />
                </InputGroup>
              </div>
            )}
          </form>
        </div>

        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending} className="text-sm h-9">Cancelar</Button>
          <Button 
              type="submit" 
              form="collaborator-form"
              isLoading={mutation.isPending} 
              loadingText="Salvando..."
              className="text-sm h-9 px-6"
          >
            {isEditMode ? 'Salvar Alterações' : 'Salvar Colaborador'}
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

export default CollaboratorModal;