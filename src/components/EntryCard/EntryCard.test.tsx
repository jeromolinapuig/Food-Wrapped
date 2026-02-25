import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntryCard } from './EntryCard';

vi.mock('@mui/icons-material', () => ({
  CalendarToday: () => null,
  Delete: () => null,
  Edit: () => null,
  Star: () => null,
  StarBorder: () => null,
  StarHalf: () => null,
}));

vi.mock('../../context/PreferencesContext', () => ({
  usePreferences: () => ({
    formatCurrency: (amount: number) => `EUR ${amount.toFixed(2)}`,
  }),
}));

describe('EntryCard', () => {
  it('renderiza datos base y dispara acciones', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onPhotoClick = vi.fn();
    render(
      <EntryCard
        restaurantName="Burger Place"
        burgerName="Smash"
        datetimeText="hoy"
        meatIcon={<span>icon</span>}
        rating={4.5}
        price={12}
        currency="EUR"
        additionalNotes="nota"
        photoUrl="https://example.com/photo.jpg"
        onPhotoClick={onPhotoClick}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Burger Place')).toBeInTheDocument();
    expect(screen.getByText('Smash')).toBeInTheDocument();
    expect(screen.getByText('EUR 12.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.viewPhoto' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(onPhotoClick).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
