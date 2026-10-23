import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover';
import { Command, CommandInput, CommandEmpty, CommandItem, CommandList } from '../ui/Command';
import { ChevronsUpDownIcon } from '../../lib/icons';
import { Supplier, PAYMENT_METHODS } from '../../types';
import { Button } from '../ui/Button';

type NotaFilters = {
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
        // Create date in UTC to avoid timezone issues
        onFiltersChange({
            ...filters,
            [field]: value ? new Date(value + 'T00:00:00') : null,
        });
    };
    
    const formatDateForInput = (date: Date | null): string => {
        if (!date) return '';
        // toISOString() is safe here because we constructed the date in UTC
        return date.toISOString().split('T')[0];
    };


    return (
        <div className="space-y-5">
            {/* Invoice Number Filter */}
            <div className="space-y-2">
                <Label htmlFor="invoice_number_filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">Número da Nota</Label>
                <Input
                    id="invoice_number_filter"
                    type="text"
                    inputMode="numeric"
                    placeholder="Buscar por número"
                    value={filters.invoice_number}
                    onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                    className="h-9"
                />
            </div>

            {/* Supplier Filter */}
            <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fornecedor</Label>
                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal text-left h-9 px-3 text-sm">
                            <span className="truncate">
                                {filters.supplier_id
                                    ? suppliers.find(s => s.id === filters.supplier_id)?.name
                                    : "Selecione um fornecedor"}
                            </span>
                            <ChevronsUpDownIcon className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                        <Command>
                            <CommandInput placeholder="Buscar fornecedor..." value={supplierSearch} onInput={(e) => setSupplierSearch(e.currentTarget.value)} />
                            <CommandList className="max-h-[200px] overflow-y-auto">
                                <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                                <CommandItem className="cursor-pointer" onSelect={() => {
                                    handleInputChange('supplier_id', null);
                                    setIsSupplierPopoverOpen(false);
                                }}>
                                    -- Todos --
                                </CommandItem>
                                {filteredSuppliersForSearch.map(s => (
                                    <CommandItem key={s.id} className="cursor-pointer" onSelect={() => {
                                        handleInputChange('supplier_id', s.id);
                                        setIsSupplierPopoverOpen(false);
                                    }}>
                                        {s.name}
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Payment Method Filter */}
            <div className="space-y-2">
                <Label htmlFor="payment_method_filter" className="text-xs font-medium text-gray-700 dark:text-gray-300">Forma de Pagamento</Label>
                <select
                    id="payment_method_filter"
                    value={filters.payment_method || ''}
                    onChange={(e) => handleInputChange('payment_method', e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-brand-dark-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue-500/50"
                >
                    <option value="">Todas</option>
                    {Object.entries(PAYMENT_METHODS).map(([slug, name]) => (
                        <option key={slug} value={slug}>{name}</option>
                    ))}
                </select>
            </div>
            
            <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Período de Emissão</Label>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="start_date_filter" className="text-[10px] uppercase tracking-wider text-gray-500">Início</Label>
                        <Input
                            id="start_date_filter"
                            type="date"
                            value={formatDateForInput(filters.start_date)}
                            onChange={(e) => handleDateInputChange('start_date', e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="end_date_filter" className="text-[10px] uppercase tracking-wider text-gray-500">Fim</Label>
                        <Input
                            id="end_date_filter"
                            type="date"
                            value={formatDateForInput(filters.end_date)}
                            onChange={(e) => handleDateInputChange('end_date', e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FiltrosNotas;