import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
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
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { 
  ChevronsUpDownIcon, 
  PackageIcon, 
  TruckIcon, 
  EditIcon, 
  PlusIcon, 
  Trash2Icon, 
  BuildingIcon, 
  ConstructionIcon, 
  CalendarIcon, 
  CreditCardIcon, 
  DollarSignIcon,
  RefreshCwIcon,
  FileTextIcon
} from '../../lib/icons';
import { Supplier, Project, PAYMENT_METHODS, CATEGORIA_NOTA_ENUM } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { manualNotaSchema, ManualNotaFormValues, createZodResolver } from '../../lib/validators';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { logAuditAction } from '../../lib/auditLogger';
import { formatCurrency } from '../../lib/utils';

const ItemsManagerModal = lazy(() => import('./ItemsManagerModal'));

interface ManualNotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const ManualNotaModal: React.FC<ManualNotaModalProps> = ({ isOpen, onClose, onSuccess, suppliers, projects }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showItemsModal, setShowItemsModal] = useState(false);

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
  const watchedPaymentMethod = useWatch({ control, name: 'payment_method' });
  const watchedIssueDate = useWatch({ control, name: 'issue_date' });

  const subTotal = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return acc + (quantity * unitPrice);
    }, 0);
  }, [watchedItems]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
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

  // Sincroniza automaticamente o total_value se o usuário não tiver travado manualmente
  useEffect(() => {
    const calculatedTotal = subTotal + (Number(watchedShippingValue) || 0);
    if (!touchedFields.total_value) {
      form.setValue('total_value', calculatedTotal, { shouldValidate: true });
    }
  }, [subTotal, watchedShippingValue, form, touchedFields.total_value]);

  const createMutation = useMutation({
    mutationFn: async (data: ManualNotaFormValues) => {
      if (!user) throw new Error("Sessão inválida. Por favor, faça login novamente.");

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

      if (data.observations && data.observations.trim() !== '') {
        const { error: updateError } = await (supabase as any)
          .from('notas_fiscais')
          .update({ observations: data.observations.trim() })
          .eq('id', newInvoiceId);
        if (updateError) console.warn("Nota salva, mas falha ao adicionar observações:", updateError.message);
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
      toast({ title: 'Nota registrada com sucesso!', description: 'Os custos foram conciliados à obra.' });
    },
    onError: (err: unknown) => {
      const errorMessage = formatApiError(err);
      toast({ variant: 'destructive', title: 'Erro ao Salvar Nota', description: errorMessage });
    }
  });

  const onSubmit = (data: ManualNotaFormValues) => {
    createMutation.mutate(data);
  };

  const shouldShowError = (fieldName: keyof ManualNotaFormValues) => {
    return isSubmitted || !!(touchedFields as any)[fieldName];
  };

  const setDateShortcut = (daysAgo: number) => {
    const targetDate = new Date(Date.now() - (daysAgo * 86400000));
    form.setValue('issue_date', targetDate.toISOString().split('T')[0], { shouldValidate: true });
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="drawer">
      <ResponsiveModalContent size="xl" fullHeight className="max-w-4xl flex flex-col">
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
              <FileTextIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                Registrar Despesa / Nota Fiscal
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Vincule notas fiscais, recibos e discriminação de materiais por obra e centro de custo.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        {/* Formulário com Master Split Layout (65% / 35%) */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/60 dark:bg-brand-dark-950/50 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* ============================================================== */}
              {/* COLUNA ESQUERDA (65%): Obra, Fornecedor e Itens da Nota       */}
              {/* ============================================================== */}
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
                          placeholder="Selecione a obra..." 
                          error={shouldShowError('project_id') ? errors.project_id?.message as string : undefined} 
                          icon={<ConstructionIcon className="h-3.5 w-3.5 text-gray-400" />}
                        /> 
                      )} 
                    />

                    <Controller 
                      name="supplier_id" 
                      control={control} 
                      render={({ field }) => ( 
                        <Combobox 
                          label={<>Fornecedor / Emitente <span className="text-red-500">*</span></>}
                          options={suppliers.map(s => ({ value: s.id, label: s.name }))} 
                          value={field.value} 
                          onChange={field.onChange} 
                          placeholder="Selecione o fornecedor..." 
                          error={shouldShowError('supplier_id') ? errors.supplier_id?.message as string : undefined}
                          icon={<BuildingIcon className="h-3.5 w-3.5 text-gray-400" />}
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
                      2. Identificação da Nota / Recibo
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Número da Nota */}
                    <div className="sm:col-span-6">
                      <InputGroup label="Número do Documento / NF-e" error={shouldShowError('invoice_number') ? errors.invoice_number?.message as string : undefined}>
                        <div className="flex gap-2">
                          <Input 
                            {...register('invoice_number')} 
                            placeholder="Ex: 004.892"
                            className="h-9 text-sm font-mono flex-1"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={() => form.setValue('invoice_number', `RECIBO-${Math.floor(Date.now() / 1000)}`, { shouldValidate: true })}
                            className="h-9 w-9 shrink-0 text-gray-500 hover:text-brand-blue-500"
                            title="Gerar código para recibo sem número oficial"
                          >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </InputGroup>
                    </div>

                    {/* Data de Emissão com Atalhos */}
                    <div className="sm:col-span-6">
                      <InputGroup label="Data de Emissão *" error={shouldShowError('issue_date') ? errors.issue_date?.message as string : undefined}>
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Input 
                              type="date" 
                              {...register('issue_date')} 
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-gray-400">Atalhos:</span>
                            <button
                              type="button"
                              onClick={() => setDateShortcut(0)}
                              className={`px-2 py-0.5 rounded border transition-colors ${
                                watchedIssueDate === new Date().toISOString().split('T')[0]
                                  ? 'bg-brand-blue-50 dark:bg-brand-blue-950/40 border-brand-blue-300 text-brand-blue-600 dark:text-brand-blue-400 font-bold'
                                  : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              Hoje
                            </button>
                            <button
                              type="button"
                              onClick={() => setDateShortcut(1)}
                              className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              Ontem
                            </button>
                          </div>
                        </div>
                      </InputGroup>
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Discriminação de Insumos e Materiais (Grid Integrado!) */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    <div className="flex items-center gap-2">
                      <PackageIcon className="h-4 w-4 text-brand-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        3. Itens e Discriminação de Materiais
                      </h3>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-blue-50 dark:bg-brand-blue-950/40 text-brand-blue-600 dark:text-brand-blue-400 border border-brand-blue-200 dark:border-brand-blue-800">
                        {fields.length} {fields.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowItemsModal(true)}
                        className="text-xs h-8 px-2.5 text-gray-600 dark:text-gray-300 gap-1.5 hidden sm:flex"
                        title="Abrir em tela cheia para notas com muitos itens"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        <span>Gerenciador Completo</span>
                      </Button>
                    </div>
                  </div>

                  {/* Grid de Itens Direto na Tela */}
                  <div className="space-y-3">
                    {fields.map((field, index) => {
                      const itemErrors = errors.items?.[index];
                      const currentItemQty = Number(watchedItems?.[index]?.quantity) || 0;
                      const currentItemPrice = Number(watchedItems?.[index]?.unit_price) || 0;
                      const currentItemTotal = currentItemQty * currentItemPrice;

                      return (
                        <div 
                          key={field.id} 
                          className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-brand-dark-950/60 space-y-3 relative group transition-all hover:border-brand-blue-500/40"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-brand-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span>Insumo</span>
                            </span>

                            {fields.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => remove(index)}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                                title="Remover este item"
                              >
                                <Trash2Icon className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-6">
                              <Input 
                                {...register(`items.${index}.description`)} 
                                placeholder="Descrição do item (ex: Cimento CP-II 50kg)..." 
                                className="h-9 text-xs"
                              />
                              {itemErrors?.description && (
                                <p className="text-[10px] text-red-500 mt-1">{itemErrors.description.message}</p>
                              )}
                            </div>

                            <div className="sm:col-span-6">
                              <select 
                                {...register(`items.${index}.category`)} 
                                className="w-full h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark-950 px-2.5 text-xs text-gray-900 dark:text-white focus:border-brand-blue-500 focus:outline-none"
                              >
                                {CATEGORIA_NOTA_ENUM.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            <div className="sm:col-span-3">
                              <Input 
                                type="text" 
                                inputMode="decimal"
                                {...register(`items.${index}.quantity`)} 
                                placeholder="Qtd" 
                                className="h-9 text-xs text-right font-mono"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <Input 
                                {...register(`items.${index}.unit_of_measure`)} 
                                placeholder="Un (ex: sc, m³)" 
                                className="h-9 text-xs text-center"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <ManagedCurrencyInput 
                                control={control} 
                                name={`items.${index}.unit_price`} 
                                placeholder="Vlr. Unit." 
                              />
                            </div>

                            <div className="sm:col-span-3 flex items-center justify-end px-2">
                              <div className="text-right">
                                <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Total</span>
                                <span className="text-xs font-mono font-bold text-brand-blue-600 dark:text-brand-blue-400">
                                  {formatCurrency(currentItemTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => append({ 
                        description: '', 
                        quantity: 1, 
                        unit_price: 0, 
                        category: 'Estrutura e Fundação', 
                        manufacturer: '', 
                        unit_of_measure: '' 
                      })}
                      className="w-full h-9 border-dashed border-gray-300 dark:border-gray-700 hover:border-brand-blue-500 text-xs font-medium text-brand-blue-600 dark:text-brand-blue-400 gap-1.5"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Adicionar Outro Item</span>
                    </Button>
                  </div>
                </div>

              </div>

              {/* ============================================================== */}
              {/* COLUNA DIREITA (35%): Painel Financeiro e Condições            */}
              {/* ============================================================== */}
              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-0">
                
                {/* Card Financeiro Consolidado */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    <DollarSignIcon className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Total Financeiro
                    </h3>
                  </div>

                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-4 text-center">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                      Valor Final da Nota
                    </span>
                    <div className="mt-1">
                      <CurrencyInput 
                        control={control} 
                        name="total_value" 
                        className="text-center text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono bg-transparent border-none focus:ring-0 p-0 shadow-none" 
                      />
                    </div>
                    {errors.total_value && (
                      <p className="text-xs text-red-500 mt-1 font-medium">{errors.total_value.message as string}</p>
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs pt-1">
                    <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                      <span>Subtotal dos Itens:</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-200">
                        {formatCurrency(subTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <TruckIcon className="h-3.5 w-3.5 text-gray-400" /> Frete:
                      </span>
                      <div className="w-28">
                        <CurrencyInput 
                          control={control} 
                          name="shipping_value" 
                          className="h-8 text-right text-xs font-mono" 
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Forma de Pagamento */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    <CreditCardIcon className="h-4 w-4 text-brand-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Forma de Pagamento
                    </h3>
                  </div>

                  {/* Botões Rápidos de Seleção */}
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_QUICK_OPTIONS.map((opt) => {
                      const isSelected = watchedPaymentMethod === opt.slug;
                      return (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => form.setValue('payment_method', opt.slug as any, { shouldValidate: true })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                            isSelected 
                              ? 'bg-brand-blue-500 text-white border-brand-blue-500 shadow-sm'
                              : 'bg-gray-50/80 dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span>{opt.icon}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Fallback Select para outros métodos */}
                  <select
                    {...register('payment_method')}
                    className="w-full h-8 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-2 text-gray-600 dark:text-gray-400 mt-1"
                  >
                    {Object.entries(PAYMENT_METHODS).map(([slug, name]) => (
                      <option key={slug} value={slug}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* Card Observações */}
                <div className="bg-white dark:bg-brand-dark-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-2">
                  <Label htmlFor="observations" className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 block">
                    Observações e Notas
                  </Label>
                  <Textarea 
                    id="observations"
                    {...register('observations')} 
                    placeholder="Ex: Entrega realizada no portão 2. Material conferido pelo encarregado..." 
                    className="min-h-[85px] text-xs resize-none"
                  />
                </div>

              </div>

            </div>
          </div>

          {/* Footer de Ação */}
          <ResponsiveModalFooter className="p-4 flex-shrink-0 flex justify-between items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:inline">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-[10px]">Esc</kbd> para cancelar
            </span>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={createMutation.isPending} 
                className="text-xs h-9 px-4 flex-1 sm:flex-initial"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                isLoading={createMutation.isPending} 
                loadingText="Salvando..." 
                className="text-xs h-9 px-6 bg-brand-blue-600 hover:bg-brand-blue-500 text-white font-bold flex-1 sm:flex-initial"
              >
                Salvar Despesa
              </Button>
            </div>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>

      {/* Modal Avançado Opcional de Itens para Notas Grandes */}
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
  <div className="space-y-1.5">
    <Label className={`text-xs font-semibold ${error ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>
      {label}
    </Label>
    {children}
    {error && <p className="text-[10px] text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
  </div>
);

const Combobox: React.FC<{
  label: React.ReactNode; 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string; 
  error?: string;
  icon?: React.ReactNode;
}> = ({ label, options, value, onChange, placeholder, error, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  useEffect(() => { if (!isOpen) setSearch(''); }, [isOpen]);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <InputGroup label={label} error={error}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            className={`w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white ${!value && 'text-gray-400'}`}
          >
            <span className="flex items-center gap-2 truncate">
              {icon}
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark-900 shadow-xl">
          <Command>
            <CommandInput 
              placeholder="Buscar..." 
              value={search} 
              onInput={(e) => setSearch(e.currentTarget.value)} 
              className="border-none focus:ring-0 h-9 text-xs text-gray-900 dark:text-white" 
            />
            <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
              <CommandEmpty className="py-2 text-center text-xs text-gray-500">Nenhum resultado.</CommandEmpty>
              {filteredOptions.map(option => (
                <CommandItem 
                  key={option.value} 
                  className="cursor-pointer aria-selected:bg-brand-blue-500/20 text-xs py-1.5 text-gray-700 dark:text-white" 
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

const CurrencyInput: React.FC<{ control: any; name: string; className?: string; placeholder?: string }> = ({ control, name, className, placeholder }) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { onChange, value } }) => {
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
          value={displayValue} 
          onChange={handleChange} 
          className={className} 
          placeholder={placeholder || "0,00"} 
          inputMode="decimal"
        />
      );
    }}
  />
);

const ManagedCurrencyInput = ({ control, name, placeholder }: { control: any; name: string; placeholder?: string }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value } }) => {
        const displayValue = useMemo(() => {
          if (value === null || value === undefined || value === 0 || value === '') return '';
          return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(value) || 0);
        }, [value]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const numberValue = e.target.value.replace(/[^0-9]/g, '');
          onChange(numberValue === '' ? 0 : parseFloat(numberValue) / 100);
        };

        return (
          <Input 
            value={displayValue} 
            onChange={handleChange} 
            className="text-right h-9 text-xs font-mono" 
            placeholder={placeholder || "0,00"} 
            inputMode="decimal"
          />
        );
      }}
    />
  );
};

export default ManualNotaModal;
