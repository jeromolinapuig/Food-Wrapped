import { useEffect, useState } from 'react';
import { DarkMode, LightMode, Menu } from '@mui/icons-material';

type MenuPage = 'dashboard' | 'feed' | 'profile';

type TopMenuProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: MenuPage) => void;
};

export function TopMenu({ theme, onToggleTheme, onNavigate }: TopMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEsc);
    return () => window.removeEventListener('keydown', closeOnEsc);
  }, []);

  const handle = (page: MenuPage | 'theme') => {
    if (page === 'theme') {
      onToggleTheme();
      setOpen(false);
      return;
    }
    onNavigate(page);
    setOpen(false);
  };

  return (
    <>
      <div className="bw-menu-trigger">
        <button
          type="button"
          className="bw-icon-button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Abrir menú"
        >
          <Menu />
        </button>
      </div>

      {open && <div className="bw-menu-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="bw-menu">
          <button className="bw-menu-item" type="button" onClick={() => handle('dashboard')}>
            Inicio
          </button>
          {/* <button className="bw-menu-item" type="button" onClick={() => handle('feed')}>
            Feed
          </button> */}
          <button className="bw-menu-item" type="button" onClick={() => handle('profile')}>
            Mi perfil
          </button>
          <button className="bw-menu-item" type="button" onClick={() => handle('theme')}>
            <span className="bw-menu-icon">
              {theme === 'light' ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
            </span>
            <span>Cambiar a tema {theme === 'light' ? 'oscuro' : 'claro'}</span>
          </button>
        </div>
      )}
    </>
  );
}
