
import React, { useMemo } from 'react';
import { UseFormReturn, useWatch, Control, useController } from 'react-hook-form';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { PlusIcon, Trash2Icon, PackageIcon } from '../../lib/icons';
import { CATEGORIA_NOTA_ENUM } from '../../types';
import { ManualNotaFormValues } from '../../lib/validators';

interface ItemsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: UseFormReturn<ManualNotaFormValues>;
  fields: any[];
  append: (value: any) => void;
  remove: (index: number) => void;
}

const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const ItemTotalDisplay = ({ control, index }: { control: Control<ManualNotaFormValues>; index: number }) => {
    const quantity = useWatch({ control, name: `items.${index}.quantity` });
    const unitPrice = useWatch({ control, name: `items.${index}.unit_price` });
    const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
    return <span>{formatCurrency(total)}</span>;
};

// We need the CurrencyInput logic from FormStep to work correctly here.
const ManagedCurrencyInput = ({ control, name, error }: { control: any; name: string, error?: any }) => {
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
            className={`text-right h-9 text-sm bg-brand-dark-950 border-gray-700 text-white ${error ? 'border-red-500 focus:ring-red-500' : ''}`} 
            placeholder="0,00" 
            inputMode="decimal"
        />
    );
};


const ItemsManagerModal: React.FC<ItemsManagerModalProps> = ({ isOpen, onClose, form, fields, append, remove }) => {
  const { register, control, formState: { errors } } = form;

  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
      <ResponsiveModalContent className="max-w-5xl bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <ResponsiveModalTitle className="flex items-center gap-2 text-base text-white">
            <PackageIcon className="h-4 w-4 text-brand-blue-500" />
            Gerenciar Itens da Nota
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs text-gray-500 dark:text-gray-400">
            Adicione, remova ou edite os detalhes de cada item da nota fiscal.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-brand-dark-950/50 custom-scrollbar">
            {fields.map((field, index) => {
                const itemErrors = errors.items?.[index];
                return (
                <div key={field.id} className="p-5 bg-gray-900/80 rounded-xl border border-gray-800 shadow-sm relative group transition-all hover:border-brand-blue-500/30 hover:bg-gray-900/90">
                    {/* Micro-label for Index */}
                    <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-brand-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg border-2 border-white dark:border-brand-dark-900 z-10">
                        {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1" />
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20 border-red-900/30 rounded-lg -mr-1 -mt-1" 
                                onClick={() => remove(index)}
                                title="Remover item"
                            >
                                <Trash2Icon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 -mt-8">
                        {/* Line 1: Description (Full width on mobile, 6 cols on desk) */}
                        <div className="md:col-span-6">
                            <InputGroup label="Descrição do Item *" error={itemErrors?.description?.message}>
                                <Input {...register(`items.${index}.description`)} placeholder="Ex: Cimento CPII" className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white" />
                            </InputGroup>
                        </div>
                        
                        {/* Line 1: Category (6 cols) */}
                        <div className="md:col-span-6 pr-8">
                            <InputGroup label="Categoria *" error={itemErrors?.category?.message}>
                                <select {...register(`items.${index}.category`)} className="w-full rounded-lg border border-gray-700 bg-brand-dark-950 p-2 text-sm text-white focus:border-brand-blue-500 focus:ring-brand-blue-500 h-10 transition-all">
                                    {CATEGORIA_NOTA_ENUM.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </InputGroup>
                        </div>
                        
                        <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <InputGroup label="Fabricante">
                                <Input {...register(`items.${index}.manufacturer`)} placeholder="Opcional" className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white" />
                            </InputGroup>
                            <InputGroup label="Un. Medida">
                                <Input {...register(`items.${index}.unit_of_measure`)} placeholder="Ex: Un" className="bg-brand-dark-950 border-gray-700 h-10 text-sm text-white" />
                            </InputGroup>
                            <InputGroup label="Qtd *" error={itemErrors?.quantity?.message}>
                                <Input type="text" inputMode="decimal" {...register(`items.${index}.quantity`)} className="text-right bg-brand-dark-950 border-gray-700 h-10 text-sm text-white font-mono" />
                            </InputGroup>
                            <InputGroup label="Valor Unit. *" error={itemErrors?.unit_price?.message}>
                                <ManagedCurrencyInput control={control} name={`items.${index}.unit_price`} error={itemErrors?.unit_price} />
                            </InputGroup>
                        </div>
                        
                        {/* Total Display */}
                        <div className="md:col-span-12 flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800/50">
                            <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">Total do Item</span>
                            <div className="text-base font-mono font-bold text-brand-blue-600 dark:text-brand-blue-400">
                                <ItemTotalDisplay control={control} index={index}/>
                            </div>
                        </div>
                    </div>
                </div>
            )})}
            {fields.length === 0 && (
                <div className="text-center py-10 text-gray-400 bg-gray-900/30 rounded-lg border border-dashed border-gray-700 text-sm">
                    <p>Nenhum item adicionado.</p>
                </div>
            )}
        </div>

        <ResponsiveModalFooter className="shrink-0 p-4 border-t border-gray-800 bg-brand-dark-900 flex flex-row justify-between items-center gap-4 w-full z-30">
            <Button 
                type="button" 
                variant="outline" 
                className="flex-1 h-10 text-[10px] sm:text-sm border-brand-blue-500/50 text-brand-blue-500 hover:bg-brand-blue-500 hover:text-white px-1 sm:px-4 font-bold uppercase tracking-wide transition-all"
                onClick={() => append({ description: '', quantity: 1, unit_price: 0, category: 'Estrutura e Fundação', manufacturer: '', unit_of_measure: '' })}
            >
                <PlusIcon className="h-4 w-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Adicionar Novo Item</span><span className="sm:hidden">Novo Item</span>
            </Button>
            <Button type="button" onClick={onClose} className="flex-1 h-10 text-[10px] sm:text-sm px-1 sm:px-4 font-bold uppercase tracking-wide">
                Concluir Edição
            </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

const InputGroup: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div>
        <Label className={`text-xs ${error ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}>{label}</Label>
        <div className="mt-1">{children}</div>
        {error && <p className="text-[10px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
);

export default ItemsManagerModal;
