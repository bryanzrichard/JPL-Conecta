import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Task, Project, Collaborator } from '../../types';
import { 
  ChevronDownIcon, ChevronUpIcon, ClipboardListIcon, 
  ShoppingBagIcon, BuildingIcon, UserIcon, ClockIcon 
} from '../../lib/icons';
import TaskFormDetailsSection from './TaskFormDetailsSection';
import { parseNamedItems } from './types';

interface TaskFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: Task | null;
  projects: Project[];
  collaborators: Collaborator[];
  isLoadingPrerequisites?: boolean;
}

const customResolver = createZodResolver(taskSchema);

export const TaskFormDrawer: React.FC<TaskFormDrawerProps> = ({
  isOpen, onClose, taskToEdit, projects, collaborators, isLoadingPrerequisites = false,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!taskToEdit;

  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isPurchase, setIsPurchase] = useState(false);

  const defaultValues: TaskFormValues = useMemo(() => {
    if (taskToEdit) {
      return {
        title: taskToEdit.title || '',
        description: taskToEdit.description || '',
        project_id: taskToEdit.project_id,
        data_inicio_prevista: taskToEdit.data_inicio_prevista ? taskToEdit.data_inicio_prevista.split('T')[0] : null,
        data_fim_prevista: taskToEdit.data_fim_prevista ? taskToEdit.data_fim_prevista.split('T')[0] : null,
        materiais_previstos: parseNamedItems(taskToEdit.materiais_previstos),
        equipamentos_utilizados: parseNamedItems(taskToEdit.equipamentos_utilizados),
        observacoes: taskToEdit.observacoes || '',
        status: taskToEdit.status,
        prioridade: taskToEdit.prioridade,
        responsavel_execucao_id: taskToEdit.responsavel_execucao_id || null,
        custo_real: taskToEdit.custo_real || 0,
      };
    }
    return {
      title: '', description: '', project_id: projects[0]?.id || '', status: 'Planejada',
      prioridade: 'Média', materiais_previstos: [], equipamentos_utilizados: [],
      observacoes: '', data_inicio_prevista: null, data_fim_prevista: null,
      responsavel_execucao_id: null, custo_real: 0,
    };
  }, [taskToEdit, projects]);

  const {
    register, handleSubmit, reset, control, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({ resolver: customResolver, mode: 'onBlur', defaultValues });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({ control, name: 'materiais_previstos' });
  const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({ control, name: 'equipamentos_utilizados' });
  const watchedPriority = watch('prioridade');

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      setShowMoreDetails(false);
      const detectedPurchase = taskToEdit
        ? (taskToEdit.observacoes || '').includes('[COMPRA]') || (taskToEdit.description || '').toLowerCase().includes('[compra]')
        : false;
      setIsPurchase(detectedPurchase);
    }
  }, [isOpen, defaultValues, reset, taskToEdit]);

  const mutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      if (!user || !profile) throw new Error('Usuário não autenticado.');

      let obs = data.observacoes || '';
      if (isPurchase && !obs.includes('[COMPRA]')) {
        obs = obs ? `[COMPRA] ${obs}` : '[COMPRA]';
      }

      let desc = data.description || '';
      if (isPurchase && !desc.toLowerCase().includes('[compra]')) {
        desc = desc ? `[COMPRA] ${desc}` : '[COMPRA] Item para cotação e compra rápida';
      }

      const payload = {
        title: data.title.trim(),
        description: desc,
        project_id: data.project_id,
        status: data.status,
        prioridade: data.prioridade,
        data_inicio_prevista: data.data_inicio_prevista || null,
        data_fim_prevista: data.data_fim_prevista || null,
        materiais_previstos: data.materiais_previstos || [],
        equipamentos_utilizados: data.equipamentos_utilizados || [],
        observacoes: obs || null,
        responsavel_execucao_id: data.responsavel_execucao_id || null,
        custo_real: Number(data.custo_real) || 0,
        company_id: profile.company_id,
        created_by: user.id,
      };

      const { error } = isEditMode
        ? await supabase.from('tasks').update(payload).eq('id', taskToEdit.id)
        : await supabase.from('tasks').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Sucesso!', description: `Tarefa ${isEditMode ? 'atualizada' : 'cadastrada'} com sucesso.` });
      onClose();
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar tarefa', description: formatApiError(error) });
    },
  });

  return (
    <ResponsiveModal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} displayMode="drawer">
      <ResponsiveModalContent size="md" fullHeight>
        <ResponsiveModalHeader>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPurchase
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
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
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                Título da Tarefa <span className="text-rose-500">*</span>
              </Label>
              <Input {...register('title')} placeholder="Ex: Instalação de pisos no 2º pavimento" className="h-9 text-xs" />
              {errors.title && <p className="text-[11px] text-rose-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">Tipo de Registro</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPurchase(false)}
                  className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    !isPurchase ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800'
                  }`}
                >
                  <ClipboardListIcon className="h-4 w-4" />
                  <span>Tarefa de Canteiro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPurchase(true)}
                  className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    isPurchase ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800'
                  }`}
                >
                  <ShoppingBagIcon className="h-4 w-4" />
                  <span>Lista de Compras</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                  <BuildingIcon className="h-3.5 w-3.5 text-slate-400" /> Obra / Canteiro <span className="text-rose-500">*</span>
                </Label>
                <select
                  {...register('project_id')}
                  disabled={isLoadingPrerequisites}
                  className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white"
                >
                  <option value="">Selecione a obra...</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                {errors.project_id && <p className="text-[11px] text-rose-500">{errors.project_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Responsável
                </Label>
                <select
                  {...register('responsavel_execucao_id')}
                  disabled={isLoadingPrerequisites}
                  className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white"
                >
                  <option value="">Não atribuído</option>
                  {collaborators.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 text-slate-400" /> Prazo Final
                </Label>
                <input
                  type="date"
                  {...register('data_fim_prevista')}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">Prioridade</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Baixa', 'Média', 'Alta'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue('prioridade', p, { shouldDirty: true })}
                      className={`h-9 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        watchedPriority === p
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-brand-dark-950 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>{showMoreDetails ? 'Menos detalhes ▲' : 'Mais detalhes (Data de início, Almoxarifado, Custo...) ▼'}</span>
              {showMoreDetails ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
          </div>

          {showMoreDetails && (
            <TaskFormDetailsSection
              register={register}
              materialFields={materialFields}
              onAddMaterial={(nome) => appendMaterial({ nome })}
              onRemoveMaterial={(index) => removeMaterial(index)}
              equipmentFields={equipmentFields}
              onAddEquipment={(nome) => appendEquipment({ nome })}
              onRemoveEquipment={(index) => removeEquipment(index)}
            />
          )}
        </form>

        <ResponsiveModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="task-form-drawer"
            size="sm"
            disabled={isSubmitting || mutation.isPending}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            {isSubmitting || mutation.isPending ? 'Salvando...' : 'Salvar Tarefa'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default TaskFormDrawer;
