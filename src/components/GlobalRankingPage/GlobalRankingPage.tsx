import { Euro, LunchDining } from '@mui/icons-material';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabaseClient';
import { useRevalidateOnFocus } from '../../utils/useRevalidateOnFocus';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../StatCard/StatCard';
import { UserProfileModal } from '../UserProfileModal/UserProfileModal';
import '../../styles/layout.css';
import '../../styles/shared.css';
import '../Dashboard/Dashboard.css';
import '../GroupPage/GroupPage.css';
import './GlobalRankingPage.css';

type GlobalRankingPageProps = {
  session: Session;
};

type RankingEntryRow = {
  user_id: string;
  datetime: string;
  price: number | null;
  is_burger: boolean;
};

type RankingMember = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type MonthOption = {
  value: string;
  label: string;
};

export function GlobalRankingPage({ session }: Readonly<GlobalRankingPageProps>) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<RankingEntryRow[]>([]);
  const [members, setMembers] = useState<RankingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState('all');
  const [rankingMetric, setRankingMetric] = useState<'spent' | 'burgers'>('spent');
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);

  const loadRanking = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = '2026-01-01';
    const to = '2027-01-01';

    const { data: entriesData, error: entriesError } = await supabase
      .from('entries')
      .select('user_id, datetime, price, is_burger')
      .eq('visibility', 'public')
      .gte('datetime', from)
      .lt('datetime', to)
      .order('datetime', { ascending: false });

    if (entriesError) {
      setError(entriesError.message);
      setEntries([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    const nextEntries = (entriesData ?? []) as RankingEntryRow[];
    const userIds = Array.from(new Set(nextEntries.map((entry) => entry.user_id)));

    if (!userIds.length) {
      setEntries([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      setError(profilesError.message);
      setEntries(nextEntries);
      setMembers([]);
      setLoading(false);
      return;
    }

    const profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();
    (profilesData ?? []).forEach((profile) => {
      profileMap.set((profile as { id: string }).id, {
        username: (profile as { username: string | null }).username,
        display_name: (profile as { display_name: string | null }).display_name,
        avatar_url: (profile as { avatar_url: string | null }).avatar_url,
      });
    });

    const mappedMembers: RankingMember[] = userIds.map((id) => {
      const profile = profileMap.get(id);
      return {
        id,
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      };
    });

    setEntries(nextEntries);
    setMembers(mappedMembers);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadRanking();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRanking]);

  useRevalidateOnFocus(
    () => {
      loadRanking();
    },
    [loadRanking],
    { minIntervalMs: 180000, maxStaleMs: 900000, debounceMs: 500 }
  );

  const monthOptions = useMemo<MonthOption[]>(() => {
    const localeMap: Record<string, string> = {
      es: 'es-ES',
      th: 'th-TH',
      fr: 'fr-FR',
      it: 'it-IT',
      de: 'de-DE',
      en: 'en-US',
    };
    const locale = localeMap[i18n.language as keyof typeof localeMap] ?? 'en-US';
    const seen = new Set<string>();
    entries.forEach((entry) => {
      const date = new Date(entry.datetime);
      if (Number.isNaN(date.getTime())) return;
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      seen.add(value);
    });
    const values = Array.from(seen).sort((a, b) => b.localeCompare(a));
    const options: MonthOption[] = [{ value: 'all', label: t('feedTabs.all') }];
    values.forEach((value) => {
      const [yearStr, monthStr] = value.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (Number.isNaN(year) || Number.isNaN(month)) return;
      const date = new Date(year, month - 1, 1);
      const label = year === new Date().getFullYear()
        ? date.toLocaleString(locale, { month: 'long' })
        : date.toLocaleString(locale, { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    });
    return options;
  }, [entries, t]);

  const filteredEntries = useMemo(() => {
    if (monthFilter === 'all') return entries;
    const [yearStr, monthStr] = monthFilter.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (Number.isNaN(year) || Number.isNaN(month)) return entries;
    return entries.filter((entry) => {
      const date = new Date(entry.datetime);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
  }, [entries, monthFilter]);

  const rankingRows = useMemo(() => {
    const base = new Map<string, { spent: number; burgers: number }>();
    const lastEatenMap = new Map<string, number>();
    members.forEach((member) => {
      base.set(member.id, { spent: 0, burgers: 0 });
    });

    const activeUserIds = new Set(filteredEntries.map((entry) => entry.user_id));
    filteredEntries.forEach((entry) => {
      const current = base.get(entry.user_id) ?? { spent: 0, burgers: 0 };
      current.spent += entry.price ?? 0;
      if (entry.is_burger) current.burgers += 1;
      base.set(entry.user_id, current);
      const entryTime = new Date(entry.datetime).getTime();
      const prevTime = lastEatenMap.get(entry.user_id);
      if (prevTime === undefined || entryTime > prevTime) {
        lastEatenMap.set(entry.user_id, entryTime);
      }
    });

    const rows = members
      .filter((member) => activeUserIds.has(member.id))
      .map((member) => {
        const totals = base.get(member.id) ?? { spent: 0, burgers: 0 };
        return {
          ...member,
          totalSpent: totals.spent,
          totalBurgers: totals.burgers,
          lastEaten: lastEatenMap.get(member.id) ?? 0,
          rank: 0,
        };
      });

    rows.sort((a, b) => {
      const primary =
        rankingMetric === 'spent'
          ? b.totalSpent - a.totalSpent
          : b.totalBurgers - a.totalBurgers;
      if (primary !== 0) return primary;
      return a.lastEaten - b.lastEaten;
    });

    let lastValue: number | null = null;
    let lastRank = 0;
    rows.forEach((row, index) => {
      const metricValue = rankingMetric === 'spent' ? row.totalSpent : row.totalBurgers;
      const canShare = index < 3;
      const rank = canShare && lastValue !== null && metricValue === lastValue ? lastRank : index + 1;
      if (lastValue === null || metricValue !== lastValue) {
        lastValue = metricValue;
        lastRank = rank;
      }
      row.rank = rank;
    });

    return rows;
  }, [filteredEntries, members, rankingMetric]);

  const renderMedal = (index: number) => {
    if (index === 0) return { src: '/gold_medal.png', alt: t('common.goldMedal', { defaultValue: 'Medalla de oro' }) };
    if (index === 1) return { src: '/silver_medal.png', alt: t('common.silverMedal', { defaultValue: 'Medalla de plata' }) };
    if (index === 2) return { src: '/bronze_medal.png', alt: t('common.bronzeMedal', { defaultValue: 'Medalla de bronce' }) };
    return null;
  };

  return (
    <AppShell>
      <PageHeader
        title={t('common.globalRanking', { defaultValue: 'Ranking global' })}
        subtitle={t('common.globalRankingSubtitle', { defaultValue: 'Descubre a los mejores de la comunidad.' })}
        logoAlt="Burger Wrapped"
      />

      <main className="bw-main">
        <section className="bw-stats-grid">
          <StatCard
            icon={<Euro fontSize="small" />}
            value=""
            label={t('groups.totalSpent')}
            onClick={() => setRankingMetric('spent')}
            isActive={rankingMetric === 'spent'}
          />
          <StatCard
            icon={<LunchDining fontSize="small" />}
            value=""
            label={t('groups.burgers')}
            onClick={() => setRankingMetric('burgers')}
            isActive={rankingMetric === 'burgers'}
          />
        </section>

        <section className="bw-history">
          <div className="bw-section-header">
            <h2 className="bw-section-title">{t('groups.ranking')}</h2>
            <div className="bw-section-right">
              <div className="bw-feed-filter bw-feed-filter-inline">
                <div className="bw-select-wrap">
                  <select
                    id="bw-global-ranking-month"
                    className="bw-select bw-select-compact"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && <p style={{ color: 'red', fontSize: 12 }}>{error}</p>}

          <div className="bw-ranking-list">
            {!loading && !rankingRows.length && (
              <div className="bw-ranking-empty">{t('groups.noData')}</div>
            )}
            {rankingRows.map((member, index) => {
              const label = member.displayName || member.username || 'usuario';
              const value =
                rankingMetric === 'spent'
                  ? `${member.totalSpent.toFixed(2)}\u20AC`
                  : `${member.totalBurgers}`;
              const medal = renderMedal(index);
              return (
                <button
                  type="button"
                  className="bw-ranking-item"
                  key={member.id}
                  onClick={() => setProfileModalUserId(member.id)}
                >
                  <div className="bw-ranking-left">
                    <div className={`bw-ranking-index ${medal ? 'has-medal' : ''}`}>
                      {medal ? (
                        <img className="bw-ranking-medal" src={medal.src} alt={medal.alt} />
                      ) : (
                        member.rank
                      )}
                    </div>
                    <div className="bw-ranking-avatar">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={label} />
                      ) : (
                        <span>{label.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="bw-ranking-name">{label}</div>
                  </div>
                  <div className="bw-ranking-value">{value}</div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <UserProfileModal
        open={Boolean(profileModalUserId)}
        userId={profileModalUserId}
        session={session}
        onClose={() => setProfileModalUserId(null)}
      />
    </AppShell>
  );
}
