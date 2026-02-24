import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordScreen } from './ResetPasswordScreen';

type MockSupabase = {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
};

const { supabaseMock, navigateMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })),
      onAuthStateChange: vi.fn(),
      updateUser: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } satisfies MockSupabase,
  navigateMock: vi.fn(),
}));

vi.mock('@mui/icons-material/Visibility', () => ({ default: () => null }));
vi.mock('@mui/icons-material/VisibilityOff', () => ({ default: () => null }));
vi.mock('@mui/icons-material/Close', () => ({ default: () => null }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: supabaseMock,
}));

describe('ResetPasswordScreen functional flows', () => {
  beforeEach(() => {
    vi.useRealTimers();
    navigateMock.mockReset();
    supabaseMock.auth.getSession.mockClear();
    supabaseMock.auth.updateUser.mockClear();
    supabaseMock.auth.signOut.mockClear();
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('shows validation when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordScreen />);

    await user.type(await screen.findByLabelText('resetPassword.newPassword'), 'secret123');
    await user.type(screen.getByLabelText('resetPassword.repeatPassword'), 'different');
    await user.click(screen.getByRole('button', { name: 'resetPassword.save' }));

    expect(await screen.findByText('resetPassword.errorMatch')).toBeInTheDocument();
  });

  it('updates password and redirects to login', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordScreen />);

    await user.type(await screen.findByLabelText('resetPassword.newPassword'), 'secret123');
    await user.type(screen.getByLabelText('resetPassword.repeatPassword'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'resetPassword.save' }));

    await waitFor(() => {
      expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'secret123' });
      expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login');
    }, { timeout: 3000 });
  });
});
