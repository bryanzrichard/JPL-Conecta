import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange, DayPicker } from 'react-day-picker';
import { Button } from './Button';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';
import { CalendarIcon } from 'lucide-react';

interface DatePickerWithRangeProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}

export function DatePickerWithRange({ date, onDateChange, className }: DatePickerWithRangeProps) {
  return (
    <div className={`grid gap-2 ${className}`}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={'outline'}
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'dd/MM/y', { locale: ptBR })} -{' '}
                  {format(date.to, 'dd/MM/y', { locale: ptBR })}
                </>
              ) : (
                format(date.from, 'dd/MM/y', { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <DayPicker
            locale={ptBR}
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}