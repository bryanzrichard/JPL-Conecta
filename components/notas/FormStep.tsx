import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { 
  ChevronsUpDownIcon, 
  AlertTriangleIcon, 
  ShieldCheckIcon, 
  ClockIcon, 
  EditIcon, 
  PackageIcon, 
  TruckIcon, 
  ConstructionIcon, 
  FileTextIcon, 
  DollarSignIcon, 
  CreditCardIcon, 
  PlusIcon, 
  Trash2Icon, 
  RefreshCwIcon 
} from '../../lib/icons';
import { Supplier, Project, PAYMENT_METHODS, CATEGORIA_NOTA_ENUM, AIProcessJob } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { manualNotaSchema, ManualNotaFormValues, createZodResolver } from '../../lib/validators';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

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

const PAYMENT_QUICK_OPTIONS = [
  { slug: 'pix', label: 'PIX', icon: '⚡' },
  { slug: 'boleto', label: 'Boleto', icon: '📄' },
  { slug: 'cartao_credito', label: 'Cartão Crédito', icon: '💳' },
  { slug: 'transferencia', label: 'Transferência', icon: '🏦' },
  { slug: 'dinheiro', label: 'Dinheiro', icon: '💵' },
];

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
  const [initialSupplierData, setInitialSupplierData] = useState<{name: string, cnpj: string} | null>(null);

  const form = useForm<ManualNotaFormValues>({
    resolver: customResolver,
    mode: 'onBlur',
    defaultValues: {
      supplier_id: '',
      project_id: '',
      invoice_number: '',
      issue_date: new Date().toISOString().split('T')[0],
      shipping_value: 0,
      total_value: 0,
      payment_method: 'pix',
      observations: '',
      items: [],
    }
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
      const parsedItems = (extractedData.items || []).map((item: any) => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        category: matchCategory(item.category),
        manufacturer: item.manufacturer || '',
        unit_of_measure: item.unit_of_measure || ''
      }));

      reset({
        invoice_number: extractedData.invoice_number || '',
        issue_date: extractedData.issue_date || new Date().toISOString().split('T')[0],
        items: parsedItems.length > 0 ? parsedItems : [{
          description: '',
          quantity: 1,
          unit_price: 0,
          category: 'Estrutura e Fundação',
          manufacturer: '',
          unit_of_measure: ''
        }],
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
            setVerificationMessage('CNPJ do fornecedor não foi extraído automaticamente. Selecione manualmente na lista.');
          }
          return;
        }

        setVerificationStatus('verifying');
        setVerificationMessage('Buscando fornecedor na base...');

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
            setVerificationMessage(`Fornecedor "${supplier.name}" identificado automaticamente pelo CNPJ.`);
          } else {
            setVerificationStatus('supplier_not_found');
            setVerificationMessage(`Fornecedor com CNPJ ${cnpjFormatted} ainda não está cadastrado.`);
            setInitialSupplierData({ name: name || 'Nome não extraído', cnpj: cnpjClean });
            setShowQuickAdd(true);
          }
        } catch (err) {
          if (isCancelled) return;
          setVerificationStatus('error');
          const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
          setVerificationMessage(`Erro na verificação: ${errorMessage}`);
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
    
    queryClient.setQueryData(['suppliers', profile?.company_id], (old: Supplier[] | undefined) => {
      if (!old) return [newSupplier];
      const updated = [...old, newSupplier];
      return updated.sort((a, b) => a.name.localeCompare(b.name));
    });

    queryClient.invalidateQueries({ queryKey: ['suppliers', profile?.company_id] });
    
    setValue('supplier_id', newSupplier.id, { shouldValidate: true });
    setVerificationStatus('verified');
    setVerificationMessage(`Novo fornecedor "${newSupplier.name}" cadastrado e selecionado.`);
  };

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedShippingValue = useWatch({ control, name: 'shipping_value' });
  const watchedPaymentMethod = useWatch({ control, name: 'payment_method' });
  
  const subTotal = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
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
      setValue('total_value', Math.max(0, newTotal), { shouldValidate: true });
    }
  }, [watchedShippingValue, setValue, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: ManualNotaFormValues) => {
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
      
      if (data.observations && data.observations.trim() !== '') {
        const { error: updateError } = await (supabase as any)
          .from('notas_fiscais')
          .update({ observations: data.observations.trim() })
          .eq('id', newInvoiceId);
        if (updateError) console.warn("Erro ao salvar observações:", updateError.message);
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
      verifying: { 
        icon: <ClockIcon className="h-5 w-5 text-brand-blue-500 animate-pulse shrink-0" />, 
        bg: 'bg-brand-blue-500/10 border-brand-blue-500/30 text-brand-blue-600 dark:text-brand-blue-300' 
      },
      verified: { 
        icon: <ShieldCheckIcon className="h-5 w-5 text-emerald-500 shrink-0" />, 
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
      },
      supplier_not_found: { 
        icon: <AlertTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />, 
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300' 
      },
      error: { 
        icon: <AlertTriangleIcon className="h-5 w-5 text-red-500 shrink-0" />, 
        bg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300' 
      },
      idle: { icon: null, bg: '' }
    };

    if (verificationStatus === 'idle') return null;

    const { icon, bg } = statusConfig[verificationStatus];

    return (
      <div className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-xs font-medium ${bg}`}>
        <div className="flex items-center gap-2.5">
          {icon}
          <span>{verificationMessage}</span>
        </div>
        {verificationStatus === 'supplier_not_found' && !showQuickAdd && (
          <Button 
            type="button" 
            size="sm"
            variant="outline" 
            className="h-7 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-semibold shrink-0" 
            onClick={() => setShowQuickAdd(true)}
          >
            Cadastrar Fornecedor
          </Button>
        )}
      </div>
    );
  };

  const setDateShortcut = (daysAgo: number) => {
    const targetDate = new Date(Date.now() - (daysAgo * 86400000));
    form.setValue('issue_date', targetDate.toISOString().split('T')[0], { shouldValidate: true });
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Conteúdo com Master Split 65% / 35% */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 space-y-4 custom-scrollbar">
          
          {/* Status Banner da IA */}
          {renderVerificationStatus()}

          <fieldset disabled={verificationStatus === 'verifying'} className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* COLUNA ESQUERDA (65%): Obra, Fornecedor, Identificação e Itens */}
              <div className="lg:col-span-8 space-y-4">
                
                {/* Bloco 1: Centro de Custo & Origem */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    <ConstructionIcon className="h-4 w-4 text-brand-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      1. Obra e Fornecedor
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Controller 
                      name="project_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label={<>Obra Vinculada <span className="text-red-500">*</span></>} 
                          options={projects.map(p => ({ value: p.id, label: p.name }))} 
                          value={field.value} 
                          onChange={field.onChange} 
                          placeholder="Selecione o projeto/obra..." 
                          error={errors.project_id?.message as string} 
                        /> 
                      )} 
                    />

                    <Controller 
                      name="supplier_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label={<>Fornecedor Emitente <span className="text-red-500">*</span></>} 
                          options={suppliers.map(s => ({ value: s.id, label: s.name }))} 
                          value={field.value} 
                          onChange={field.onChange} 
                          placeholder="Selecione o fornecedor..." 
                          error={errors.supplier_id?.message as string}
                        /> 
                      )} 
                    />
                  </div>
                </div>

                {/* Bloco 2: Identificação Fiscal & Emissão */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    <FileTextIcon className="h-4 w-4 text-brand-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      2. Identificação da Fatura
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Número da Nota / Recibo
                        </Label>
                        <button
                          type="button"
                          onClick={() => form.setValue('invoice_number', `RECIBO-${Math.floor(Date.now() / 1000)}`, { shouldValidate: true, shouldDirty: true })}
                          className="text-[11px] font-semibold text-brand-blue-600 dark:text-brand-blue-400 hover:underline flex items-center gap-1"
                        >
                          <RefreshCwIcon className="h-3 w-3" /> Gerar Recibo
                        </button>
                      </div>
                      <Input 
                        id="invoice_number" 
                        {...register('invoice_number')} 
                        placeholder="Ex: NF-e 45281 ou Recibo"
                        className="h-9 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 font-mono"
                      />
                      {errors.invoice_number && <p className="text-[11px] text-red-500 mt-1">{errors.invoice_number.message}</p>}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Data de Emissão <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setDateShortcut(0)}
                            className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800 font-medium"
                          >
                            Hoje
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setDateShortcut(1)}
                            className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-800 font-medium"
                          >
                            Ontem
                          </button>
                        </div>
                      </div>
                      <Input 
                        id="issue_date" 
                        type="date" 
                        {...register('issue_date')} 
                        className="h-9 text-sm bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800"
                      />
                      {errors.issue_date && <p className="text-[11px] text-red-500 mt-1">{errors.issue_date.message}</p>}
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Discriminação de Insumos */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    <div className="flex items-center gap-2">
                      <PackageIcon className="h-4 w-4 text-brand-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        3. Insumos Extraídos via IA
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-brand-blue-500/10 text-brand-blue-600 dark:text-brand-blue-400">
                        {fields.length} {fields.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowItemsModal(true)}
                        className="h-8 text-xs font-semibold gap-1.5 border-brand-blue-500/30 text-brand-blue-600 dark:text-brand-blue-400 hover:bg-brand-blue-500/10"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Expandir Gestor
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => append({ 
                          description: '', 
                          quantity: 1, 
                          unit_price: 0, 
                          category: 'Estrutura e Fundação',
                          manufacturer: '',
                          unit_of_measure: ''
                        })}
                        className="h-8 text-xs font-semibold gap-1"
                      >
                        <PlusIcon className="h-3.5 w-3.5" /> Adicionar Linha
                      </Button>
                    </div>
                  </div>

                  {/* Tabela Rápida Inline de Itens */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          <th className="py-2 px-2">Descrição do Material</th>
                          <th className="py-2 px-2 w-36">Categoria</th>
                          <th className="py-2 px-2 w-20 text-right">Qtd</th>
                          <th className="py-2 px-2 w-28 text-right">Unitário (R$)</th>
                          <th className="py-2 px-2 w-28 text-right">Total</th>
                          <th className="py-2 px-1 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {fields.map((field, index) => {
                          const currentQty = Number(watchedItems?.[index]?.quantity) || 0;
                          const currentPrice = Number(watchedItems?.[index]?.unit_price) || 0;
                          const lineTotal = currentQty * currentPrice;

                          return (
                            <tr key={field.id} className="hover:bg-gray-50/50 dark:hover:bg-brand-dark-800/30 transition-colors">
                              <td className="py-2 px-2">
                                <Input
                                  {...register(`items.${index}.description` as const)}
                                  placeholder="Descrição do material..."
                                  className="h-8 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  {...register(`items.${index}.category` as const)}
                                  className="w-full h-8 rounded-md border border-gray-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-2 text-[11px] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
                                >
                                  {CATEGORIA_NOTA_ENUM.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                                  className="h-8 text-xs text-right font-mono bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  {...register(`items.${index}.unit_price` as const, { valueAsNumber: true })}
                                  className="h-8 text-xs text-right font-mono bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800"
                                />
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {formatCurrency(lineTotal)}
                              </td>
                              <td className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => remove(index)}
                                  disabled={fields.length <= 1}
                                  className="p-1 rounded text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                  title="Remover item"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {errors.items && (
                    <p className="text-xs text-red-500 font-medium">
                      Verifique os itens da nota.
                    </p>
                  )}
                </div>

              </div>

              {/* COLUNA DIREITA (35% Sticky): Resumo Financeiro & Condições */}
              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-0">
                
                {/* Card de Resumo Financeiro Principal */}
                <div className="bg-white dark:bg-brand-dark-900 border-2 border-brand-blue-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <DollarSignIcon className="h-4 w-4 text-brand-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        Resumo Financeiro
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-brand-blue-600 dark:text-brand-blue-400 bg-brand-blue-500/10 px-2 py-0.5 rounded-full">
                      Validação IA
                    </span>
                  </div>

                  {/* Subtotais detalhados */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Subtotal dos Itens</span>
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-200">
                        {formatCurrency(subTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-dashed border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <TruckIcon className="h-3.5 w-3.5" />
                        <span>Frete / Transporte</span>
                      </div>
                      <div className="w-28">
                        <CurrencyInput control={control} name="shipping_value" className="h-7 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800" />
                      </div>
                    </div>
                  </div>

                  {/* TOTAL GERAL DESTACADO */}
                  <div className="pt-3 border-t-2 border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                      Valor Total da Nota (R$)
                    </span>
                    <div className="bg-gray-50 dark:bg-brand-dark-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                      <CurrencyInput 
                        control={control} 
                        name="total_value" 
                        className="h-10 text-xl sm:text-2xl font-black font-mono text-brand-blue-600 dark:text-brand-blue-400 bg-transparent border-none text-right focus:ring-0 p-0" 
                      />
                    </div>
                    {errors.total_value && (
                      <p className="text-xs text-red-500 mt-1 font-medium">{errors.total_value.message}</p>
                    )}
                  </div>
                </div>

                {/* Card Forma de Pagamento */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <CreditCardIcon className="h-4 w-4 text-brand-blue-500" />
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Forma de Pagamento
                    </Label>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_QUICK_OPTIONS.map((opt) => {
                      const isSelected = watchedPaymentMethod === opt.slug;
                      return (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => form.setValue('payment_method', opt.slug, { shouldValidate: true, shouldDirty: true })}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                            isSelected
                              ? 'bg-brand-blue-500/10 border-brand-blue-500 text-brand-blue-600 dark:text-brand-blue-400 shadow-sm'
                              : 'bg-gray-50/50 dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                          }`}
                        >
                          <span>{opt.icon}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card Observações */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    Observações Adicionais
                  </Label>
                  <Textarea 
                    {...register('observations')} 
                    placeholder="Adicione anotações sobre este documento extraído..."
                    className="bg-gray-50/50 dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 min-h-[75px] text-xs text-gray-900 dark:text-white resize-none"
                  />
                </div>

              </div>

            </div>
          </fieldset>
        </div>

        {/* Footer Fixo */}
        <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            Subtotal Itens: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(subTotal)}</span>
          </div>
          
          <div className="flex items-center gap-3 ml-auto">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={saveMutation.isPending}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              isLoading={saveMutation.isPending} 
              loadingText="Salvando..." 
              disabled={verificationStatus !== 'verified'} 
              className="h-9 px-6 text-xs font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
            >
              Confirmar e Salvar
            </Button>
          </div>
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

const Combobox: React.FC<{
  label: React.ReactNode; 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string; 
  error?: string;
}> = ({ label, options, value, onChange, placeholder, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            className={`w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 ${!value ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-xl">
          <Command onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
            <CommandInput placeholder="Buscar..." value={search} onInput={(e) => setSearch(e.currentTarget.value)} className="border-none focus:ring-0 h-9 text-xs" />
            <CommandList className="max-h-[220px] overflow-y-auto custom-scrollbar">
              <CommandEmpty className="py-3 text-center text-xs text-gray-400">Nenhum resultado encontrado.</CommandEmpty>
              {filteredOptions.map(option => (
                <CommandItem 
                  key={option.value} 
                  className="cursor-pointer aria-selected:bg-brand-blue-500/10 aria-selected:text-brand-blue-600 dark:aria-selected:text-brand-blue-400 text-xs py-2 px-3" 
                  onSelect={() => { onChange(option.value); setIsOpen(false); }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
};

const CurrencyInput: React.FC<{ control: any; name: string; className?: string; placeholder?: string }> = ({ control, name, className, placeholder }) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { onChange, value, onBlur } }) => {
      const displayValue = useMemo(() => {
        if (value === null || value === undefined || value === '') return '';
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return '';
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(numValue);
      }, [value]);

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numberValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
        onChange(numberValue);
      };

      return (
        <Input 
          type="text" 
          inputMode="decimal" 
          value={displayValue} 
          onChange={handleChange} 
          onBlur={onBlur}
          className={`text-right ${className}`} 
          placeholder={placeholder || "0,00"} 
        />
      );
    }}
  />
);

export default FormStep;
