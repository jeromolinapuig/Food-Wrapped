import { startTransition, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, CssBaseline, ThemeProvider } from '@mui/material';
import { Star, StarBorder, StarHalf } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { createAppTheme } from '../../theme';
import { lockBodyScroll } from '../../utils/scrollLock';
import type { FeedEntry } from './types';

type TriedBurgerModalProps = {
  open: boolean;
  entry: FeedEntry | null;
  theme?: 'light' | 'dark';
  initialRating?: number | null;
  canDelete?: boolean;
  onClose: () => void;
  onSave: (value: {
    entry: FeedEntry;
    rating: number;
  }) => Promise<void> | void;
  onDelete?: (entry: FeedEntry) => Promise<void> | void;
};

type RatingPickerProps = {
  value: number | null;
  onChange: (value: number) => void;
  color: string;
  emptyColor: string;
  label: string;
};

function RatingPicker({ value, onChange, color, emptyColor, label }: RatingPickerProps) {
  return (
    <div className="bw-rating-picker" role="group" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const isFull = value != null && value >= starValue;
        const isHalf = value != null && value >= starValue - 0.5 && value < starValue;
        const Icon = isFull ? Star : isHalf ? StarHalf : StarBorder;

        return (
          <span className="bw-rating-star" key={starValue}>
            <Icon
              className="bw-rating-icon"
              aria-hidden="true"
              sx={{ color: isFull || isHalf ? color : emptyColor }}
            />
            <button
              className="bw-rating-half bw-rating-half-left"
              type="button"
              aria-label={`${label} ${(starValue - 0.5).toFixed(1)}`}
              aria-pressed={value === starValue - 0.5}
              onClick={() => onChange(starValue - 0.5)}
            />
            <button
              className="bw-rating-half bw-rating-half-right"
              type="button"
              aria-label={`${label} ${starValue.toFixed(1)}`}
              aria-pressed={value === starValue}
              onClick={() => onChange(starValue)}
            />
          </span>
        );
      })}
    </div>
  );
}

export function TriedBurgerModal({
  open,
  entry,
  theme = 'light',
  initialRating = null,
  canDelete = false,
  onClose,
  onSave,
  onDelete,
}: Readonly<TriedBurgerModalProps>) {
  const { t } = useTranslation();
  const [ratingInput, setRatingInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { colors, muiTheme } = useMemo(() => createAppTheme(theme), [theme]);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      setRatingInput(initialRating != null ? String(initialRating) : '');
      setError(null);
      setSaving(false);
    });
  }, [entry, initialRating, open]);

  if (!open || !entry) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const rating = Number(ratingInput);

    if (!ratingInput || Number.isNaN(rating) || rating < 0.5 || rating > 5) {
      setError(t('burgerWishlist.ratingRequired'));
      return;
    }

    setSaving(true);
    await onSave({
      entry,
      rating,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!entry || !onDelete) return;
    setSaving(true);
    await onDelete(entry);
    setSaving(false);
    onClose();
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className="bw-modal-backdrop is-open" onClick={onClose}>
        <div className="bw-modal bw-tried-modal is-open" onClick={(event) => event.stopPropagation()}>
          <div className="bw-modal-header">
            <div>
              <h2 className="bw-modal-title">{t('burgerWishlist.triedTitle')}</h2>
              <p className="bw-modal-subtitle">
                {entry.burgerName} · {entry.restaurantName}
              </p>
            </div>
            <Button variant="outlined" size="small" onClick={onClose} disabled={saving}>
              {t('common.close')}
            </Button>
          </div>

          <form className="bw-modal-form" onSubmit={handleSubmit}>
            <div className="bw-modal-fields">
              <div className="bw-field">
                <span className="bw-label">{t('burgerWishlist.ratingLabel')}</span>
                <RatingPicker
                  value={ratingInput ? Number(ratingInput) : null}
                  onChange={(value) => setRatingInput(String(value))}
                  color={colors.accent}
                  emptyColor={colors.textMuted}
                  label={t('burgerWishlist.ratingLabel')}
                />
              </div>

              {error && <p className="bw-helper bw-error-text">{error}</p>}
            </div>

            <div className="bw-modal-actions">
              {canDelete && onDelete ? (
                <Button type="button" variant="outlined" color="error" onClick={() => void handleDelete()} disabled={saving}>
                  {t('common.delete')}
                </Button>
              ) : (
                <Button type="button" variant="outlined" onClick={onClose} disabled={saving}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? t('burgerWishlist.saving') : t('burgerWishlist.saveTried')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ThemeProvider>
  );
}
