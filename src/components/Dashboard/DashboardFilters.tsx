import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MultiSelectOption<T extends string> = {
  value: T;
  label: string;
  icon?: string;
};

export function DashboardMultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
  onOpenChange,
}: Readonly<{
  label: string;
  options: MultiSelectOption<T>[];
  selected: T[];
  onChange: (value: T[]) => void;
  onOpenChange?: (open: boolean) => void;
}>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const allValue = 'all' as T;
  const isAllSelected = selected.includes(allValue);
  const concreteSelected = selected.filter((value) => value !== allValue);
  const selectedLabels = options
    .filter((option) => concreteSelected.includes(option.value))
    .map((option) => option.label);
  const displayLabel = isAllSelected
    ? label
    : selectedLabels.length <= 2
      ? selectedLabels.join(', ')
      : `${selectedLabels[0]} +${selectedLabels.length - 1}`;

  useEffect(() => {
    onOpenChange?.(open);
    return () => {
      if (open) onOpenChange?.(false);
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 280;
      const viewportPadding = 8;
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - menuWidth - viewportPadding
      );
      setMenuPosition({
        top: rect.bottom + 8,
        left,
        maxHeight: Math.max(180, window.innerHeight - rect.bottom - 24),
      });
    };
    updateMenuPosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const toggleOption = (value: T) => {
    if (value === allValue) {
      onChange([allValue]);
      return;
    }
    const next = isAllSelected
      ? [value]
      : selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...concreteSelected, value];
    onChange(next.length ? next : [allValue]);
  };

  return (
    <div className="bw-dashboard-multiselect" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`bw-dashboard-multiselect-trigger ${open ? 'is-open' : ''} ${isAllSelected ? '' : 'is-active'}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="bw-dashboard-multiselect-label">{displayLabel}</span>
        <span className="bw-dashboard-multiselect-chevron" aria-hidden="true" />
      </button>
      {open && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="bw-dashboard-multiselect-menu"
          role="listbox"
          aria-multiselectable="true"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          {options.map((option) => {
            const checked = option.value === allValue ? isAllSelected : !isAllSelected && selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`bw-dashboard-multiselect-option ${checked ? 'is-selected' : ''}`}
                onClick={() => toggleOption(option.value)}
                role="option"
                aria-selected={checked}
              >
                <span className="bw-dashboard-multiselect-check" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                {option.icon && <img src={option.icon} alt="" aria-hidden="true" />}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
