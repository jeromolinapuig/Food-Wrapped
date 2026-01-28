import type { FeedTab, MonthOption } from './types';
import { useTranslation } from 'react-i18next';

type FeedHeaderProps = {
  hideHeader: boolean;
  isUserFeed: boolean;
  isCustomList: boolean;
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  isReadOnly: boolean;
  authNotice: string | null;
  onAuthNoticeChange: (value: string | null) => void;
  effectiveMonthFilter: string;
  onMonthFilterChange: (value: string) => void;
  monthOptions: MonthOption[];
};

export function FeedHeader({
  hideHeader,
  isUserFeed,
  isCustomList,
  activeTab,
  onTabChange,
  isReadOnly,
  authNotice,
  onAuthNoticeChange,
  effectiveMonthFilter,
  onMonthFilterChange,
  monthOptions,
}: Readonly<FeedHeaderProps>) {
  const { t } = useTranslation();
  return (
    <>
      {!hideHeader && !isUserFeed && !isCustomList && (
        <div className="bw-feed-header">
          <div className="bw-feed-tabs bw-feed-tabs-duo" style={{ margin: '0 auto' }}>
            <button
              type="button"
              className={`bw-feed-tab ${activeTab === 'following' ? 'is-active' : ''}`}
              onClick={() => {
                if (isReadOnly) {
                  onAuthNoticeChange(t('feedTabs.lockedFollowing'));
                } else {
                  onAuthNoticeChange(null);
                }
                onTabChange('following');
              }}
            >
              {t('feedTabs.following', { defaultValue: 'Following' })}
            </button>
            <button
              type="button"
              className={`bw-feed-tab ${activeTab === 'global' ? 'is-active' : ''}`}
              onClick={() => {
                onAuthNoticeChange(null);
                onTabChange('global');
              }}
            >
              {t('feedTabs.global', { defaultValue: 'Global' })}
            </button>
          </div>
        </div>
      )}

      {authNotice && !hideHeader && (
        <p className="bw-helper" style={{ textAlign: 'center', marginTop: -6 }}>{authNotice}</p>
      )}

      {!hideHeader && (isUserFeed || isCustomList) && (
        <div className="bw-feed-filter bw-feed-filter-inline">
          <div className="bw-select-wrap">
            <select
              id="bw-user-feed-month"
              className="bw-select bw-select-compact"
              value={effectiveMonthFilter}
              onChange={(e) => onMonthFilterChange(e.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'all' ? t('feedTabs.all') : option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
