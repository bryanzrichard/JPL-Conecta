import React, { useMemo } from 'react';
import { UseFormReturn, useWatch, Control, useController } from 'react-hook-form';
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
import { PlusIcon, Trash2Icon, PackageIcon } from '../../lib/icons';
import { CATEGORIA_NOTA_ENUM } from '../../types';
import { ManualNotaFormValues } from '../../lib/validators';
import { formatCurrency } from '../../lib/utils';

interface ItemsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: UseFormReturn<ManualNotaFormValues>;
  fields: any[];
  append: (value: any) => void;
  remove: (index: number) => void;
}

const ItemTotalDisplay = ({ control, index }: { control: Control<ManualNotaFormValues>; index: number }) => {
  const quantity = useWatch({ control, name: `items.${index}.quantity` });
  const unitPrice = useWatch({ control, name: `items.${index}.unit_price` });
  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return <span>{formatCurrency(total)}</span>;
};

const ManagedCurrencyInput = ({ control, name, error }: { control: any; name: string; error?: any }) => {
  const { field } = useController({
    name,
    control,
  });

  const displayValue = useMemo(() => {
    if (field.value === null || field.value === undefined || field.value === 0 || field.value === '') return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(field.value) || 0);
  }, [field.value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numberValue = e.target.value.replace(/[^0-9]/g, '');
    field.onChange(numberValue === '' ? 0 : parseFloat(numberValue) / 100);
  };

  return (
    <Input 
      value={displayValue} 
      onChange={handleChange} 
      className={`text-right h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white font-mono ${error ? 'border-red-500 focus:ring-red-500' : ''}`} 
      placeholder="0,00" 
      inputMode="decimal"
    />
  );
};

const ItemsManagerModal: React.FC<ItemsManagerModalProps> = ({ isOpen, onClose, form, fields, append, remove }) => {
  const { register, control, formState: { errors } } = form;

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent size="xl" fullHeight className="max-w-5xl flex flex-col p-0">
        
        {/* Header Consistente */}
        <ResponsiveModalHeader className="px-6 py-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20 flex items-center justify-center text-brand-blue-600 dark:text-brand-blue-400 shrink-0">
              <PackageIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle className="text-base font-bold text-gray-900 dark:text-white">
                Gestor Completo de Itens e Insumos
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Edite a discriminação detalhada dos materiais, quantidades, marcas e preços unitários.
              </ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/60 dark:bg-brand-dark-950/50 custom-scrollbar">
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index];
            return (
              <div 
                key={field.id} 
                className="p-4 sm:p-5 bg-white dark:bg-brand-dark-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm relative group transition-all hover:border-brand-blue-500/40"
              >
                {/* Badge de Índice */}
                <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-brand-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow border-2 border-white dark:border-brand-dark-900">
                  {index + 1}
                </div>

                <div className="flex justify-end mb-2">
                  <button
                    type="button" 
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors" 
                    title="Remover linha"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 -mt-6">
                  {/* Descrição */}
                  <div className="md:col-span-7 space-y-1">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Descrição do Material <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      {...register(`items.${index}.description`)} 
                      placeholder="Ex: Cimento Portland CP-II E-32 50kg" 
                      className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs" 
                    />
                    {itemErrors?.description && <p className="text-[10px] text-red-500">{itemErrors.description.message}</p>}
                  </div>
                  
                  {/* Categoria */}
                  <div className="md:col-span-5 space-y-1">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Categoria <span className="text-red-500">*</span>
                    </Label>
                    <select 
                      {...register(`items.${index}.category`)} 
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-2 text-xs font-medium text-gray-800 dark:text-gray-200 h-9 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
                    >
                      {CATEGORIA_NOTA_ENUM.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  
                  {/* Fabricante, Unidade, Qtd e Preço */}
                  <div className="md:col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fabricante</Label>
                      <Input 
                        {...register(`items.${index}.manufacturer`)} 
                        placeholder="Opcional" 
                        className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs" 
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Un. Medida</Label>
                      <Input 
                        {...register(`items.${index}.unit_of_measure`)} 
                        placeholder="Ex: sacos, m², un" 
                        className="bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs" 
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Quantidade <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        type="number" 
                        step="any"
                        min="0.001"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })} 
                        className="text-right bg-white dark:bg-brand-dark-950 border-gray-300 dark:border-gray-800 h-9 text-xs font-mono" 
                      />
                      {itemErrors?.quantity && <p className="text-[10px] text-red-500">{itemErrors.quantity.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Valor Unitário <span className="text-red-500">*</span>
                      </Label>
                      <ManagedCurrencyInput 
                        control={control} 
                        name={`items.${index}.unit_price`} 
                        error={itemErrors?.unit_price} 
                      />
                      {itemErrors?.unit_price && <p className="text-[10px] text-red-500">{itemErrors.unit_price.message}</p>}
                    </div>
                  </div>
                  
                  {/* Total da Linha */}
                  <div className="md:col-span-12 flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Total da Linha:</span>
                    <div className="text-sm font-mono font-bold text-brand-blue-600 dark:text-brand-blue-400">
                      <ItemTotalDisplay control={control} index={index}/>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {fields.length === 0 && (
            <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-brand-dark-900 text-xs">
              <PackageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum item adicionado à nota fiscal.</p>
            </div>
          )}
        </div>

        {/* Footer Fixo */}
        <ResponsiveModalFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 gap-3">
          <Button 
            type="button" 
            variant="outline" 
            className="h-9 text-xs font-bold gap-1.5 border-brand-blue-500/40 text-brand-blue-600 dark:text-brand-blue-400 hover:bg-brand-blue-500/10"
            onClick={() => append({ 
              description: '', 
              quantity: 1, 
              unit_price: 0, 
              category: 'Estrutura e Fundação', 
              manufacturer: '', 
              unit_of_measure: '' 
            })}
          >
            <PlusIcon className="h-4 w-4" /> Adicionar Novo Item
          </Button>

          <Button 
            type="button" 
            onClick={onClose} 
            className="h-9 px-6 text-xs font-bold uppercase tracking-wider bg-brand-blue-600 hover:bg-brand-blue-500 text-white"
          >
            Concluir & Voltar
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ItemsManagerModal;
