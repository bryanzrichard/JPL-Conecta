
import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon, PackageIcon, TruckIcon, EditIcon } from '../../lib/icons';
import { Supplier, Project, PAYMENT_METHODS } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { manualNotaSchema, ManualNotaFormValues, createZodResolver } from '../../lib/validators';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { formatCurrency } from '../../lib/utils';
import { RefreshCcw } from 'lucide-react';

const ItemsManagerModal = lazy(() => import('./ItemsManagerModal'));

interface ManualNotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suppliers: Supplier[];
  projects: Project[];
}

const customResolver = createZodResolver(manualNotaSchema);

const ManualNotaModal: React.FC<ManualNotaModalProps> = ({ isOpen, onClose, onSuccess, suppliers, projects }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const form = useForm<ManualNotaFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues: {
      supplier_id: '',
      project_id: '',
      invoice_number: '',
      issue_date: new Date().toISOString().split('T')[0],
      shipping_value: 0,
      payment_method: 'pix',
      items: [{ 
          description: '', 
          quantity: 1, 
          unit_price: 0, 
          category: 'Estrutura e Fundação',
          manufacturer: '',
          unit_of_measure: ''
      }],
      observations: '',
    },
  });

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitted, touchedFields } } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = useWatch({ control, name: 'items' });
  const watchedShippingValue = useWatch({ control, name: 'shipping_value' });
  
  const { subTotal } = useMemo(() => {
    const calculatedSubTotal = (watchedItems || []).reduce((acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return acc + (quantity * unitPrice);
    }, 0);
    
    return { subTotal: calculatedSubTotal };
  }, [watchedItems]);

  const prevShippingRef = React.useRef<number | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      prevShippingRef.current = null;
      reset({
        supplier_id: '',
        project_id: '',
        invoice_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        shipping_value: 0,
        total_value: 0,
        payment_method: 'pix',
        items: [{ 
            description: '', 
            quantity: 1, 
            unit_price: 0, 
            category: 'Estrutura e Fundação',
            manufacturer: '',
            unit_of_measure: ''
        }],
        observations: '',
      });
    }
  }, [isOpen, reset]);

  useEffect(() => {
      const currentShipping = Number(watchedShippingValue) || 0;
      
      if (prevShippingRef.current === null) {
          prevShippingRef.current = currentShipping;
          return;
      }

      if (prevShippingRef.current !== currentShipping) {
          const diffShip = currentShipping - prevShippingRef.current;
          
          const currentTotal = Number(form.getValues('total_value')) || 0;
          const newTotal = currentTotal + diffShip;

          prevShippingRef.current = currentShipping;
          
          form.setValue('total_value', Math.max(0, newTotal), { shouldValidate: true });
      }
  }, [watchedShippingValue, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ManualNotaFormValues) => {
        if (!user) throw new Error("Sessão inválida. Por favor, faça login novamente.");

        // Clean and prepare items
        const itemsPayload = data.items.map(item => ({
            ...item,
            description: item.description.trim(),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total_price: parseFloat(((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)),
            manufacturer: item.manufacturer?.trim() || null,
            unit_of_measure: item.unit_of_measure?.trim() || null,
        }));
        
        const payload = {
          p_project_id: data.project_id,
          p_supplier_id: data.supplier_id,
          p_invoice_number: data.invoice_number ? data.invoice_number.trim() : '',
          p_issue_date: data.issue_date,
          p_total_value: data.total_value,
          p_shipping_value: Number(data.shipping_value) || 0,
          p_payment_method: data.payment_method,
          p_file_url: null,
          p_itens_json: itemsPayload,
        };
      
        const { data: newInvoiceId, error: rpcError } = await (supabase as any).rpc('salvar_nota_com_itens', payload);
        
        if (rpcError) throw rpcError;
        if (!newInvoiceId) throw new Error("Falha ao obter o ID da nota fiscal criada.");

        // Add observations if present
        if (data.observations && data.observations.trim() !== '') {
            const { error: updateError } = await (supabase as any)
                .from('notas_fiscais')
                .update({ observations: data.observations.trim() })
                .eq('id', newInvoiceId);
            if(updateError) console.warn("Nota salva, mas falha ao adicionar observações:", updateError.message);
        }
        
        await logAuditAction(
            profile?.company_id,
            user?.email,
            'CRIAR',
            `Nota Fiscal Manual: ${data.invoice_number}`,
            { id: newInvoiceId, amount: data.total_value }
        );
        
        return newInvoiceId;
    },
    onSuccess: () => {
        onSuccess();
        onClose();
        queryClient.invalidateQueries({ queryKey: ['notas'] });
        queryClient.invalidateQueries({ queryKey: ['notasSummary'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardItems'] });
    },
    onError: (err: unknown) => {
        const errorMessage = formatApiError(err);
        toast({ variant: 'destructive', title: 'Erro ao Salvar!', description: errorMessage });
    }
  });

  const onSubmit = (data: ManualNotaFormValues) => {
    createMutation.mutate(data);
  };

  const shouldShowError = (fieldName: keyof ManualNotaFormValues) => {
      return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-5xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-6 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-400 shrink-0">
              <PackageIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base text-white font-bold">
                Registrar Nova Nota Fiscal
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-400 mt-0.5">
                Cadastre notas fiscais e itens avulsos com conciliação automática por obra.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            {/* Conteúdo com Rolagem */}
            <div className="flex-1 overflow-y-auto p-5 bg-brand-dark-950/50 space-y-5 custom-scrollbar">
                
                {/* Seção 1: Dados Gerais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Controller 
                            name="supplier_id" 
                            control={control} 
                            render={({ field }) => ( 
                                <Combobox 
                                    label={<>Fornecedor <span className="text-red-500">*</span></>} 
                                    options={suppliers.map(s => ({ value: s.id, label: s.name }))} 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                    placeholder="Selecione o fornecedor..." 
                                    error={shouldShowError('supplier_id') ? errors.supplier_id?.message as string : undefined}
                                /> 
                            )} 
                        />
                        <Controller 
                            name="project_id" 
                            control={control} 
                            render={({ field }) => ( 
                                <Combobox 
                                    label={<>Obra <span className="text-red-500">*</span></>} 
                                    options={projects.map(p => ({ value: p.id, label: p.name }))} 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                    placeholder="Selecione a obra..." 
                                    error={shouldShowError('project_id') ? errors.project_id?.message as string : undefined} 
                                /> 
                            )} 
                        />
                    </div>
                    <div className="space-y-4">
                        <InputGroup label="Número da Nota" error={shouldShowError('invoice_number') ? errors.invoice_number?.message as string : undefined}>
                            <div className="flex gap-2">
                                <Input 
                                    {...register('invoice_number')} 
                                    placeholder="Ex: 123456"
                                    className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white flex-1"
                                />
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => form.setValue('invoice_number', `RECIBO-${Math.floor(Date.now() / 1000)}`, { shouldValidate: true })}
                                    className="h-10 w-10 bg-brand-dark-950 border-gray-700 hover:bg-brand-dark-900 shrink-0"
                                    title="Gerar número automático (Para recibos)"
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                </Button>
                            </div>
                        </InputGroup>
                        <InputGroup label="Data de Emissão *" error={shouldShowError('issue_date') ? errors.issue_date?.message as string : undefined}>
                            <Input 
                                type="date" 
                                {...register('issue_date')} 
                                className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white"
                            />
                        </InputGroup>
                    </div>
                </div>

                {/* Seção 2: Itens Summary & Manager */}
                <div className="space-y-3 border-t border-gray-800 pt-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-white uppercase tracking-wider">
                            <PackageIcon className="h-4 w-4 text-brand-blue-500"/> 
                            Itens da Nota
                        </h3>
                    </div>
                    
                    {/* Items Summary Card - Technical Look */}
                    <div className="p-4 border border-gray-800 rounded-xl bg-gray-900/40 flex flex-col sm:flex-row justify-between items-center gap-4 transition-all hover:bg-gray-900/60">
                        <div className="text-center sm:text-left space-y-1">
                            <p className="font-bold text-white text-base tracking-tight">
                                {fields.length} {fields.length === 1 ? 'item lançado' : 'itens lançados'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>Subtotal dos Itens:</span>
                                <span className="text-brand-blue-400 font-mono font-semibold">{formatCurrency(subTotal)}</span>
                            </div>
                            {errors.items && <p className="text-[10px] text-red-500 mt-1 font-medium bg-red-500/10 px-2 py-0.5 rounded w-fit">Há erros nos itens. Clique em gerenciar para corrigir.</p>}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowItemsModal(true)} className="w-full sm:w-auto border-brand-blue-500/50 text-brand-blue-400 hover:bg-brand-blue-500 hover:text-white h-9 text-xs font-semibold uppercase tracking-wide px-4">
                            <EditIcon className="w-3.5 h-3.5 mr-2"/> Gerenciar Itens
                        </Button>
                    </div>
                </div>

                {/* Toggle Optional Fields */}
                <div className="pt-2">
                    <button 
                        type="button" 
                        onClick={() => setShowOptionalFields(!showOptionalFields)}
                        className="text-xs text-brand-blue-400 font-semibold flex items-center gap-1.5 transition-colors group"
                    >
                        <span className="w-4 h-4 rounded-full border border-brand-blue-500/30 flex items-center justify-center group-hover:border-brand-blue-500 transition-colors">
                            {showOptionalFields ? '-' : '+'}
                        </span>
                        {showOptionalFields ? 'Ocultar detalhes opcionais' : 'Adicionar detalhes opcionais (Frete, Obs...)'}
                    </button>
                </div>
                
                {/* Seção 3 e 4: Opcionais (Progressive Disclosure) */}
                {showOptionalFields && (
                    <div className="space-y-4 border-t border-gray-800 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputGroup label="Forma de Pagamento">
                                <select 
                                    {...register('payment_method')} 
                                    className="w-full rounded-lg border border-gray-700 bg-brand-dark-950 p-2 text-sm text-white focus:border-brand-blue-500 focus:ring-brand-blue-500 h-10 transition-all"
                                >
                                    {Object.entries(PAYMENT_METHODS).map(([slug, name]) => (
                                        <option key={slug} value={slug}>{name}</option>
                                    ))}
                                </select>
                            </InputGroup>
                            <InputGroup label="Frete (R$)">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <TruckIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <CurrencyInput control={control} name="shipping_value" className="pl-9 h-10 text-sm" />
                                </div>
                            </InputGroup>
                        </div>
                        <InputGroup label="Observações">
                            <Textarea 
                                {...register('observations')} 
                                placeholder="Adicione anotações sobre esta nota fiscal..."
                                className="bg-brand-dark-950 border-gray-700 min-h-[80px] text-sm text-white resize-none focus:ring-brand-blue-500"
                            />
                        </InputGroup>
                    </div>
                )}

                {/* Resumo Financeiro Final */}
                <div className="p-5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2 mt-4">
                    <div className="flex justify-between text-xs uppercase tracking-widest font-medium">
                        <span className="text-gray-400">Subtotal</span>
                        <span className="text-gray-300 font-mono">{formatCurrency(subTotal)}</span>
                    </div>
                    {(Number(watchedShippingValue) > 0 || showOptionalFields) && (
                        <div className="flex justify-between text-xs uppercase tracking-widest font-medium">
                            <span className="text-gray-400">Frete</span>
                            <span className="text-gray-300 font-mono">{formatCurrency(Number(watchedShippingValue) || 0)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center border-t border-gray-800 pt-3 mt-3">
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Valor da Nota (R$)</span>
                        <div className="w-1/3">
                            <CurrencyInput control={control} name="total_value" className="h-10 text-right text-lg font-bold bg-brand-dark-950 border-gray-700" />
                            {errors.total_value && (
                                <p className="mt-1 text-xs text-red-500 text-right">{errors.total_value.message as string}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Flow - Fixed at Bottom */}
            <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending} className="text-sm h-9">
                    Cancelar
                </Button>
                <Button type="submit" isLoading={createMutation.isPending} loadingText="Salvando..." className="text-sm h-9 px-6">
                    Salvar Nota
                </Button>
            </ResponsiveModalFooter>
        </form>

      </ResponsiveModalContent>

      <Suspense fallback={<div/>}>
        {showItemsModal && (
            <ItemsManagerModal 
                isOpen={showItemsModal}
                onClose={() => setShowItemsModal(false)}
                form={form}
                fields={fields}
                append={append}
                remove={remove}
            />
        )}
      </Suspense>
    </ResponsiveModal>
  );
};

// --- Subcomponentes Reutilizáveis ---

const InputGroup: React.FC<{ label: React.ReactNode; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-400"}`}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-[10px] text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
);

const Combobox: React.FC<{label: React.ReactNode; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; placeholder: string; error?: string;}> = ({ label, options, value, onChange, placeholder, error }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    
    // Reset search when closed
    useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <InputGroup label={label} error={error}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={`w-full justify-between font-normal text-left h-9 px-3 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white ${!value && 'text-gray-400'}`}>
                        <span className="truncate">{selectedLabel}</span>
                        <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark-900">
                    <Command>
                        <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} className="border-none focus:ring-0 h-9 text-sm text-gray-900 dark:text-white" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty className="py-2 text-center text-sm">Nenhum resultado.</CommandEmpty>
                            {filteredOptions.map(option => (
                                <CommandItem 
                                    key={option.value} 
                                    className="cursor-pointer aria-selected:bg-brand-blue-500/20 text-sm py-1.5 text-gray-700 dark:text-white" 
                                    onSelect={() => { onChange(option.value); setIsOpen(false); }}
                                >
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </InputGroup>
    );
};

// Robust Currency Input Component
const CurrencyInput: React.FC<{ control: any; name: string; className?: string; placeholder?: string }> = ({ control, name, className, placeholder }) => (
    <Controller
        name={name}
        control={control}
        render={({ field: { onChange, value, onBlur } }) => {
            const displayValue = useMemo(() => {
                if (value === null || value === undefined || value === '') return '';
                // Ensure value is treated as number for formatting
                const numValue = typeof value === 'string' ? parseFloat(value) : value;
                if (isNaN(numValue)) return '';
                return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(numValue);
            }, [value]);

            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const rawValue = e.target.value.replace(/\D/g, ''); // Keep only digits
                const numberValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
                onChange(numberValue);
            };

            return (
                <div className="relative">
                    {!className?.includes('pl-') && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 sm:text-sm">R$</span>
                        </div>
                    )}
                    <Input 
                        type="text" 
                        inputMode="numeric" 
                        value={displayValue} 
                        onChange={handleChange} 
                        onBlur={onBlur}
                        className={`text-right bg-brand-dark-950 border-gray-700 text-white ${!className?.includes('pl-') ? 'pl-8' : ''} ${className}`} 
                        placeholder={placeholder || "0,00"} 
                    />
                </div>
            );
        }}
    />
);

export default ManualNotaModal;
