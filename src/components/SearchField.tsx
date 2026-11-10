import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}

export function SearchField({ value, onChange, label, placeholder, className = '' }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`academy-search-field ${className}`}>
      <Search size={18} aria-hidden="true" />
      <input ref={inputRef} type="search" value={value} onChange={event => onChange(event.target.value)}
        aria-label={label} placeholder={placeholder} className="academy-compound-input" />
      {value && (
        <button type="button" aria-label="Limpiar búsqueda" onClick={event => {
          onChange('');
          if (event.detail === 0) inputRef.current?.focus();
        }}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
