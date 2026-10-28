'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataTablePaginationProps {
  total: number;
  limit: number;
  offset: number;
  onLimitChange: (limit: number) => void;
  onOffsetChange: (offset: number) => void;
  limitOptions?: number[];
}

/** Pagination commune aux tableaux chargés côté serveur. */
export function DataTablePagination({
  total,
  limit,
  offset,
  onLimitChange,
  onOffsetChange,
  limitOptions = [10, 50, 100, 500, 1000],
}: DataTablePaginationProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const safeLimit = Math.max(1, limit);
  const currentPage = Math.floor(offset / safeLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const canGoPrevious = offset > 0;
  const canGoNext = offset + safeLimit < total;
  const formattedTotal = new Intl.NumberFormat(locale).format(total);

  const goToPage = (page: number) => {
    onOffsetChange((page - 1) * safeLimit);
  };

  const handleLimitChange = (value: string | null) => {
    const newLimit = Number(value);
    if (!Number.isInteger(newLimit) || newLimit < 1) return;

    onLimitChange(newLimit);
    onOffsetChange(0);
  };

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t('pagination.total', { count: formattedTotal })}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {t('pagination.perPage')}
          </span>
          <Select value={String(safeLimit)} onValueChange={handleLimitChange}>
            <SelectTrigger className="w-20" aria-label={t('pagination.perPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {t('pagination.page', { current: currentPage, total: totalPages })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('pagination.first')}
            title={t('pagination.first')}
            onClick={() => goToPage(1)}
            disabled={!canGoPrevious}
          >
            <ChevronsLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('pagination.previous')}
            title={t('pagination.previous')}
            onClick={() => goToPage(currentPage - 1)}
            disabled={!canGoPrevious}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('pagination.next')}
            title={t('pagination.next')}
            onClick={() => goToPage(currentPage + 1)}
            disabled={!canGoNext}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('pagination.last')}
            title={t('pagination.last')}
            onClick={() => goToPage(totalPages)}
            disabled={!canGoNext}
          >
            <ChevronsRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
