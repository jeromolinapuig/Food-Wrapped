import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PublicIcon from '@mui/icons-material/Public';
import RestoreIcon from '@mui/icons-material/Restore';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../common/AppShell';
import './LandingPage.css';

type LandingPageProps = {
  onLogin: () => void;
};

export function LandingPage({ onLogin }: Readonly<LandingPageProps>) {
  const { t } = useTranslation();
  return (
    <AppShell>
      <main className="bw-main landing-main">
        <div className="landing-body">
          <div className="landing-hero">
            <div className="landing-logo-wrap">
              <img src="/logo.png" alt="Burger Wrapped" className="landing-logo" />
            </div>
            <h1 className="landing-title">Burger Wrapped</h1>
            <p className="landing-subtitle">{t('landing.subtitle')}</p>
            <p className="landing-lead">
              {t('landing.lead')}
            </p>
            <div className="landing-actions">
              <button type="button" className="landing-btn landing-btn-primary" onClick={onLogin}>
                {t('landing.cta')}
              </button>
            </div>
            <p className="landing-note">{t('landing.note')}</p>
            <p className="landing-legal">
              <a href="/privacy">{t('landing.privacy')}</a>
            </p>
          </div>

          <section id="features" className="landing-section">
            <h2 className="landing-section-title">{t('landing.featuresTitle')}</h2>
            <div className="landing-feature-list">
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <BarChartIcon fontSize="small" />
                </div>
                <div>
                  <h3>{t('landing.dashboardTitle')}</h3>
                  <p>{t('landing.dashboardDesc')}</p>
                  <div className="landing-tags">
                    <span className="landing-tag">{t('landing.tagTotalSpent')}</span>
                    <span className="landing-tag">{t('landing.tagCount')}</span>
                    <span className="landing-tag">{t('landing.tagAvg')}</span>
                  </div>
                </div>
              </article>
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <PublicIcon fontSize="small" />
                </div>
                <div>
                  <h3>{t('landing.feedTitle')}</h3>
                  <p>{t('landing.feedDesc')}</p>
                  <div className="landing-tags">
                    <span className="landing-tag">{t('landing.tagFeed')}</span>
                    <span className="landing-tag">{t('landing.tagFriends')}</span>
                    <span className="landing-tag">{t('landing.tagPhotos')}</span>
                  </div>
                </div>
              </article>
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <EmojiEventsIcon fontSize="small" />
                </div>
                <div>
                  <h3>{t('landing.groupsTitle')}</h3>
                  <p>{t('landing.groupsDesc')}</p>
                  <div className="landing-tags">
                    <span className="landing-tag">{t('landing.tagRankings')}</span>
                    <span className="landing-tag">{t('landing.tagGroups')}</span>
                  </div>
                </div>
              </article>
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <RestoreIcon fontSize="small" />
                </div>
                <div>
                  <h3>{t('landing.wrappedTitle')}</h3>
                  <p>{t('landing.wrappedDesc')}</p>
                  <div className="landing-tags">
                    <span className="landing-tag">{t('landing.tagTop5')}</span>
                    <span className="landing-tag">{t('landing.tagRecords')}</span>
                    <span className="landing-tag">{t('landing.tagTrends')}</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="landing-cta">
            <div>
              <h2>{t('landing.ctaTitle')}</h2>
              <p>{t('landing.ctaDesc')}</p>
            </div>
            <button type="button" className="landing-btn landing-btn-primary" onClick={onLogin}>
              {t('landing.ctaSecondary')}
            </button>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

