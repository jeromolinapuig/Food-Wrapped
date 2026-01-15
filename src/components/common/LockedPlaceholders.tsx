import './LoginOverlay.css';

const PlaceholderStat = ({ label }: { label: string }) => (
  <div className="bw-stat-card">
    <div className="bw-skeleton-line bw-skeleton-short" />
    <div className="bw-skeleton-line" />
    <div className="bw-skeleton-line bw-skeleton-short" />
    <div className="bw-skeleton-line bw-skeleton-short" style={{ width: 80, opacity: 0.7 }}>
      {label}
    </div>
  </div>
);

export function DashboardPlaceholder() {
  return (
    <div className="bw-locked-placeholder">
      <section className="bw-stats-grid">
        {['Hamburguesas', 'Caseras', 'Nota', 'Favorito'].map((label) => (
          <PlaceholderStat key={label} label={label} />
        ))}
      </section>
      <section className="bw-dashboard-row">
        <div className="bw-card bw-burger-types">
          <h2 className="bw-section-title">Tipo</h2>
          <div className="bw-burger-types-row">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="bw-burger-type" key={`bt-${i}`}>
                <span className="bw-burger-type-emoji">🍔</span>
                <span className="bw-locked-pill" />
              </div>
            ))}
          </div>
        </div>
        <PlaceholderStat label="Total gastado" />
      </section>
      <section className="bw-history">
        <div className="bw-section-header">
          <h2 className="bw-section-title">Posts</h2>
        </div>
        <div className="bw-locked-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="bw-locked-list-item" key={`dash-list-${i}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function FeedPlaceholder() {
  return (
    <div className="bw-locked-placeholder">
      <div className="bw-feed-header">
        <div className="bw-feed-tabs bw-feed-tabs-duo">
          <div className="bw-feed-tab is-active">Siguiendo</div>
          <div className="bw-feed-tab">Global</div>
        </div>
      </div>
      <div className="bw-locked-list">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="bw-locked-list-item" key={`feed-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function GroupsPlaceholder() {
  return (
    <div className="bw-locked-placeholder">
      <div className="bw-locked-row">
        <div className="bw-locked-pill" />
        <div className="bw-locked-pill" />
      </div>
      <div className="bw-group-list">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="bw-group-card" key={`group-${i}`} style={{ pointerEvents: 'none' }}>
            <div className="bw-group-card-body">
              <div className="bw-group-title">Grupo</div>
              <div className="bw-group-meta">
                <span className="bw-locked-pill" style={{ width: 120 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfilePlaceholder() {
  return (
    <div className="bw-locked-placeholder">
      <div className="bw-profile-header" style={{ gap: 12 }}>
        <div className="bw-avatar bw-avatar-lg">
          <div className="bw-avatar-placeholder">?</div>
        </div>
        <div className="bw-profile-header-body">
          <div className="bw-locked-pill" style={{ width: 160 }} />
          <div className="bw-locked-pill" style={{ width: 120 }} />
        </div>
      </div>
      <div className="bw-locked-row">
        <div className="bw-locked-pill" />
        <div className="bw-locked-pill" />
        <div className="bw-locked-pill" />
      </div>
      <div className="bw-locked-list">
        {Array.from({ length: 2 }).map((_, i) => (
          <div className="bw-locked-list-item" key={`profile-${i}`} />
        ))}
      </div>
    </div>
  );
}
