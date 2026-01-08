import type { ReactNode } from 'react';
import {
  CalendarToday,
  Delete,
  Edit,
  Star,
  StarBorder,
  StarHalf,
} from '@mui/icons-material';
import '../../styles/shared.css';
import './EntryCard.css';

type EntryCardProps = {
  restaurantName: string;
  burgerName?: string;
  datetimeText: string;
  meatIcon: ReactNode;
  rating: number | null;
  price: number | null;
  additionalNotes?: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
  photoUrl?: string | null;
  onPhotoClick?: () => void;
};

const renderStars = (rating: number) =>
  Array.from({ length: 5 }, (_v, i) => ({
    filled: rating >= i + 1,
    half: rating >= i + 0.5 && rating < i + 1,
  }));

export function EntryCard({
  restaurantName,
  burgerName,
  datetimeText,
  meatIcon,
  rating,
  price,
  additionalNotes,
  onEdit,
  onDelete,
  photoUrl,
  onPhotoClick,
}: EntryCardProps) {
  return (
    <article className="bw-history-card">
      <div className="bw-history-header">
        <div className="bw-history-title">
          <div className="bw-history-meat-icon">{meatIcon}</div>
          <div className="bw-history-restaurant">{restaurantName}</div>
        </div>
        {rating != null && (
          <div className="bw-history-rating-stars">
            {renderStars(rating).map((star, idx) => (
              <span
                key={idx}
                className={`bw-history-star ${
                  star.filled ? 'is-filled' : star.half ? 'is-half' : 'is-empty'
                }`}
              >
                {star.filled ? <Star fontSize="small" /> : star.half ? <StarHalf fontSize="small" /> : <StarBorder fontSize="small" />}
              </span>
            ))}
          </div>
        )}
      </div>

      {photoUrl && (
        <button
          type="button"
          className="bw-history-photo-large"
          onClick={onPhotoClick}
          aria-label="Ver foto"
        >
          <img src={photoUrl} alt={burgerName ?? restaurantName} />
        </button>
      )}

      {burgerName && <div className="bw-history-burger-name">{burgerName}</div>}

      {additionalNotes ? (
        <p style={{ fontSize: 13, lineHeight: 1.4, marginTop: 6, whiteSpace: 'pre-line' }}>
          {additionalNotes}
        </p>
      ) : null}

      <div className="bw-history-meta">
        <span className="bw-history-meta-icon">
          <CalendarToday fontSize="small" />
        </span>
        <span>{datetimeText}</span>
      </div>

      <div className="bw-history-footer">
        <div className="bw-history-price">€ {price != null ? price.toFixed(2) : '-'}</div>
        <div className="bw-history-actions">
          <button
            className="bw-icon-button"
            title="Editar entrada"
            onClick={onEdit}
            disabled={!onEdit}
          >
            <Edit fontSize="small" />
          </button>
          <button
            className="bw-icon-button bw-icon-danger"
            title="Eliminar entrada"
            onClick={onDelete}
            disabled={!onDelete}
          >
            <Delete fontSize="small" />
          </button>
        </div>
      </div>
    </article>
  );
}
