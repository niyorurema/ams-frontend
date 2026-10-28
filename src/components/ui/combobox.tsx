'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  allowAll?: boolean;
  allLabel?: string;
}

function normaliserRecherche(value: string): string {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Sélecteur accessible avec recherche locale et navigation clavier native. */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  id,
  ariaLabel,
  disabled = false,
  className,
  allowAll = false,
  allLabel = 'Tous',
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const optionsAvecTous = useMemo(
    () => allowAll ? [{ value: 'all', label: allLabel }, ...options] : options,
    [allowAll, allLabel, options],
  );
  const selection = optionsAvecTous.find((option) => option.value === value);
  const recherche = normaliserRecherche(search.trim());
  const optionsFiltrees = optionsAvecTous.filter((option) =>
    normaliserRecherche([option.label, option.description, option.keywords]
      .filter(Boolean)
      .join(' ')
    ).includes(recherche),
  );

  const choisir = (option: ComboboxOption) => {
    onValueChange(option.value);
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch('');
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn('w-full justify-between', className)}
          >
            <span className="truncate">{selection?.label ?? placeholder}</span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-(--anchor-width) min-w-56 p-2">
        <Input
          autoFocus
          type="search"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {optionsFiltrees.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div role="listbox" aria-label={placeholder} className="max-h-64 overflow-y-auto">
            {optionsFiltrees.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                onClick={() => choisir(option)}
              >
                <Check
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description && (
                    <span className="block truncate text-xs text-muted-foreground">{option.description}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
