import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon, CalendarIcon, BuildingIcon, CreditCardIcon, FileTextIcon, FilterIcon, XIcon } from '../../lib/icons';
import { Supplier, PAYMENT_METHODS } from '../../types';
import { Button } from '../ui/Button';

export type NotaFilters = {
  invoice_number: string;
  supplier_id: string | null;
  payment_method: string | null;
  start_date: Date | null;
  end_date: Date | null;
};

interface FiltrosNotasProps {
  filters: NotaFilters;
  onFiltersChange: (filters: NotaFilters) => void;
  suppliers: Supplier[];
}

const QUICK_PERIOD_SHORTCUTS = [
  { label: 'Hoje', daysAgo: 0 },
  { label: 'Últimos 7 dias', daysAgo: 7 },
  { label: 'Este Mês', isCurrentMonth: true },
  { label: 'Últimos 90 dias', daysAgo: 90 },
];

const PAYMENT_QUICK_FILTERS = [
  { slug: '', label: 'Todas' },
  { slug: 'pix', label: 'PIX' },
  { slug: 'boleto', label: 'Boleto' },
  { slug: 'cartao_credito', label: 'Cartão Crédito' },
  { slug: 'transferencia', label: 'Transferência' },
  { slug: 'dinheiro', label: 'Dinheiro' },
];

const FiltrosNotas: React.FC<FiltrosNotasProps> = ({ filters, onFiltersChange, suppliers }) => {
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);

  const filteredSuppliersForSearch = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const handleInputChange = (field: keyof NotaFilters, value: string | null) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleDateInputChange = (field: 'start_date' | 'end_date', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value ? new Date(value + 'T00:00:00') : null,
    });
  };
  
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const applyQuickPeriod = (shortcut: typeof QUICK_PERIOD_SHORTCUTS[number]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (shortcut.isCurrentMonth) {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      onFiltersChange({
        ...filters,
        start_date: startOfMonth,
        end_date: today,
      });
      return;
    }

    if (shortcut.daysAgo === 0) {
      onFiltersChange({
        ...filters,
        start_date: today,
        end_date: today,
      });
      return;
    }

    const pastDate = new Date(Date.now() - shortcut.daysAgo * 86400000);
    pastDate.setHours(0, 0, 0, 0);
    onFiltersChange({
      ...filters,
      start_date: pastDate,
      end_date: today,
    });
  };

  const clearDates = () => {
    onFiltersChange({
      ...filters,
      start_date: null,
      end_date: null,
    });
  };

  const selectedSupplierName = suppliers.find(s => s.id === filters.supplier_id)?.name;

  return (
    <div className="space-y-6">
      
      {/* Atalhos Rápidos de Período */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
            Atalhos de Período
          </Label>
          {(filters.start_date || filters.end_date) && (
            <button
              type="button"
              onClick={clearDates}
              className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5 font-medium"
            >
              <XIcon className="h-3 w-3" /> Limpar datas
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_PERIOD_SHORTCUTS.map(shortcut => (
            <Button
              key={shortcut.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyQuickPeriod(shortcut)}
              className="h-8 text-xs font-medium bg-white dark:bg-brand-dark-900 border-gray-200 dark:border-gray-800 hover:border-brand-blue-500 hover:text-brand-blue-500 justify-center"
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Grupo 1: Identificação & Fornecedor */}
      <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
          <FileTextIcon className="h-3.5 w-3.5 text-brand-blue-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
            Identificação
          </h4>
        </div>

        {/* Invoice Number Filter */}
        <div className="space-y-1.5">
          <Label htmlFor="invoice_number_filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Número da Nota / Recibo
          </Label>
          <Input
            id="invoice_number_filter"
            type="text"
            placeholder="Buscar por número..."
            value={filters.invoice_number}
            onChange={(e) => handleInputChange('invoice_number', e.target.value)}
            className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800"
          />
        </div>

        {/* Supplier Filter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Fornecedor Emitente
            </Label>
            {filters.supplier_id && (
              <button
                type="button"
                onClick={() => handleInputChange('supplier_id', null)}
                className="text-[10px] text-gray-400 hover:text-red-500"
              >
                Limpar
              </button>
            )}
          </div>
          <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={`w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 ${!filters.supplier_id ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
              >
                <span className="truncate">
                  {selectedSupplierName || "Todos os fornecedores"}
                </span>
                <ChevronsUpDownIcon className="ml-2 h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] border-gray-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 shadow-xl">
              <Command>
                <CommandInput 
                  placeholder="Buscar fornecedor..." 
                  value={supplierSearch} 
                  onInput={(e) => setSupplierSearch(e.currentTarget.value)} 
                  className="border-none focus:ring-0 h-9 text-xs"
                />
                <CommandList className="max-h-[200px] overflow-y-auto custom-scrollbar">
                  <CommandEmpty className="py-2 text-center text-xs text-gray-400">Nenhum fornecedor encontrado.</CommandEmpty>
                  <CommandItem 
                    className="cursor-pointer text-xs py-2 px-3 font-semibold text-brand-blue-600 dark:text-brand-blue-400" 
                    onSelect={() => {
                      handleInputChange('supplier_id', null);
                      setIsSupplierPopoverOpen(false);
                    }}
                  >
                    -- Todos os fornecedores --
                  </CommandItem>
                  {filteredSuppliersForSearch.map(s => (
                    <CommandItem 
                      key={s.id} 
                      className="cursor-pointer text-xs py-2 px-3" 
                      onSelect={() => {
                        handleInputChange('supplier_id', s.id);
                        setIsSupplierPopoverOpen(false);
                      }}
                    >
                      {s.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Grupo 2: Modalidade Financeira (Pills) */}
      <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
          <CreditCardIcon className="h-3.5 w-3.5 text-brand-blue-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
            Forma de Pagamento
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PAYMENT_QUICK_FILTERS.map((item) => {
            const isSelected = (filters.payment_method || '') === item.slug;
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => handleInputChange('payment_method', item.slug || null)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                  isSelected
                    ? 'bg-brand-blue-500/10 border-brand-blue-500 text-brand-blue-600 dark:text-brand-blue-400 font-semibold'
                    : 'bg-white dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grupo 3: Intervalo de Datas Customizado */}
      <div className="bg-white dark:bg-brand-dark-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
          <CalendarIcon className="h-3.5 w-3.5 text-brand-blue-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
            Intervalo Personalizado
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start_date_filter" className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              A partir de
            </Label>
            <Input
              id="start_date_filter"
              type="date"
              value={formatDateForInput(filters.start_date)}
              onChange={(e) => handleDateInputChange('start_date', e.target.value)}
              className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_date_filter" className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              Até a data
            </Label>
            <Input
              id="end_date_filter"
              type="date"
              value={formatDateForInput(filters.end_date)}
              onChange={(e) => handleDateInputChange('end_date', e.target.value)}
              className="h-9 text-xs bg-white dark:bg-brand-dark-950 border-gray-200 dark:border-gray-800"
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default FiltrosNotas;
