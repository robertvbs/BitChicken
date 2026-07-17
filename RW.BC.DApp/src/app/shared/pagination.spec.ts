import { signal } from '@angular/core';
import { usePagination } from './pagination';

describe('usePagination', () => {
  it('paged returns first pageSize items', () => {
    const src = signal(Array.from({ length: 15 }, (_, i) => i));
    const { paged } = usePagination(src, 10);
    expect(paged()).toHaveLength(10);
    expect(paged()[0]).toBe(0);
    expect(paged()[9]).toBe(9);
  });

  it('paged returns all items when count is below pageSize', () => {
    const src = signal([1, 2, 3]);
    const { paged } = usePagination(src, 10);
    expect(paged()).toHaveLength(3);
  });

  it('showPaginator is false when items <= pageSize', () => {
    const src = signal(Array.from({ length: 10 }, (_, i) => i));
    const { showPaginator } = usePagination(src, 10);
    expect(showPaginator()).toBe(false);
  });

  it('showPaginator is true when items > pageSize', () => {
    const src = signal(Array.from({ length: 11 }, (_, i) => i));
    const { showPaginator } = usePagination(src, 10);
    expect(showPaginator()).toBe(true);
  });

  it('onPageChange moves to next page', () => {
    const src = signal(Array.from({ length: 15 }, (_, i) => i));
    const { first, paged, onPageChange } = usePagination(src, 10);
    onPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    expect(first()).toBe(10);
    expect(paged()).toHaveLength(5);
    expect(paged()[0]).toBe(10);
  });

  it('onPageChange with undefined first defaults to 0', () => {
    const src = signal(Array.from({ length: 15 }, (_, i) => i));
    const { first, onPageChange } = usePagination(src, 10);
    onPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    onPageChange({ rows: 10, page: 0, pageCount: 2 });
    expect(first()).toBe(0);
  });

  it('first resets to 0 when source signal changes', () => {
    const src = signal(Array.from({ length: 15 }, (_, i) => i));
    const { first, onPageChange } = usePagination(src, 10);
    onPageChange({ first: 10, rows: 10, page: 1, pageCount: 2 });
    expect(first()).toBe(10);
    src.set([1, 2, 3]);
    expect(first()).toBe(0);
  });

  it('uses default pageSize of 10', () => {
    const src = signal(Array.from({ length: 11 }, (_, i) => i));
    const { showPaginator } = usePagination(src);
    expect(showPaginator()).toBe(true);
  });

  it('paged returns empty array when source is empty', () => {
    const src = signal<number[]>([]);
    const { paged } = usePagination(src, 10);
    expect(paged()).toHaveLength(0);
  });
});
