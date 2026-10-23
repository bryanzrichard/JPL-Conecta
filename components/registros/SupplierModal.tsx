import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { StarRating } from '../ui/StarRating';
import { supabase } from '../../lib/supabaseClient';
import { Supplier } from '../../types';
import { supplierSchema, SupplierFormValues, createZodResolver } from '../../lib/validators';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { formatCnpj as formatCnpjMask } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { TruckIcon, BuildingIcon, PhoneIcon, StarIcon, EditIcon } from '../../lib/icons';

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
    formState: { errors, touchedFields, isSubmitted, isDirty } 
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
      toast({ title: "Sucesso!", description: `Fornecedor ${isEditMode ? 'atualizado' : 'cadastrado'} com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: (err) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro ao Salvar Fornecedor', description: errorMessage });
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
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent size="md" className="max-w-2xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                {isEditMode ? 'Editar Fornecedor' : 'Novo Fornecedor / Fabricante'}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Cadastre informações fiscais, contatos de vendas e avaliação de entrega.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
            
            {/* Bloco 1: Identificação Fiscal */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <BuildingIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  1. Dados Cadastrais & CNPJ
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Razão Social / Nome Fantasia <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    {...register('name')} 
                    placeholder="Ex: Votorantim Cimentos S/A" 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 font-medium" 
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
            </div>
            
            {/* Bloco 2: Contato Comercial */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <PhoneIcon className="h-4 w-4 text-brand-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  2. Atendimento Comercial
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Vendedor / Representante
                  </Label>
                  <Input 
                    {...register('seller')} 
                    placeholder="Nome do contato comercial" 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Telefone / WhatsApp Comercial
                  </Label>
                  <Input 
                    {...register('seller_contact')} 
                    placeholder="(11) 99999-9999" 
                    className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" 
                  />
                </div>
              </div>
            </div>
            
            {/* Bloco 3: Desempenho e Avaliação */}
            <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <StarIcon className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  3. Avaliação Técnica & Pontualidade
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="service_rating"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <div className="space-y-1.5 p-3 rounded-xl bg-gray-50/50 dark:bg-brand-dark-950 border border-gray-200 dark:border-gray-800">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Qualidade do Atendimento / Material
                      </Label>
                      <div className="pt-1">
                        <StarRating rating={value ?? 0} onRatingChange={(r) => onChange(r)} />
                      </div>
                    </div>
                  )}
                />

                <Controller
                  name="delivery_rating"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <div className="space-y-1.5 p-3 rounded-xl bg-gray-50/50 dark:bg-brand-dark-950 border border-gray-200 dark:border-gray-800">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Pontualidade nas Entregas na Obra
                      </Label>
                      <div className="pt-1">
                        <StarRating rating={value ?? 0} onRatingChange={(r) => onChange(r)} />
                      </div>
                    </div>
                  )}
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
              form="supplier-form"
              disabled={!isDirty && isEditMode}
              isLoading={mutation.isPending} 
              loadingText="Salvando..." 
              className="text-xs h-9 px-6 font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
            >
              {isEditMode ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default SupplierModal;
