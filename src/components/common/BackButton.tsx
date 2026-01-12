type BackButtonProps = {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
};

export function BackButton({
  onClick,
  ariaLabel = 'Volver',
  className,
}: Readonly<BackButtonProps>) {
  return (
    <button
      type="button"
      className={className ? `bw-back-button ${className}` : 'bw-back-button'}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
      </svg>
    </button>
  );
}
