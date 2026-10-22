import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { supabase } from '../../lib/supabaseClient';
import { Supplier } from '../../types';
import { supplierSchema, SupplierFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { formatCnpj as formatCnpjForDisplay } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { TruckIcon } from '../../lib/icons';

interface QuickSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSupplier: Supplier) => void;
  initialName: string;
  initialCnpj: string;
}

const customResolver = createZodResolver(supplierSchema);

const QuickSupplierModal: React.FC<QuickSupplierModalProps> = ({ isOpen, onClose, onSuccess, initialName, initialCnpj }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Memoize default values to ensure stability and proper form reset
  const defaultValues: SupplierFormValues = useMemo(() => {
      return {
          name: initialName || '',
          // Ensure CNPJ is formatted correctly for the regex validation
          cnpj: formatCnpjForDisplay(initialCnpj || ''),
          service_rating: 0,
          delivery_rating: 0,
          seller: '',
          seller_contact: ''
      };
  }, [initialName, initialCnpj]);

  const { 
      register, 
      handleSubmit, 
      control,
      reset, 
      setValue,
      formState: { errors, isSubmitted, touchedFields } 
  } = useForm<SupplierFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues
  });

  // Reset form when modal opens or initial data changes
  useEffect(() => {
    if (isOpen) {
        reset(defaultValues);
    }
  }, [isOpen, defaultValues, reset]);

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      if (!profile?.company_id || !user?.id) throw new Error("Usuário ou empresa não autenticado.");
      
      const cnpjClean = data.cnpj.replace(/\D/g, '');

      // Double check for duplicate CNPJ before inserting (Server-side safety)
      if (cnpjClean) {
          const cnpjFormatted = formatCnpjForDisplay(cnpjClean);
          const { data: existing } = await supabase
            .from('suppliers')
            .select('id')
            .eq('company_id', profile.company_id)
            .in('cnpj', [cnpjClean, cnpjFormatted])
            .limit(1)
            .maybeSingle();
            
          if (existing) {
              throw new Error("Este CNPJ já está cadastrado no sistema.");
          }
      }
      
      const { data: newSupplier, error } = await (supabase as any)
        .from('suppliers')
        .insert({
            ...data,
            name: data.name.trim(),
            cnpj: cnpjClean || null,
            company_id: profile.company_id,
            created_by: user.id
        })
        .select()
        .single();
        
      if (error) throw error;
      return newSupplier as Supplier;
    },
    onSuccess: (newSupplier) => {
      toast({ title: "Sucesso!", description: `Fornecedor "${newSupplier.name}" criado com sucesso.` });
      onSuccess(newSupplier);
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
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-lg bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base text-white font-bold">
                Cadastro Rápido de Fornecedor
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                Fornecedor não localizado. Adicione os dados essenciais para prosseguir.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-brand-dark-950/50">
          <form id="quick-supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <InputGroup label="Nome / Razão Social *" error={shouldShowError('name') ? errors.name?.message as string : undefined}>
              <Input {...register('name')} placeholder="Nome do Fornecedor" className="bg-brand-dark-950 border-gray-700" />
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
                          className="bg-brand-dark-950 border-gray-700"
                          title="Verifique e corrija o CNPJ se necessário."
                      />
                  )}
              />
            </InputGroup>
          </form>
        </div>

        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-center items-center gap-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending} className="w-32">
            Cancelar
          </Button>
          <Button type="submit" form="quick-supplier-form" isLoading={mutation.isPending} loadingText="Salvando..." className="w-48">
            Salvar Fornecedor
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const InputGroup: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={error ? "text-red-500" : ""}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-xs text-red-500 mt-1 font-medium animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
);

export default QuickSupplierModal;