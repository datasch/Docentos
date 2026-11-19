import { useEffect, useRef, useState } from 'react';
import type { KeyboardEventHandler } from 'react';
import { X, Check, Search, SlidersHorizontal } from 'lucide-react';

/** Piezas comunes de las listas del admin: filtro único, chips, paginación y vista lista/tarjetas. */

export function AdminSearchField({ value, onChange, placeholder, label, className = 'mentor-mentee-search', autoFocus = false, onKeyDown }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`admin-search-field ${className}`}>
      <Search aria-hidden="true" />
      <input ref={inputRef} type="search" value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} aria-label={label} autoFocus={autoFocus} />
      {value !== '' && (
        <button type="button" className="admin-search-field__clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda" onClick={() => { onChange(''); inputRef.current?.focus(); }}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const pageList = (cur: number, total: number): Array<number | '…'> => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total));
  const out: Array<number | '…'> = [];
  [...set].sort((a, b) => a - b).forEach((n, i, arr) => {
    if (i > 0 && n - arr[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
};

export function Pager({ total, size, page, onPage, noun }: { total: number; size: number; page: number; onPage: (n: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav className="admin-pager" aria-label={`Paginación de ${noun}`}>
      <span className="admin-pager__range" role="status">{from}–{to} de {total} {noun}</span>
      <div className="admin-pager__pages">
        <button type="button" className="mentor-course-control" onClick={() => onPage(page - 1)} disabled={page <= 1}>Anterior</button>
        {pageList(page, pages).map((n, i) =>
          n === '…' ? <span key={`gap${i}`} aria-hidden="true" className="admin-pager__gap">…</span> : (
            <button key={n} type="button" className="mentor-course-control admin-pager__num" aria-current={n === page ? 'page' : undefined} aria-label={`Página ${n}`} onClick={() => onPage(n)}>{n}</button>
          ),
        )}
        <button type="button" className="mentor-course-control" onClick={() => onPage(page + 1)} disabled={page >= pages}>Siguiente</button>
      </div>
    </nav>
  );
}

export type Opt = { value: string; label: string; count?: number };

export type Group = { value: string; options: Opt[]; onChange: (v: string) => void };

/** Un solo filtro: botón con panel; cada grupo es de selección única y se quita volviendo a tocarlo. */
export function FilterMenu({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const active = groups.filter((g) => g.value !== 'ALL').length;
  return (
    <div className="admin-filter-menu" ref={ref}>
      <button type="button" className="admin-filter-menu__btn" aria-label={active > 0 ? `Filtros, ${active} activos` : 'Filtros'} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} data-active={active > 0 || undefined}>
        <SlidersHorizontal aria-hidden="true" />
        <span className="admin-filter-menu__label">Filtros</span>
        {active > 0 && <span className="admin-filter-menu__badge">{active}</span>}
      </button>
      {open && (
        <div className="admin-filter-menu__panel">
          {groups.map((g, i) => (
            <div key={i} className="admin-filter-menu__group" role="group">
              {g.options.map((o) => (
                <button key={o.value} type="button" aria-pressed={g.value === o.value} onClick={() => g.onChange(g.value === o.value ? 'ALL' : o.value)}>
                  <Check aria-hidden="true" />
                  <span>{o.label}</span>
                  {o.count !== undefined && <span className="admin-filter-menu__count">{o.count}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActiveFilters({ chips, shown, total, noun, onClear }: { chips: Array<{ key: string; text: string; onRemove: () => void }>; shown?: number; total?: number; noun: string; onClear: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="admin-chips" role="status">
      {chips.map((c) => (
        <button key={c.key} type="button" className="admin-chip" onClick={c.onRemove} aria-label={`Quitar filtro ${c.text}`}>
          {c.text}
          <X aria-hidden="true" />
        </button>
      ))}
      <button type="button" className="admin-chips__clear" onClick={onClear}>Limpiar</button>
      {shown !== undefined && total !== undefined && <span className="admin-chips__count">{shown} de {total} {noun}</span>}
    </div>
  );
}


/** Vista lista/tarjetas guardada por módulo; en móvil solo hay tarjetas y la preferencia de escritorio no se pisa. */
export function useListView(storageKey: string) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [stored, setStored] = useState<'list' | 'cards'>(() => {
    try { return localStorage.getItem(storageKey) === 'cards' ? 'cards' : 'list'; } catch { return 'list'; }
  });
  const change = (v: 'list' | 'cards') => {
    setStored(v);
    try { localStorage.setItem(storageKey, v); } catch { /* la vista solo dura esta sesión */ }
  };
  return { isMobile, view: isMobile ? ('cards' as const) : stored, change };
}
