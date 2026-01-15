import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PublicIcon from '@mui/icons-material/Public';
import RestoreIcon from '@mui/icons-material/Restore';
import { AppShell } from '../common/AppShell';
import './LandingPage.css';

type LandingPageProps = {
  onLogin: () => void;
};

export function LandingPage({ onLogin }: Readonly<LandingPageProps>) {
  return (
    <AppShell>
      <main className="bw-main landing-main">
        <div className="landing-body">
          <div className="landing-hero">
            <div className="landing-logo-wrap">
              <img src="/logo.png" alt="Burger Wrapped" className="landing-logo" />
            </div>
            <h1 className="landing-title">Burger Wrapped</h1>
            <p className="landing-subtitle">Tu año en hamburguesas</p>
            <p className="landing-lead">
              Registra cada hamburguesa, guarda precios y notas, y descubre tus estadísticas al final del año.
            </p>
            <div className="landing-actions">
              <button type="button" className="landing-btn landing-btn-primary" onClick={onLogin}>
                Comenzar ahora
              </button>
            </div>
            <p className="landing-note">Gratis y sin anuncios</p>
          </div>

          <section id="features" className="landing-section">
            <h2 className="landing-section-title">Que puedes hacer?</h2>
            <div className="landing-feature-list">
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <BarChartIcon fontSize="small" />
                </div>
                <div>
                  <h3>Tu dashboard personal</h3>
                  <p>Visualiza total gastado, conteo de burgers, nota media y tu top restaurantes.</p>
                  <div className="landing-tags">
                    <span className="landing-tag">Total gastado</span>
                    <span className="landing-tag">Contador</span>
                    <span className="landing-tag">Nota media</span>
                  </div>
                </div>
              </article>
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <PublicIcon fontSize="small" />
                </div>
                <div>
                  <h3>Feed global y social</h3>
                  <p>Descubre lo que comen otros, sigue amigos y comparte tus mejores burgers.</p>
                  <div className="landing-tags">
                    <span className="landing-tag">Feed</span>
                    <span className="landing-tag">Amigos</span>
                    <span className="landing-tag">Fotos</span>
                  </div>
                </div>
              </article>
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <EmojiEventsIcon fontSize="small" />
                </div>
                <div>
                  <h3>Grupos y retos</h3>
                  <p>Crea grupos, compite por rankings y compara gustos con tu gente.</p>
                  <div className="landing-tags">
                    <span className="landing-tag">Rankings</span>
                    <span className="landing-tag">Grupos</span>
                  </div>
                </div>
              </article>
              <article className="landing-feature">
                <div className="landing-feature-icon">
                  <RestoreIcon fontSize="small" />
                </div>
                <div>
                  <h3>Tu wrapped anual</h3>
                  <p>Recibe tu resumen personalizado con top burgers, records y hallazgos del año.</p>
                  <div className="landing-tags">
                    <span className="landing-tag">Top 5</span>
                    <span className="landing-tag">Records</span>
                    <span className="landing-tag">Tendencias</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="landing-cta">
            <div>
              <h2>Listo para tu siguiente burger?</h2>
              <p>Empieza hoy y ten tu wrapped listo cuando acabe el año.</p>
            </div>
            <button type="button" className="landing-btn landing-btn-primary" onClick={onLogin}>
              Empezar mi wrapped
            </button>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
