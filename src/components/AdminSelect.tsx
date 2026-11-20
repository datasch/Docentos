import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface AdminSelectOption { value: string; label: string; hint?: string; group?: string }

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
  /** En hojas con scroll interno la lista se abre dentro del flujo, para que nada la recorte. */
  inline?: boolean;
}

/** Selector con el mismo diseño que el resto del panel: botón, lista con marca de selección y teclado completo. */
export function AdminSelect({ id, value, onChange, options, placeholder = 'Selecciona una opción', disabled = false, required = false, ariaLabel, className = '', inline = false }: Props) {
  const autoId = useId();
  const triggerId = id || `admin-select-${autoId}`;
  const listId = `${triggerId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    if (disabled || options.length === 0) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    setUp(!inline && !!rect && window.innerHeight - rect.bottom < 300 && rect.top > window.innerHeight - rect.bottom);
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };
  const close = (focus = true) => { setOpen(false); if (focus) triggerRef.current?.focus(); };
  const choose = (index: number) => { const option = options[index]; if (!option) return; onChange(option.value); close(); };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); show(); }
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') setOpen(false);
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
    else if (event.key.length === 1) {
      const next = options.findIndex((option, i) => i > active && option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      const first = next >= 0 ? next : options.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (first >= 0) setActive(first);
    }
  };

  let lastGroup: string | undefined;
  return (
    <div className={`admin-select ${className}`} data-open={open || undefined} data-up={up || undefined} data-inline={inline || undefined} ref={rootRef}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="admin-select__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${triggerId}-opt-${active}` : undefined}
        disabled={disabled}
        data-empty={!selected || undefined}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="admin-select__value">{selected ? <>{selected.hint && <small>{selected.hint}</small>}{selected.label}</> : placeholder}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {required && <input className="admin-select__required" tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} onFocus={() => triggerRef.current?.focus()} />}
      {open && (
        <ul ref={listRef} id={listId} className="admin-select__list" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const header = option.group && option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return (
              <li key={option.value + index} role="presentation">
                {header && <span className="admin-select__group" role="presentation">{header}</span>}
                <div
                  id={`${triggerId}-opt-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === active || undefined}
                  className="admin-select__option"
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.hint && <small>{option.hint}</small>}{option.label}</span>
                  {option.value === value && <Check aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
