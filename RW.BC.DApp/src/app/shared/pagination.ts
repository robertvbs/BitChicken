import { computed, linkedSignal, Signal } from '@angular/core';
import { PaginatorState } from 'primeng/paginator';

export interface PaginationState<T> {
  first: ReturnType<typeof linkedSignal<T[], number>>;
  paged: Signal<T[]>;
  showPaginator: Signal<boolean>;
  onPageChange: (event: PaginatorState) => void;
}

export function usePagination<T>(source: Signal<T[]>, pageSize = 10): PaginationState<T> {
  const first = linkedSignal<T[], number>({
    source,
    computation: () => 0,
  });

  const paged = computed(() => {
    const f = first();
    return source().slice(f, f + pageSize);
  });

  const showPaginator = computed(() => source().length > pageSize);

  function onPageChange(event: PaginatorState): void {
    first.set(event.first ?? 0);
  }

  return { first, paged, showPaginator, onPageChange };
}
