import type { ReactNode } from 'react';
import { UserAvatar } from './UserAvatar';

type UserCardProps = {
  avatarUrl?: string | null;
  avatarFrame?: 'gold' | 'silver' | 'bronze' | null;
  avatarAlt?: string;
  avatarInitial?: string;
  avatarSize?: 'sm' | 'lg';
  handle: string;
  meta?: ReactNode;
  bio?: ReactNode;
  infoExtra?: ReactNode;
  action?: ReactNode;
  className?: string;
  asButton?: boolean;
  onClick?: () => void;
  infoButton?: boolean;
  onInfoClick?: () => void;
  infoAriaLabel?: string;
};

export function UserCard({
  avatarUrl,
  avatarFrame,
  avatarAlt,
  avatarInitial,
  avatarSize = 'sm',
  handle,
  meta,
  bio,
  infoExtra,
  action,
  className,
  asButton = false,
  onClick,
  infoButton = false,
  onInfoClick,
  infoAriaLabel,
}: Readonly<UserCardProps>) {
  const containerClassName = ['bw-user-card', className].filter(Boolean).join(' ');
  const InfoTag = infoButton ? 'button' : 'div';
  const infoProps = infoButton
    ? {
        type: 'button' as const,
        className: 'bw-user-info bw-user-info-btn',
        onClick: onInfoClick,
        'aria-label': infoAriaLabel,
      }
    : { className: 'bw-user-info' };

  if (asButton) {
    return (
      <button type="button" className={containerClassName} onClick={onClick}>
        <div className="bw-user-info">
          <UserAvatar
            avatarUrl={avatarUrl}
            avatarFrame={avatarFrame}
            username={handle}
            alt={avatarAlt}
            initial={avatarInitial}
            size={avatarSize}
          />
          <div>
            <div className="bw-user-name">@{handle}</div>
            {meta ? <div className="bw-user-meta">{meta}</div> : null}
            {bio ? <div className="bw-user-bio">{bio}</div> : null}
            {infoExtra}
          </div>
        </div>
        {action}
      </button>
    );
  }

  return (
    <div className={containerClassName}>
      <InfoTag {...infoProps}>
        <UserAvatar
          avatarUrl={avatarUrl}
          avatarFrame={avatarFrame}
          username={handle}
          alt={avatarAlt}
          initial={avatarInitial}
          size={avatarSize}
        />
        <div>
          <div className="bw-user-name">@{handle}</div>
          {meta ? <div className="bw-user-meta">{meta}</div> : null}
          {bio ? <div className="bw-user-bio">{bio}</div> : null}
          {infoExtra}
        </div>
      </InfoTag>
      {action}
    </div>
  );
}
