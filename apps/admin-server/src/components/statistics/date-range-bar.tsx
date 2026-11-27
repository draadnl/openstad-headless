import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import React, { useState } from 'react';

type DateRangeBarProps = {
  fromDate: Date;
  toDate: Date;
  onFromChange: (date: Date) => void;
  onToChange: (date: Date) => void;
};

type DatePickerProps = {
  id: string;
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  disabled: (date: Date) => boolean;
};

function DatePicker({ id, label, value, onChange, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              'min-h-[44px] px-3 text-sm font-normal rounded-lg border-input bg-background hover:bg-accent/50 transition-colors',
              !value && 'text-muted-foreground'
            )}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            {value ? (
              format(value, 'd MMMM yyyy', { locale: nl })
            ) : (
              <span>Kies een datum</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (date) onChange(date);
              setOpen(false);
            }}
            disabled={disabled}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Van/Tot date range; wraps on narrow screens.
export function DateRangeBar({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: DateRangeBarProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
      <DatePicker
        id="statistics-date-from"
        label="Van"
        value={fromDate}
        onChange={onFromChange}
        disabled={(date) => date > toDate}
      />
      <DatePicker
        id="statistics-date-to"
        label="Tot"
        value={toDate}
        onChange={onToChange}
        disabled={(date) => date < fromDate}
      />
    </div>
  );
}
