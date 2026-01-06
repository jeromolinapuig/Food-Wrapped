import { useCallback, useEffect, useRef, useState } from 'react';
import { DarkMode, Home, LightMode, Menu, Person } from '@mui/icons-material';

type MenuPage = 'dashboard' | 'feed' | 'profile';

type TopMenuProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: MenuPage) => void;
};

export function TopMenu({ theme, onToggleTheme, onNavigate }: TopMenuProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const closeMenu = useCallback(() => {
    if (!open) return;
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
    }, 200);
  }, [open]);

  useEffect(() => {
    const closeOnEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', closeOnEsc);
    return () => window.removeEventListener('keydown', closeOnEsc);
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;

    const handleScroll = () => closeMenu();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current);
      }
    };
  }, []);

  const handle = (page: MenuPage | 'theme') => {
    if (page === 'theme') {
      onToggleTheme();
      closeMenu();
      return;
    }
    onNavigate(page);
    closeMenu();
  };

  return (
    <>
      <div className="bw-menu-trigger" ref={triggerRef}>
        <button
          type="button"
          className="bw-icon-button"
          onClick={() => {
            if (open) {
              closeMenu();
            } else {
              setClosing(false);
              setOpen(true);
            }
          }}
          aria-label="Abrir menú"
        >
          <Menu />
        </button>
      </div>

      {open && <div className="bw-menu-backdrop" onClick={closeMenu} />}

      {open && (
        <div className={`bw-menu ${closing ? 'is-closing' : ''}`} ref={menuRef}>
          <button className="bw-menu-item" type="button" onClick={() => handle('dashboard')}>
            <span className="bw-menu-icon"><Home fontSize="small" /></span>
            Inicio
          </button>
          {/* <button className="bw-menu-item" type="button" onClick={() => handle('feed')}>
            Feed
          </button> */}
          <button className="bw-menu-item" type="button" onClick={() => handle('profile')}>
            <span className="bw-menu-icon"><Person fontSize="small" /></span>
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
