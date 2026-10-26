import React, { useState } from 'react';
import { UseFormRegister } from 'react-hook-form';
import { TaskFormValues } from '../../lib/validators';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { TASK_STATUSES } from '../../types';
import { PlusIcon, Trash2Icon, PackageIcon, WrenchIcon, DollarSignIcon } from '../../lib/icons';

interface TaskFormDetailsSectionProps {
  register: UseFormRegister<TaskFormValues>;
  materialFields: { id: string; nome: string }[];
  onAddMaterial: (nome: string) => void;
  onRemoveMaterial: (index: number) => void;
  equipmentFields: { id: string; nome: string }[];
  onAddEquipment: (nome: string) => void;
  onRemoveEquipment: (index: number) => void;
}

export const TaskFormDetailsSection: React.FC<TaskFormDetailsSectionProps> = ({
  register,
  materialFields,
  onAddMaterial,
  onRemoveMaterial,
  equipmentFields,
  onAddEquipment,
  onRemoveEquipment,
}) => {
  const [materialInput, setMaterialInput] = useState('');
  const [equipmentInput, setEquipmentInput] = useState('');

  const handleAddMat = () => {
    if (materialInput.trim()) {
      onAddMaterial(materialInput.trim());
      setMaterialInput('');
    }
  };

  const handleAddEq = () => {
    if (equipmentInput.trim()) {
      onAddEquipment(equipmentInput.trim());
      setEquipmentInput('');
    }
  };

  return (
    <div className="space-y-4 pt-1 animate-in fade-in-50 text-xs">
      {/* Início Previsto e Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
            Data de Início Prevista
          </Label>
          <input
            type="date"
            {...register('data_inicio_prevista')}
            className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
            Status da Tarefa
          </Label>
          <select
            {...register('status')}
            className="w-full h-9 rounded-lg border border-slate-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 text-xs text-slate-800 dark:text-white"
          >
            {TASK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
          Descrição
        </Label>
        <Textarea
          {...register('description')}
          rows={2}
          placeholder="Instruções ou escopo da pendência..."
          className="text-xs bg-white dark:bg-brand-dark-950"
        />
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
          Observações
        </Label>
        <Textarea
          {...register('observacoes')}
          rows={2}
          placeholder="Anotações gerais..."
          className="text-xs bg-white dark:bg-brand-dark-950"
        />
      </div>

      {/* Materiais Previstos */}
      <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-gray-800">
        <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
          <PackageIcon className="h-3.5 w-3.5 text-indigo-500" />
          Materiais Previstos
        </Label>
        <div className="flex gap-2">
          <Input
            value={materialInput}
            onChange={(e) => setMaterialInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMat();
              }
            }}
            placeholder="Adicionar material (ex: 20 sacos de cimento)..."
            className="h-8 text-xs bg-white dark:bg-brand-dark-950"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddMat}
            className="h-8 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-200 cursor-pointer shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        {materialFields.length > 0 && (
          <div className="space-y-1 pt-1">
            {materialFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-1.5 bg-white dark:bg-brand-dark-900 rounded-md border border-slate-200 dark:border-gray-800 text-xs"
              >
                <span className="text-slate-700 dark:text-gray-200 truncate">{field.nome}</span>
                <button
                  type="button"
                  onClick={() => onRemoveMaterial(index)}
                  className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                >
                  <Trash2Icon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipamentos Utilizados */}
      <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-gray-800">
        <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
          <WrenchIcon className="h-3.5 w-3.5 text-amber-500" />
          Equipamentos Utilizados
        </Label>
        <div className="flex gap-2">
          <Input
            value={equipmentInput}
            onChange={(e) => setEquipmentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddEq();
              }
            }}
            placeholder="Adicionar equipamento (ex: Betoneira 400L)..."
            className="h-8 text-xs bg-white dark:bg-brand-dark-950"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddEq}
            className="h-8 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-200 cursor-pointer shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        {equipmentFields.length > 0 && (
          <div className="space-y-1 pt-1">
            {equipmentFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-1.5 bg-white dark:bg-brand-dark-900 rounded-md border border-slate-200 dark:border-gray-800 text-xs"
              >
                <span className="text-slate-700 dark:text-gray-200 truncate">{field.nome}</span>
                <button
                  type="button"
                  onClick={() => onRemoveEquipment(index)}
                  className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                >
                  <Trash2Icon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custo Real */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
          <DollarSignIcon className="h-3.5 w-3.5 text-emerald-600" />
          Custo Real (R$)
        </Label>
        <Input
          type="number"
          step="0.01"
          {...register('custo_real')}
          placeholder="0,00"
          className="h-9 text-xs"
        />
      </div>
    </div>
  );
};

export default TaskFormDetailsSection;
