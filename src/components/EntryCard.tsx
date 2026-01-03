type EntryCardProps = {
  restaurantName: string;
  burgerName?: string;
  datetimeText: string;
  meatEmoji: string;
  rating: number | null;
  price: number | null;
  onEdit?: () => void;
  onDelete?: () => void;
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
  meatEmoji,
  rating,
  price,
  onEdit,
  onDelete,
}: EntryCardProps) {
  return (
    <article className="bw-history-card">
      <div className="bw-history-top">
        <div className="bw-history-info">
          <div className="bw-history-meat-icon">{meatEmoji}</div>
          <div>
            <div className="bw-history-restaurant">{restaurantName}</div>
            {burgerName && <div className="bw-history-burger-name">{burgerName}</div>}
            <div className="bw-history-meta">
              <span className="bw-history-meta-icon">🕒</span>
              <span>{datetimeText}</span>
            </div>
          </div>
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
                ★
              </span>
            ))}
          </div>
        )}
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
            ✏️
          </button>
          <button
            className="bw-icon-button bw-icon-danger"
            title="Eliminar entrada"
            onClick={onDelete}
            disabled={!onDelete}
          >
            🗑️
          </button>
        </div>
      </div>
    </article>
  );
}
