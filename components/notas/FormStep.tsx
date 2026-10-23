import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon, AlertTriangleIcon, ShieldCheckIcon, ClockIcon, EditIcon, PackageIcon } from '../../lib/icons';
import { Supplier, Project, PAYMENT_METHODS, CATEGORIA_NOTA_ENUM, AIProcessJob } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { manualNotaSchema, ManualNotaFormValues, createZodResolver } from '../../lib/validators';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { RefreshCcw } from 'lucide-react';

const QuickSupplierModal = lazy(() => import('./QuickSupplierModal'));
const ItemsManagerModal = lazy(() => import('./ItemsManagerModal'));

interface FormStepProps {
  job: AIProcessJob | null;
  onSuccess: () => void;
  onClose: () => void;
  suppliers: Supplier[];
  projects: Project[];
}

const customResolver = createZodResolver(manualNotaSchema);

const FormStep: React.FC<FormStepProps> = ({ job, onSuccess, onClose, suppliers, projects }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const extractedData = job?.result_json as any;
  
  type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'supplier_not_found' | 'error';
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [initialSupplierData, setInitialSupplierData] = useState<{name: string, cnpj: string} | null>(null);

  const form = useForm<ManualNotaFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
  });

  const { 
      register, 
      control, 
      handleSubmit, 
      reset, 
      setValue, 
      formState: { errors, isSubmitted, touchedFields } 
  } = form;

  useEffect(() => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const matchCategory = (cat: string): typeof CATEGORIA_NOTA_ENUM[number] => {
        if (!cat) return 'Estrutura e Fundação';
        if ((CATEGORIA_NOTA_ENUM as readonly string[]).includes(cat)) {
            return cat as typeof CATEGORIA_NOTA_ENUM[number];
        }
        const normalizedCat = normalize(cat);
        const found = CATEGORIA_NOTA_ENUM.find(c => normalize(c) === normalizedCat);
        if (found) return found;
        return 'Estrutura e Fundação';
    };
    
    if (extractedData) {
        reset({
            invoice_number: extractedData.invoice_number || '',
            issue_date: extractedData.issue_date || new Date().toISOString().split('T')[0],
            items: (extractedData.items || []).map((item: any) => ({
                description: item.description || '',
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                category: matchCategory(item.category),
                manufacturer: item.manufacturer || '',
                unit_of_measure: item.unit_of_measure || ''
            })),
            supplier_id: '', 
            project_id: '',
            shipping_value: extractedData.shipping_value || 0,
            total_value: extractedData.total_value || 0,
            payment_method: extractedData.payment_method || 'pix', 
            observations: '',
        });
        
        let isCancelled = false;

        const verifySupplier = async () => {
            const rawCnpj = extractedData.fornecedor_cnpj || '';
            const cnpjClean = rawCnpj.replace(/\D/g, '');
            const cnpjFormatted = cnpjClean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            const name = extractedData.fornecedor_nome;

            if (!cnpjClean || !profile?.company_id) {
                if (!isCancelled) {
                    setVerificationStatus('error');
                    setVerificationMessage('CNPJ do fornecedor não foi extraído. Por favor, selecione manualmente.');
                }
                return;
            }

            setVerificationStatus('verifying');
            setVerificationMessage('Verificando fornecedor...');

            try {
                const { data: supplier, error: supplierError } = await (supabase as any)
                    .from('suppliers')
                    .select('id, name')
                    .eq('company_id', profile.company_id)
                    .in('cnpj', [cnpjClean, cnpjFormatted])
                    .limit(1)
                    .maybeSingle();

                if (supplierError) throw supplierError;
                if (isCancelled) return;

                if (supplier) {
                    setValue('supplier_id', supplier.id, { shouldValidate: true });
                    setVerificationStatus('verified');
                    setVerificationMessage(`Fornecedor "${supplier.name}" encontrado e selecionado.`);
                } else {
                    setVerificationStatus('supplier_not_found');
                    setVerificationMessage(`Fornecedor com CNPJ ${cnpjFormatted} não encontrado.`);
                    setInitialSupplierData({ name: name || 'Nome não extraído', cnpj: cnpjClean });
                    setShowQuickAdd(true);
                }
            } catch (err) {
                if (isCancelled) return;
                setVerificationStatus('error');
                const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
                setVerificationMessage(`Erro na verificação: ${errorMessage}`);
                console.error(err);
            }
        };

        verifySupplier();
        return () => {
            isCancelled = true;
        };
    }
  }, [extractedData, profile?.company_id, reset, setValue]);
  
  const handleQuickSupplierSave = (newSupplier: Supplier) => {
    setShowQuickAdd(false);
    
    // Synchronously update the cache to ensure the UI reflects the new supplier immediately
    queryClient.setQueryData(['suppliers', profile?.company_id], (old: Supplier[] | undefined) => {
        if (!old) return [newSupplier];
        const updated = [...old, newSupplier];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Also invalidate to ensure consistency with the server
    queryClient.invalidateQueries({ queryKey: ['suppliers', profile?.company_id] });
    
    setValue('supplier_id', newSupplier.id, { shouldValidate: true });
    setVerificationStatus('verified');
    setVerificationMessage(`Novo fornecedor "${newSupplier.name}" cadastrado e selecionado.`);
};

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedShippingValue = useWatch({ control, name: 'shipping_value' });
  
  const { subTotal } = useMemo(() => {
    const calculatedSubTotal = (watchedItems || []).reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
    return { subTotal: calculatedSubTotal };
  }, [watchedItems]);

  const prevShippingRef = React.useRef<number | null>(null);

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
          
          // Using Math.max(0, ...) to prevent negative totals
          setValue('total_value', Math.max(0, newTotal), { shouldValidate: true });
      }
  }, [watchedShippingValue, setValue, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: ManualNotaFormValues) => {
        // Sanitize item data
        const itemsPayload = data.items.map(item => ({
            ...item,
            description: item.description.trim(),
            manufacturer: item.manufacturer?.trim() || null,
            unit_of_measure: item.unit_of_measure?.trim() || null,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total_price: parseFloat(((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)),
        }));
        
        const payload = {
          p_project_id: data.project_id,
          p_supplier_id: data.supplier_id,
          p_invoice_number: data.invoice_number ? data.invoice_number.trim() : '',
          p_issue_date: data.issue_date,
          p_total_value: data.total_value,
          p_shipping_value: Number(data.shipping_value) || 0,
          p_payment_method: data.payment_method,
          p_file_url: job?.storage_path || null,
          p_itens_json: itemsPayload,
        };
      
        const { data: newInvoiceId, error: rpcError } = await (supabase as any).rpc('salvar_nota_com_itens', payload);
        if (rpcError) throw rpcError;
        if (!newInvoiceId) throw new Error("Falha ao criar a nota fiscal.");
        
        // Save observations if present
        if (data.observations && data.observations.trim() !== '') {
             const { error: updateError } = await (supabase as any)
                .from('notas_fiscais')
                .update({ observations: data.observations.trim() })
                .eq('id', newInvoiceId);
             if(updateError) console.warn("Erro ao salvar observações:", updateError.message);
        }
        
        const { data: { user } } = await supabase.auth.getUser();

        await logAuditAction(
            profile?.company_id,
            user?.email,
            'CRIAR',
            `Nota Fiscal AI: ${data.invoice_number}`,
            { id: newInvoiceId, amount: data.total_value }
        );

        return newInvoiceId;
    },
    onSuccess: async () => {
        if (job?.id) {
          const { error: updateError } = await (supabase as any)
            .from('ai_process_jobs')
            .update({ status: 'archived' })
            .eq('id', job.id);

          if (updateError) {
            console.warn(`Failed to archive AI job ${job.id}:`, updateError.message);
          }
        }
        onSuccess();
    },
    onError: (err: unknown) => {
        const errorMessage = formatApiError(err);
        toast({ variant: 'destructive', title: 'Erro ao Salvar!', description: errorMessage });
    }
  });


  const onSubmit = (data: ManualNotaFormValues) => {
    saveMutation.mutate(data);
  };
  
    const renderVerificationStatus = () => {
        const statusConfig = {
            verifying: { icon: <ClockIcon className="h-5 w-5 text-blue-400 animate-pulse" />, color: 'bg-blue-900/40 border-blue-500/30' },
            verified: { icon: <ShieldCheckIcon className="h-5 w-5 text-green-400" />, color: 'bg-green-900/40 border-green-500/30' },
            supplier_not_found: { icon: <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />, color: 'bg-yellow-900/40 border-yellow-500/30' },
            error: { icon: <AlertTriangleIcon className="h-5 w-5 text-red-400" />, color: 'bg-red-900/40 border-red-500/30' },
            idle: { icon: null, color: '' }
        };

        if (verificationStatus === 'idle') return null;

        const { icon, color } = statusConfig[verificationStatus];

        return (
            <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${color}`}>
                {icon}
                <div className="flex-grow">
                    <p className="text-white font-medium">{verificationMessage}</p>
                    {verificationStatus === 'supplier_not_found' && !showQuickAdd && (
                        <Button type="button" variant="link" className="p-0 h-auto text-yellow-400" onClick={() => setShowQuickAdd(true)}>
                            Cadastrar Fornecedor
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    const shouldShowError = (fieldName: keyof ManualNotaFormValues) => {
        return isSubmitted || !!(touchedFields as any)[fieldName];
    };

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full w-full overflow-hidden">
        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 bg-brand-dark-950/50 space-y-5 custom-scrollbar">
            <div className="space-y-4">
                {renderVerificationStatus()}

                <fieldset disabled={verificationStatus === 'verifying'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Controller name="supplier_id" control={control} render={({ field }) => ( <Combobox label={<>Fornecedor <span className="text-red-500">*</span></>} options={suppliers.map(s => ({ value: s.id, label: s.name }))} value={field.value} onChange={field.onChange} placeholder="Selecione o fornecedor..." error={shouldShowError('supplier_id') ? errors.supplier_id?.message as string : undefined}/> )} />
                            <Controller name="project_id" control={control} render={({ field }) => ( <Combobox label={<>Obra <span className="text-red-500">*</span></>} options={projects.map(p => ({ value: p.id, label: p.name }))} value={field.value} onChange={field.onChange} placeholder="Selecione a obra..." error={shouldShowError('project_id') ? errors.project_id?.message as string : undefined} /> )} />
                        </div>
                        <div className="space-y-4">
                            <InputGroup label="Número da Nota" error={shouldShowError('invoice_number') ? errors.invoice_number?.message as string : undefined}>
                                <div className="flex gap-2">
                                    <Input id="invoice_number" {...register('invoice_number')} placeholder="Ex: 123456" className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white flex-1" />
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
                                <Input id="issue_date" type="date" {...register('issue_date')} className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white" />
                            </InputGroup>
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-6 mt-6">
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
                                    <span className="text-brand-blue-600 dark:text-brand-blue-400 font-mono font-semibold">{formatCurrency(subTotal)}</span>
                                </div>
                                {errors.items && <p className="text-[10px] text-red-500 mt-1 font-medium bg-red-500/10 px-2 py-0.5 rounded w-fit">Há erros nos itens. Clique em gerenciar para corrigir.</p>}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => setShowItemsModal(true)} className="w-full sm:w-auto border-brand-blue-500/50 text-brand-blue-500 hover:bg-brand-blue-500 hover:text-white h-9 text-xs font-semibold uppercase tracking-wide px-4">
                                <EditIcon className="w-3.5 h-3.5 mr-2"/> Gerenciar Itens
                            </Button>
                        </div>
                    </div>
                    
                    {/* Toggle Optional Fields */}
                    <div className="pt-2 mt-4">
                        <button 
                            type="button" 
                            onClick={() => setShowOptionalFields(!showOptionalFields)}
                            className="text-xs text-brand-blue-600 dark:text-brand-blue-400 font-semibold flex items-center gap-1.5 transition-colors group"
                        >
                            <span className="w-4 h-4 rounded-full border border-brand-blue-500/30 flex items-center justify-center group-hover:border-brand-blue-500 transition-colors">
                                {showOptionalFields ? '-' : '+'}
                            </span>
                            {showOptionalFields ? 'Ocultar detalhes opcionais' : 'Adicionar detalhes opcionais (Frete, Obs...)'}
                        </button>
                    </div>

                    {showOptionalFields && (
                        <div className="space-y-4 border-t border-gray-800 pt-6 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputGroup label="Forma de Pagamento">
                                    <select {...register('payment_method')} className="w-full rounded-lg border border-gray-700 bg-brand-dark-950 p-2 text-sm text-white focus:border-brand-blue-500 focus:ring-brand-blue-500 h-10 transition-all">
                                        {Object.entries(PAYMENT_METHODS).map(([slug, name]) => (
                                            <option key={slug} value={slug}>{name}</option>
                                        ))}
                                    </select>
                                </InputGroup>
                                <InputGroup label="Frete (R$)">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-400 sm:text-sm">R$</span>
                                        </div>
                                        <CurrencyInput control={control} name="shipping_value" className="pl-9 h-10 text-sm" />
                                    </div>
                                </InputGroup>
                            </div>

                            <InputGroup label="Observações">
                                <Textarea id="observations" {...register('observations')} placeholder="Adicione anotações sobre esta nota fiscal..." className="bg-brand-dark-950 border-gray-700 min-h-[80px] text-sm text-white resize-none focus:ring-brand-blue-500"/>
                            </InputGroup>
                        </div>
                    )}

                    {/* Resumo Financeiro Final */}
                    <div className="p-5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2 mt-6">
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
                </fieldset>
            </div>
            
            {Object.keys(errors).length > 0 && isSubmitted && (
                <div className="text-sm text-red-500 text-left p-3 bg-red-500/10 rounded-md animate-in fade-in slide-in-from-top-2">
                    Existem campos obrigatórios não preenchidos ou com erro. Verifique os dados.
                </div>
            )}
        </div>

        {/* Footer Fixo */}
        <ResponsiveModalFooter className="shrink-0 p-4 border-t border-gray-800 bg-brand-dark-900 flex justify-end items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending} className="text-sm h-9">
                Cancelar
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending} loadingText="Salvando..." className="text-sm h-9 px-6" disabled={verificationStatus !== 'verified'}>
                Salvar Nota
            </Button>
        </ResponsiveModalFooter>
    </form>
    
    <Suspense fallback={<div/>}>
        {showQuickAdd && initialSupplierData && (
            <QuickSupplierModal 
                isOpen={showQuickAdd}
                onClose={() => setShowQuickAdd(false)}
                onSuccess={handleQuickSupplierSave}
                initialName={initialSupplierData.name}
                initialCnpj={initialSupplierData.cnpj}
            />
        )}
        
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
    </>
  );
};

// Reusable components
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
                    <Command onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                        }
                    }}>
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

const InputGroup: React.FC<{ label: React.ReactNode; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-400"}`}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-[10px] text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
);

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

export default FormStep;