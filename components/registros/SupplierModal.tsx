import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { StarRating } from '../ui/StarRating';
import { supabase } from '../../lib/supabaseClient';
import { Supplier } from '../../types';
import { supplierSchema, SupplierFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { formatCnpj as formatCnpjMask } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { TruckIcon } from '../../lib/icons';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
}

const customResolver = createZodResolver(supplierSchema);

const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, supplier }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!supplier;

  const defaultValues: SupplierFormValues = useMemo(() => {
    if (supplier) {
      return {
        name: supplier.name || '',
        cnpj: formatCnpjMask(supplier.cnpj),
        seller: supplier.seller || '',
        seller_contact: supplier.seller_contact || '',
        service_rating: supplier.service_rating || 0,
        delivery_rating: supplier.delivery_rating || 0,
      };
    }
    return {
      name: '',
      cnpj: '',
      seller: '',
      seller_contact: '',
      service_rating: 0,
      delivery_rating: 0
    };
  }, [supplier]);

  const { 
    register, 
    handleSubmit, 
    control, 
    reset, 
    setValue, 
    formState: { errors, isValid, touchedFields, isSubmitted } 
  } = useForm<SupplierFormValues>({
    resolver: customResolver,
    mode: 'onBlur', // Validate on blur to reduce noise and prevent immediate errors
    defaultValues: defaultValues
  });
  
  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens, clearing errors and touched states
      reset(defaultValues);
    }
  }, [isOpen, defaultValues, reset]);

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      if (!profile?.company_id || !user?.id) throw new Error("Usuário ou empresa não autenticado.");
      
      const cnpjClean = data.cnpj.replace(/\D/g, '');
      
      if (cnpjClean) {
          const cnpjFormatted = formatCnpjMask(cnpjClean);
          let query = supabase
            .from('suppliers')
            .select('id')
            .eq('company_id', profile.company_id)
            .in('cnpj', [cnpjClean, cnpjFormatted]);
          if (isEditMode && supplier) {
              query = query.neq('id', supplier.id);
          }
          const { data: existing } = await query.limit(1).maybeSingle();
          if (existing) {
              throw new Error("Este CNPJ já está cadastrado no sistema.");
          }
      }

      const payload = { ...data, cnpj: cnpjClean || null };
      const { error } = isEditMode
        ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
        : await supabase.from('suppliers').insert({
            ...payload,
            company_id: profile.company_id,
            created_by: user.id,
        });
      if (error) throw error;

      await logAuditAction(
          profile?.company_id,
          user?.email,
          isEditMode ? 'EDITAR' : 'CRIAR',
          `Fornecedor: ${payload.name}`,
          { isEditMode, cnpj: payload.cnpj }
      );
    },
    onSuccess: () => {
      toast({ title: "Sucesso!", description: `Fornecedor ${isEditMode ? 'atualizado' : 'criado'} com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
    }
  });

  const onSubmit = (data: SupplierFormValues) => mutation.mutate(data);

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.substring(0, 14);
    
    value = value.replace(/^(\d{2})(\d)/, '$1.$2');
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
    
    // Only update value, let 'onBlur' handle validation to prevent premature error messages
    setValue('cnpj', value, { shouldValidate: false, shouldDirty: true });
  };

  const shouldShowError = (fieldName: keyof SupplierFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
      <ResponsiveModalContent className="max-w-3xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
            <TruckIcon className="h-4 w-4 text-orange-500" />
            {isEditMode ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
            Preencha os dados básicos do fornecedor.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-5 bg-brand-dark-950/50">
          <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <InputGroup label="Nome *" error={shouldShowError('name') ? errors.name?.message as string : undefined}>
                <Input {...register('name')} placeholder="Nome do Fornecedor" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
            </InputGroup>
            
            <InputGroup label="CNPJ *" error={shouldShowError('cnpj') ? errors.cnpj?.message as string : undefined}>
                <Controller
                  name="cnpj"
                  control={control}
                  render={({ field }) => (
                      <Input 
                          {...field} 
                          value={field.value ?? ''}
                          onChange={handleCNPJChange} 
                          placeholder="00.000.000/0000-00" 
                          maxLength={18}
                          onBlur={field.onBlur}
                          className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500"
                      />
                  )}
                />
            </InputGroup>
            
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Vendedor" error={shouldShowError('seller') ? errors.seller?.message as string : undefined}>
                  <Input {...register('seller')} placeholder="Nome do Vendedor" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
              
              <InputGroup label="Contato do Vendedor" error={shouldShowError('seller_contact') ? errors.seller_contact?.message as string : undefined}>
                  <Input {...register('seller_contact')} placeholder="(XX) XXXXX-XXXX" className="h-9 text-sm bg-brand-dark-950 border-gray-800 focus:border-brand-blue-500" />
              </InputGroup>
            </div>
            
            <div className="pt-2">
              <div className="p-4 bg-brand-dark-900/50 border border-gray-800/50 rounded-xl space-y-3">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Avaliação do Fornecedor</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                      name="service_rating"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                          <InputGroup label="Qualidade do Serviço">
                              <StarRating rating={value ?? 0} onRatingChange={(r) => onChange(r)} />
                          </InputGroup>
                      )}
                  />
                   <Controller
                      name="delivery_rating"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                          <InputGroup label="Pontualidade na Entrega">
                              <StarRating rating={value ?? 0} onRatingChange={(r) => onChange(r)} />
                          </InputGroup>
                      )}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending} className="text-sm h-9">Cancelar</Button>
          <Button 
              type="submit" 
              form="supplier-form"
              isLoading={mutation.isPending} 
              loadingText="Salvando..."
              className="text-sm h-9 px-6"
          >
            {isEditMode ? 'Salvar Alterações' : 'Salvar Fornecedor'}
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

export default SupplierModal;