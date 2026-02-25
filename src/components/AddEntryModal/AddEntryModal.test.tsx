import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddEntryModal } from './AddEntryModal';

vi.mock('react-image-crop', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  convertToPixelCrop: vi.fn(),
}));

vi.mock('@mui/material', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  CssBaseline: () => null,
  TextField: ({
    id,
    label,
    value,
    onChange,
    select,
    children,
  }: {
    id?: string;
    label?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    select?: boolean;
    children?: ReactNode;
  }) => (
    <label>
      {label}
      {select ? (
        <select id={id} value={value} onChange={(e) => onChange?.({ target: { value: e.target.value } })}>
          {children}
        </select>
      ) : (
        <input id={id} value={value} onChange={(e) => onChange?.({ target: { value: e.target.value } })} />
      )}
    </label>
  ),
  ThemeProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Rating: () => <div>rating</div>,
  MenuItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({ currency: 'EUR' }),
}));

vi.mock('../../theme', () => ({
  createAppTheme: () => ({
    colors: { accent: '#f0f', textMuted: '#999' },
    muiTheme: {},
  }),
}));

describe('AddEntryModal', () => {
  it('no renderiza cuando está cerrado', () => {
    render(
      <AddEntryModal
        open={false}
        onClose={() => {}}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );
    expect(screen.queryByText('addEntry.titleCreate')).not.toBeInTheDocument();
  });

  it('permite cerrar modal desde botón de cierre', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <AddEntryModal
        open
        onClose={onClose}
        onSaved={() => {}}
        session={{ user: { id: 'u1' } } as never}
        theme="light"
        mode="create"
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'common.close' })[0] as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
