import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  auth: {
    signUp: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    signInWithOAuth: ReturnType<typeof vi.fn>;
  };
};

const { supabaseMock, navigateMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    auth: {
      signUp: vi.fn(async () => ({ data: { user: { identities: [{}] } }, error: null })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({ error: null })),
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

const setupSupabase = () => {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            limit: async () => ({
              data: [],
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    };
  });
};

describe('AuthScreen functional flows', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    supabaseMock.from.mockReset();
    supabaseMock.auth.signUp.mockClear();
    supabaseMock.auth.signInWithPassword.mockClear();
    supabaseMock.auth.resetPasswordForEmail.mockClear();
    supabaseMock.auth.signInWithOAuth.mockClear();
    setupSupabase();
  });

  it('logs in with email and password', async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.type(screen.getByLabelText('common.email'), 'user@example.com');
    await user.type(screen.getByLabelText('auth.passwordLabel'), 'secret123');
    const submit = document.querySelector('button[type="submit"]');
    if (!submit) throw new Error('Missing submit button');
    await user.click(submit);

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    });
  });

  it('switches to signup and creates account', async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.click(screen.getByRole('button', { name: 'auth.titleSignup' }));
    await user.type(screen.getByLabelText('auth.usernameLabel'), 'newuser');
    await user.type(screen.getByLabelText('common.email'), 'new@example.com');
    await user.type(screen.getByLabelText('auth.passwordLabel'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.signupCta' }));

    expect(supabaseMock.auth.signUp).toHaveBeenCalled();
    expect(await screen.findByText('auth.verifyEmail')).toBeInTheDocument();
  });

  it('starts google oauth flow', async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);

    await user.click(screen.getByRole('button', { name: 'auth.continueWithGoogle' }));
    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
  });
});
