import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
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
import { Supplier } from '../../types';
import { supplierSchema, SupplierFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { formatCnpj as formatCnpjForDisplay } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { TruckIcon, AlertTriangleIcon } from '../../lib/icons';

interface QuickSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSupplier: Supplier) => void;
  initialName: string;
  initialCnpj: string;
  displayMode?: 'dialog' | 'drawer';
}

const customResolver = createZodResolver(supplierSchema);

const QuickSupplierModal: React.FC<QuickSupplierModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialName, 
  initialCnpj,
  displayMode = 'drawer'
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const defaultValues: SupplierFormValues = useMemo(() => {
    return {
      name: initialName || '',
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
    formState: { errors } 
  } = useForm<SupplierFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues
  });

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
    }
  }, [isOpen, defaultValues, reset]);

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      if (!profile?.company_id || !user?.id) throw new Error("Usuário ou empresa não autenticado.");
      
      const cnpjClean = data.cnpj.replace(/\D/g, '');

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
      toast({ title: "Sucesso!", description: `Fornecedor "${newSupplier.name}" cadastrado com sucesso.` });
      onSuccess(newSupplier);
      onClose();
    },
    onError: (err) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: errorMessage });
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
    
    setValue('cnpj', value, { shouldValidate: false, shouldDirty: true });
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode={displayMode}>
      <ResponsiveModalContent size="md" className="max-w-xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                Cadastro Rápido de Fornecedor
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Complete a razão social e CNPJ para vincular à nota fiscal.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form id="quick-supplier-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Razão Social / Nome <span className="text-red-500">*</span>
              </Label>
              <Input 
                {...register('name')} 
                placeholder="Nome do Fornecedor" 
                className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
              />
              {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                CNPJ <span className="text-red-500">*</span>
              </Label>
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
                    className="h-9 text-xs font-mono bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800"
                  />
                )}
              />
              {errors.cnpj && <p className="text-[11px] text-red-500">{errors.cnpj.message}</p>}
            </div>
          </div>

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
              isLoading={mutation.isPending} 
              loadingText="Salvando..." 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
            >
              Salvar Fornecedor
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default QuickSupplierModal;
