import { Avatar } from './Avatar';

type UserAvatarProps = {
  username?: string | null;
  displayName?: string | null;
  alt?: string;
  initial?: string;
  avatarUrl?: string | null;
  avatarFrame?: 'gold' | 'silver' | 'bronze' | null;
  size?: 'sm' | 'lg';
  className?: string;
  loading?: 'lazy' | 'eager';
};

export function UserAvatar({
  username,
  displayName,
  alt,
  initial,
  avatarUrl,
  avatarFrame = null,
  size,
  className,
  loading,
}: Readonly<UserAvatarProps>) {
  const computedInitial = (initial ?? username ?? displayName ?? '?').charAt(0).toUpperCase();
  const computedAlt = alt ?? username ?? displayName ?? 'usuario';

  return (
    <Avatar
      url={avatarUrl}
      frameKey={avatarFrame}
      alt={computedAlt}
      initial={computedInitial}
      size={size}
      className={className}
      loading={loading}
    />
  );
}
