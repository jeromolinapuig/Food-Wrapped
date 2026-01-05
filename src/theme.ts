import { createTheme } from '@mui/material';

const paletteMap = {
  light: {
    bg: '#f3f3f7',
    surface: '#ffffff',
    text: '#111111',
    textMuted: '#666666',
    accent: '#ff3b8d',
  },
  dark: {
    bg: '#050509',
    surface: '#181824',
    text: '#f5f5ff',
    textMuted: '#a0a0b5',
    accent: '#ff3b8d',
  },
} as const;

export function createAppTheme(mode: 'light' | 'dark') {
  const colors = paletteMap[mode] ?? paletteMap.light;

  const muiTheme = createTheme({
    shape: {
      borderRadius: 24,
    },
    palette: {
      mode: mode === 'dark' ? 'dark' : 'light',
      primary: { main: colors.accent },
      background: {
        default: colors.bg,
        paper: colors.surface,
      },
      text: {
        primary: colors.text,
        secondary: colors.textMuted,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 24,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: colors.surface,
            borderRadius: 24,
          },
          notchedOutline: {
            borderColor: colors.textMuted,
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            color: colors.textMuted,
            backgroundColor: colors.surface,
            padding: '0 6px',
            borderRadius: 8,
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          outlined: {
            '&.MuiInputLabel-shrink': {
              transform: 'translate(14px, -8px) scale(0.75)',
              backgroundColor: colors.surface,
              padding: '0 6px',
              borderRadius: 8,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: colors.surface,
            color: colors.text,
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: colors.textMuted,
          },
        },
      },
    },
  });

  return { colors, muiTheme };
}
