import {
  BookmarksOutlined,
  CalendarMonthOutlined,
  ChevronRight,
  EmojiEventsOutlined,
  GroupsOutlined,
  PlaylistAddOutlined,
  WorkspacePremiumOutlined,
} from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './MorePage.css';

type MorePageProps = {
  session: Session;
};

type MoreItem = {
  key: string;
  titleKey: string;
  descriptionKey: string;
  path: string;
  icon: ReactNode;
  badge?: 'new';
  invitationIndicator?: boolean;
};

const PERSONAL_ITEMS: MoreItem[] = [
  {
    key: 'calendar',
    titleKey: 'more.calendarTitle',
    descriptionKey: 'more.calendarDescription',
    path: '/burger-calendar',
    icon: <CalendarMonthOutlined />,
  },
  {
    key: 'top-burgers',
    titleKey: 'more.topBurgersTitle',
    descriptionKey: 'more.topBurgersDescription',
    path: '/my-top-burgers',
    icon: <WorkspacePremiumOutlined />,
  },
  {
    key: 'wishlist',
    titleKey: 'more.wishlistTitle',
    descriptionKey: 'more.wishlistDescription',
    path: '/burger-wishlist',
    icon: <PlaylistAddOutlined />,
    badge: 'new',
  },
  {
    key: 'saved',
    titleKey: 'more.savedTitle',
    descriptionKey: 'more.savedDescription',
    path: '/saved',
    icon: <BookmarksOutlined />,
  },
];

const SOCIAL_ITEMS: MoreItem[] = [
  {
    key: 'groups',
    titleKey: 'more.groupsTitle',
    descriptionKey: 'more.groupsDescription',
    path: '/groups',
    icon: <GroupsOutlined />,
    invitationIndicator: true,
  },
  {
    key: 'ranking',
    titleKey: 'more.rankingTitle',
    descriptionKey: 'more.rankingDescription',
    path: '/ranking',
    icon: <EmojiEventsOutlined />,
  },
];

type MoreCardProps = {
  item: MoreItem;
  variant: 'compact' | 'wide';
  inviteCount: number;
};

function MoreCard({ item, variant, inviteCount }: Readonly<MoreCardProps>) {
  const { t } = useTranslation();
  const showInvites = Boolean(item.invitationIndicator && inviteCount > 0);

  return (
    <Link className={`bw-more-card is-${variant}`} to={item.path}>
      <span className="bw-more-card-icon" aria-hidden="true">{item.icon}</span>
      <span className="bw-more-card-content">
        <span className="bw-more-card-title">{t(item.titleKey)}</span>
        <span className="bw-more-card-description">{t(item.descriptionKey)}</span>
      </span>
      {item.badge === 'new' ? (
        <span className="bw-more-new-badge">{t('more.newBadge')}</span>
      ) : null}
      {showInvites ? (
        <span
          className="bw-more-invite-badge"
          aria-label={t('more.pendingInvitations', { count: inviteCount })}
        >
          {inviteCount}
        </span>
      ) : null}
      <ChevronRight className="bw-more-card-chevron" aria-hidden="true" />
    </Link>
  );
}

export function MorePage({ session }: Readonly<MorePageProps>) {
  const { t } = useTranslation();
  const [inviteCount, setInviteCount] = useState(0);

  const loadInvites = useCallback(async () => {
    const { count, error } = await supabase
      .from('group_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_id', session.user.id);

    setInviteCount(error ? 0 : count ?? 0);
  }, [session.user.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInvites();
    }, 0);
    const handleInvitesUpdated = () => void loadInvites();
    window.addEventListener('bw-invites-updated', handleInvitesUpdated);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('bw-invites-updated', handleInvitesUpdated);
    };
  }, [loadInvites]);

  useRevalidateOnFocus(
    () => {
      void loadInvites();
    },
    [loadInvites],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

  return (
    <AppShell>
      <PageHeader title={t('more.title')} />
      <main className="bw-main bw-more-page">
        <section className="bw-more-section" aria-labelledby="bw-more-personal-title">
          <h2 id="bw-more-personal-title">{t('more.personalSection')}</h2>
          <div className="bw-more-grid is-personal">
            {PERSONAL_ITEMS.map((item) => (
              <MoreCard key={item.key} item={item} variant="compact" inviteCount={inviteCount} />
            ))}
          </div>
        </section>

        <section className="bw-more-section" aria-labelledby="bw-more-social-title">
          <h2 id="bw-more-social-title">{t('more.socialSection')}</h2>
          <div className="bw-more-grid is-social">
            {SOCIAL_ITEMS.map((item) => (
              <MoreCard key={item.key} item={item} variant="wide" inviteCount={inviteCount} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
