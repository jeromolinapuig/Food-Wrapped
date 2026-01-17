import type { FeedTab, MonthOption } from './types';

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
                  onAuthNoticeChange('Inicia sesion para ver el feed de la gente a la que sigues.');
                } else {
                  onAuthNoticeChange(null);
                }
                onTabChange('following');
              }}
            >
              Siguiendo
            </button>
            <button
              type="button"
              className={`bw-feed-tab ${activeTab === 'global' ? 'is-active' : ''}`}
              onClick={() => {
                onAuthNoticeChange(null);
                onTabChange('global');
              }}
            >
              Global
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
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
