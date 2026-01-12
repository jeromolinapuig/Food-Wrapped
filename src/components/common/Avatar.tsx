type AvatarProps = {
  url?: string | null;
  alt?: string;
  initial?: string;
  size?: 'sm' | 'lg';
  className?: string;
  imageClassName?: string;
  loading?: 'lazy' | 'eager';
};

export function Avatar({
  url,
  alt = '',
  initial = '?',
  size,
  className,
  imageClassName,
  loading,
}: Readonly<AvatarProps>) {
  const sizeClass = size ? `bw-avatar-${size}` : '';
  const avatarClassName = ['bw-avatar', sizeClass, className].filter(Boolean).join(' ');
  const imgClassName = ['bw-avatar-image', imageClassName].filter(Boolean).join(' ');

  return (
    <div className={avatarClassName}>
      {url ? (
        <img src={url} alt={alt} className={imgClassName} loading={loading} />
      ) : (
        <div className="bw-avatar-placeholder">{initial}</div>
      )}
    </div>
  );
}
