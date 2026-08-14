import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Icon } from './ui';

export type SortDir = 'asc' | 'desc';

export function useSort<T>(defaultKey: string, defaultDir: SortDir = 'desc') {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: defaultKey, dir: defaultDir });
  const apply = useCallback(
    (rows: T[]) => {
      const { key, dir } = sort;
      return rows.slice().sort((a, b) => {
        const av = (a as Record<string, unknown>)[key];
        const bv = (b as Record<string, unknown>)[key];
        const cmp = (x: unknown, y: unknown): number => {
          if (typeof x === 'number' && typeof y === 'number') return x - y;
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return String(x).localeCompare(String(y), undefined, { numeric: true });
        };
        return dir === 'asc' ? cmp(av, bv) : cmp(bv, av);
      });
    },
    [sort]
  );
  const toggle = (key: string) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : defaultDir }));
  return { sortKey: sort.key, sortDir: sort.dir, toggle, apply };
}

export function SortTh({ k, children, sortKey, sortDir, onSort, className = '', style }: {
  k: string; children: ReactNode; sortKey: string; sortDir: SortDir; onSort: (k: string) => void; className?: string; style?: React.CSSProperties;
}) {
  const active = sortKey === k;
  return (
    <th className={`sortable ${active ? 'sorted' : ''} ${className}`} style={style} onClick={() => onSort(k)}>
      <span>{children}</span>
      <span className="sort-ic">
        <Icon name={active ? (sortDir === 'asc' ? 'sortAsc' : 'sortDesc') : 'sortDesc'} size={13} />
      </span>
    </th>
  );
}

export function usePagination<T>(pageSize = 10) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const go = useCallback((p: number) => setPage(Math.max(1, p)), []);
  const reset = useCallback(() => setPage(1), []);
  const slice = useCallback((rows: T[]) => rows.slice((page - 1) * size, page * size), [page, size]);
  return { page, size, go, setSize, reset, slice };
}

export function Pagination({ page, size, total, onPage, onSize }: {
  page: number; size: number; total: number; onPage: (p: number) => void; onSize: (s: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size && pages <= 1) return null;
  const window: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = from; i <= Math.min(pages, from + 4); i++) window.push(i);
  return (
    <div className="pagination">
      <div className="page-size">
        <select value={size} onChange={(e) => { onSize(+e.target.value); onPage(1); }}>
          {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s} per page</option>)}
        </select>
      </div>
      <span className="page-of">{total.toLocaleString()} results</span>
      <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" size={14} /></button>
      {window.map((p) => (
        <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onPage(p)}>{p}</button>
      ))}
      <button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><Icon name="chevronRight" size={14} /></button>
    </div>
  );
}

export function FilterBar({ query, onQuery, placeholder = 'Search...', children }: {
  query: string; onQuery: (v: string) => void; placeholder?: string; children?: ReactNode;
}) {
  return (
    <div className="filter-bar">
      <Icon name="search" size={14} />
      <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} />
      {children}
      {query && (
        <button className="filter-clear" onClick={() => onQuery('')} aria-label="Clear search"><Icon name="x" size={13} /></button>
      )}
    </div>
  );
}

export function useFiltered<T>(rows: T[], query: string, keys: string[]) {
  return useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => keys.some((k) => String((r as Record<string, unknown>)[k] ?? '').toLowerCase().includes(t)));
  }, [rows, query, keys]);
}
