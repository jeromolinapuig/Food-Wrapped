import { DarkMode, LightMode } from '@mui/icons-material';
import '../styles/shared.css';

type TopMenuProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function TopMenu({ theme, onToggleTheme }: Readonly<TopMenuProps>) {
  return (
    <button
      type="button"
      className="bw-icon-button"
      onClick={onToggleTheme}
      aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}
    >
      {theme === 'light' ? <DarkMode /> : <LightMode />}
    </button>
  );
}
