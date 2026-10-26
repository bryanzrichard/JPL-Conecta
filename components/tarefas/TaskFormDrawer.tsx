import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, 
  ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter 
} from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { taskSchema, TaskFormValues, createZodResolver } from '../../lib/validators';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { formatApiError } from '../../lib/handleError';
import { Task, Project, Collaborator, TaskPriority, Json } from '../../types';
import { 
  ChevronDownIcon, ChevronUpIcon, ClipboardListIcon, 
  ShoppingBagIcon, BuildingIcon, UserIcon, ClockIcon 
} from '../../lib/icons';
import { formatDateYMD } from '../../lib/utils';
import { parseCompraItens, CompraItem } from '../../lib/compraItens';
import CompraItensEditor from './CompraItensEditor';

interface TaskFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: Task | null;
  projects: Project[];
  collaborators: Collaborator[];
  isLoadingPrerequisites?: boolean;
}

const customResolver = createZodResolver(taskSchema);

function getInitialValues(taskToEdit: Task | null): TaskFormValues {
  if (taskToEdit) {
    return {
      title: taskToEdit.title || '',
      description: taskToEdit.description || '',
      project_id: taskToEdit.project_id,
      data_inicio_prevista: taskToEdit.data_inicio_prevista ? taskToEdit.data_inicio_prevista.split('T')[0] : null,
      data_fim_prevista: taskToEdit.data_fim_prevista ? taskToEdit.data_fim_prevista.split('T')[0] : null,
      materiais_previstos: [],
      equipamentos_utilizados: [],
      observacoes: taskToEdit.observacoes || '',
      status: taskToEdit.status,
      prioridade: taskToEdit.prioridade,
      responsavel_execucao_id: taskToEdit.responsavel_execucao_id || null,
      custo_real: taskToEdit.custo_real || 0,
    };
  }
  return {
    title: '', description: '', project_id: '', status: 'Planejada', prioridade: 'Média',
    materiais_previstos: [], equipamentos_utilizados: [], observacoes: '',
    data_inicio_prevista: null, data_fim_prevista: null, responsavel_execucao_id: null, custo_real: 0,
  };
}

export const TaskFormDrawer: React.FC<TaskFormDrawerProps> = ({
  isOpen, onClose, taskToEdit, projects, collaborators, isLoadingPrerequisites = false,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!taskToEdit;

  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isPurchase, setIsPurchase] = useState(false);
  const [hasManualPriority, setHasManualPriority] = useState<boolean>(false);
  const [compraItens, setCompraItens] = useState<CompraItem[]>([]);
  const [compraItensError, setCompraItensError] = useState<string | null>(null);
  const prevEndDateRef = useRef<string | null>(null);
  const isLegacyPurchaseWithoutItemsRef = useRef<boolean>(false);

  const defaultValues = useMemo(() => getInitialValues(taskToEdit), [taskToEdit]);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: customResolver, mode: 'onBlur', defaultValues });

  const watchedPriority = watch('prioridade');
  const watchedEndDate = watch('data_fim_prevista');
  const watchedTitle = watch('title');

  const todayStr = useMemo(() => formatDateYMD(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateYMD(d);
  }, []);

  // Prioridade automática pelo prazo
  useEffect(() => {
    if (!isOpen) return;
    if (watchedEndDate !== prevEndDateRef.current) {
      prevEndDateRef.current = watchedEndDate || null;
      if (!hasManualPriority && watchedEndDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(`${watchedEndDate}T00:00:00`);
        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const newPriority: TaskPriority = diffDays <= 3 ? 'Alta' : diffDays <= 7 ? 'Média' : 'Baixa';
        setValue('prioridade', newPriority, { shouldDirty: true });
      }
    }
  }, [watchedEndDate, hasManualPriority, isOpen, setValue]);

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      setShowMoreDetails(false);
      setHasManualPriority(isEditMode);
      setCompraItensError(null);
      prevEndDateRef.current = defaultValues.data_fim_prevista || null;
      const detectedPurchase = taskToEdit
        ? (taskToEdit.observacoes || '').includes('[COMPRA]') || (taskToEdit.description || '').toLowerCase().includes('[compra]')
        : false;
      setIsPurchase(detectedPurchase);
      const initialItens = detectedPurchase && taskToEdit ? parseCompraItens(taskToEdit.materiais_previstos) : [];
      setCompraItens(initialItens);
      isLegacyPurchaseWithoutItemsRef.current = Boolean(isEditMode && detectedPurchase && initialItens.length === 0);
    }
  }, [isOpen, defaultValues, reset, taskToEdit, isEditMode]);

  const handleSelectType = (purchase: boolean) => {
    setIsPurchase(purchase);
    setCompraItensError(null);
    if (purchase) {
      if (!watchedTitle || watchedTitle.trim() === '') {
        setValue('title', 'Compra de materiais', { shouldDirty: true, shouldValidate: true });
      }
      if (compraItens.length === 0) {
        setCompraItens([{ nome: '', quantidade: null, unidade: null, comprado: false }]);
      }
    } else if (watchedTitle === 'Compra de materiais') {
      setValue('title', '', { shouldDirty: true });
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      if (!user || !profile) throw new Error('Usuário não autenticado.');

      let finalMateriais: Json = [];
      if (isPurchase) {
        const validItens = compraItens.filter((i) => i.nome.trim() !== '');
        if (validItens.length === 0) {
          if (isLegacyPurchaseWithoutItemsRef.current && isEditMode && taskToEdit) {
            finalMateriais = taskToEdit.materiais_previstos ?? [];
          } else {
            setCompraItensError('Adicione pelo menos um item.');
            throw new Error('Adicione pelo menos um item.');
          }
        } else {
          finalMateriais = validItens;
        }
      } else {
        finalMateriais = isEditMode && taskToEdit ? (taskToEdit.materiais_previstos ?? []) : [];
      }

      let obs = data.observacoes || '';
      let desc = isEditMode ? (taskToEdit?.description || '') : '';

      if (isPurchase) {
        if (!obs.includes('[COMPRA]')) obs = obs ? `[COMPRA] ${obs}` : '[COMPRA]';
        if (!desc.toLowerCase().includes('[compra]')) desc = desc ? `[COMPRA] ${desc}` : '[COMPRA] Material para compra/cotação';
      } else {
        const clean = desc.trim();
        desc = (clean === '[COMPRA] Material para compra/cotação' || clean === '[COMPRA] Item para cotação e compra rápida' || clean === '[COMPRA]')
          ? '' : desc.replace(/\[COMPRA\]\s*/gi, '').trim();
        obs = obs.replace(/\[COMPRA\]\s*/gi, '').trim();
      }

      const isEdit = isEditMode && taskToEdit;
      const payload = {
        title: data.title.trim(),
        description: desc,
        project_id: data.project_id,
        status: isEdit ? taskToEdit.status : 'Planejada',
        prioridade: data.prioridade,
        data_inicio_prevista: isEdit ? taskToEdit.data_inicio_prevista : (data.data_fim_prevista || null),
        data_fim_prevista: data.data_fim_prevista || null,
        materiais_previstos: finalMateriais,
        equipamentos_utilizados: isEdit ? (taskToEdit.equipamentos_utilizados || []) : [],
        observacoes: obs || null,
        responsavel_execucao_id: data.responsavel_execucao_id || null,
        custo_real: isEdit ? (taskToEdit.custo_real || 0) : 0,
        company_id: profile.company_id,
        created_by: user.id,
      };

      const { error } = isEdit
        ? await supabase.from('tasks').update(payload).eq('id', taskToEdit.id)
        : await supabase.from('tasks').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Sucesso!', description: `Registro ${isEditMode ? 'atualizado' : 'cadastrado'} com sucesso.` });
      onClose();
    },
    onError: (error) => {
      if (error.message !== 'Adicione pelo menos um item.') {
        toast({ variant: 'destructive', title: 'Erro ao salvar tarefa', description: formatApiError(error) });
      }
    },
  });

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} displayMode="drawer">
      <ResponsiveModalContent size="md" fullHeight>
        <ResponsiveModalHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPurchase ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isPurchase ? <ShoppingBagIcon className="h-5 w-5" /> : <ClipboardListIcon className="h-5 w-5" />}
            </div>
            <div>
              <ResponsiveModalTitle>{isEditMode ? 'Editar Tarefa' : 'Nova Tarefa'}</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {isEditMode ? 'Atualize as informações da pendência ou ordem de serviço.' : 'Cadastre uma nova pendência de obra ou lista de compras.'}
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>

        <form id="task-form-drawer" onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar text-xs">
          <div className="space-y-4">
            {/* 1. TIPO (Tarefa ou Compra) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">Tipo de Registro</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleSelectType(false)} className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${!isPurchase ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800'}`}>
                  <ClipboardListIcon className="h-4 w-4" /><span>Tarefa de Canteiro</span>
                </button>
                <button type="button" onClick={() => handleSelectType(true)} className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${isPurchase ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800'}`}>
                  <ShoppingBagIcon className="h-4 w-4" /><span>Lista de Compras</span>
                </button>
              </div>
            </div>

            {/* 2. TÍTULO */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                Título {isPurchase ? 'da Compra' : 'da Tarefa'} <span className="text-rose-500">*</span>
              </Label>
              <Input {...register('title')} placeholder={isPurchase ? 'Ex: Compra de materiais' : 'Ex: Instalação de pisos no 2º pavimento'} className="h-9 text-xs" />
              {errors.title && <p className="text-[11px] text-rose-500 font-medium">{errors.title.message}</p>}
            </div>

            {/* 3. OBRA */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <BuildingIcon className="h-3.5 w-3.5 text-slate-400" /> Obra / Canteiro <span className="text-rose-500">*</span>
              </Label>
              <select {...register('project_id')} disabled={isLoadingPrerequisites} className={`w-full h-9 rounded-lg border bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white transition-colors ${errors.project_id ? 'border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-300 dark:border-gray-800'}`}>
                <option value="">Selecione a obra...</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              {errors.project_id && <p className="text-[11px] text-rose-500 font-medium">{errors.project_id.message}</p>}
            </div>

            {/* ITENS DE COMPRA */}
            {isPurchase && (
              <CompraItensEditor
                items={compraItens}
                onChange={(newItens) => {
                  setCompraItens(newItens);
                  if (compraItensError) setCompraItensError(null);
                }}
                error={compraItensError}
              />
            )}

            {/* 4. PARA QUANDO: BOTOES HOJE / AMANHA + CAMPO DE DATA */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-slate-400" /> Para quando
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="grid grid-cols-2 gap-1.5 sm:col-span-1">
                  <button type="button" onClick={() => setValue('data_fim_prevista', todayStr, { shouldDirty: true, shouldValidate: true })} className={`h-9 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${watchedEndDate === todayStr ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800 hover:bg-slate-50'}`}>Hoje</button>
                  <button type="button" onClick={() => setValue('data_fim_prevista', tomorrowStr, { shouldDirty: true, shouldValidate: true })} className={`h-9 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${watchedEndDate === tomorrowStr ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800 hover:bg-slate-50'}`}>Amanhã</button>
                </div>
                <div className="sm:col-span-2">
                  <input type="date" {...register('data_fim_prevista')} className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white" />
                </div>
              </div>
            </div>

            {/* 5. RESPONSÁVEL E 6. PRIORIDADE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Responsável
                </Label>
                <select {...register('responsavel_execucao_id')} disabled={isLoadingPrerequisites} className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white">
                  <option value="">Não atribuído</option>
                  {collaborators.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">Prioridade</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Baixa', 'Média', 'Alta'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => { setHasManualPriority(true); setValue('prioridade', p, { shouldDirty: true }); }} className={`h-9 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${watchedPriority === p ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800'}`}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RECOLHIDO EM MAIS DETALHES: SOMENTE OBSERVAÇÃO */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-gray-800">
            <button type="button" onClick={() => setShowMoreDetails(!showMoreDetails)} className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors">
              <span>{showMoreDetails ? 'Menos detalhes ▲' : 'Mais detalhes (Observação) ▼'}</span>
              {showMoreDetails ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
          </div>

          {showMoreDetails && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-150">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">Observações</Label>
              <textarea {...register('observacoes')} rows={3} placeholder="Observações complementares ou notas internas..." className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500" />
            </div>
          )}
        </form>

        <ResponsiveModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Cancelar
          </Button>
          <Button type="submit" form="task-form-drawer" size="sm" disabled={isSubmitting || mutation.isPending} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs">
            {isSubmitting || mutation.isPending ? 'Salvando...' : 'Salvar Registro'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default TaskFormDrawer;
