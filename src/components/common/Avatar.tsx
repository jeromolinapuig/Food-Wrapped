type AvatarProps = {
  url?: string | null;
  alt?: string;
  initial?: string;
  size?: 'sm' | 'lg';
  frameKey?: 'gold' | 'silver' | 'bronze' | null;
  className?: string;
  imageClassName?: string;
  loading?: 'lazy' | 'eager';
};

export function Avatar({
  url,
  alt = '',
  initial = '?',
  size,
  frameKey = null,
  className,
  imageClassName,
  loading,
}: Readonly<AvatarProps>) {
  const frameSrc =
    frameKey === 'gold'
      ? '/frames/gold_frame.svg'
      : frameKey === 'silver'
        ? '/frames/silver_frame.svg'
        : frameKey === 'bronze'
          ? '/frames/bronze_frame.svg'
          : null;
  const sizeClass = size ? `bw-avatar-${size}` : '';
  const wrapClassName = ['bw-avatar-wrap', sizeClass].filter(Boolean).join(' ');
  const avatarClassName = ['bw-avatar', sizeClass, className].filter(Boolean).join(' ');
  const imgClassName = ['bw-avatar-image', imageClassName].filter(Boolean).join(' ');

  return (
    <span className={wrapClassName}>
      <div className={avatarClassName}>
        {url ? (
          <img src={url} alt={alt} className={imgClassName} loading={loading} />
        ) : (
          <div className="bw-avatar-placeholder">{initial}</div>
        )}
      </div>
      {frameSrc ? <img src={frameSrc} alt="" aria-hidden="true" className="bw-avatar-frame" /> : null}
    </span>
  );
}
