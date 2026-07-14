import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNotificationsPage } from './AdminNotificationsPage';

const { pushMocks, supabaseMock } = vi.hoisted(() => ({
  pushMocks: {
    getCurrentPushSubscription: vi.fn(),
    subscribeToPushNotifications: vi.fn(),
    syncCurrentPushSubscription: vi.fn(),
  },
  supabaseMock: {
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../lib/pushNotifications', () => pushMocks);
vi.mock('../../lib/supabaseClient', () => ({ supabase: supabaseMock }));
vi.mock('@mui/icons-material', () => ({
  Edit: () => null,
  NotificationsActive: () => null,
  Schedule: () => null,
  Send: () => null,
}));

const session = {
  user: { id: 'admin-1', email: 'admin@example.com' },
};

const scheduledCampaign = {
  id: 'campaign-1',
  title: 'Novedad',
  body: 'Ya puedes consultar tu resumen.',
  target_url: '/feed',
  scheduled_for_local: '2099-07-20T20:00:00',
  status: 'scheduled',
  created_at: '2099-07-14T10:00:00Z',
  queued_count: 4,
  sent_count: 0,
  failed_count: 0,
  skipped_count: 0,
  can_edit: true,
};

describe('AdminNotificationsPage', () => {
  beforeEach(() => {
    pushMocks.syncCurrentPushSubscription.mockResolvedValue(null);
    pushMocks.getCurrentPushSubscription.mockResolvedValue({ endpoint: 'admin-endpoint' });
    pushMocks.subscribeToPushNotifications.mockResolvedValue({ endpoint: 'admin-endpoint' });
    supabaseMock.functions.invoke.mockResolvedValue({ data: { sent: true }, error: null });
    supabaseMock.rpc.mockImplementation(async (functionName: string) => {
      if (functionName === 'admin_list_notification_campaigns') {
        return { data: [scheduledCampaign], error: null };
      }
      return { data: null, error: null };
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('schedules a custom notification in device-local time', async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage session={session as never} />);

    const message = await screen.findByLabelText('Mensaje');
    await user.type(message, 'Nueva campaña disponible');
    await user.clear(screen.getByLabelText('Fecha y hora local'));
    await user.type(screen.getByLabelText('Fecha y hora local'), '2099-08-01T20:00');
    await user.click(screen.getByRole('button', { name: 'Programar notificación' }));

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_create_notification_campaign', {
        p_title: 'Burger Wrapped',
        p_body: 'Nueva campaña disponible',
        p_target_url: '/',
        p_scheduled_for_local: '2099-08-01T20:00:00',
      });
    });
  });

  it('previews the current form only on the admin device', async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage session={session as never} />);

    await user.type(await screen.findByLabelText('Mensaje'), 'Mensaje de prueba');
    await user.click(await screen.findByRole('button', { name: 'Probar en este dispositivo' }));

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('preview-admin-push', {
      body: {
        endpoint: 'admin-endpoint',
        title: 'Burger Wrapped',
        body: 'Mensaje de prueba',
        targetUrl: '/',
      },
    });
    expect(await screen.findByText('Prueba enviada a este dispositivo.')).toBeInTheDocument();
  });

  it('loads a future campaign into the editor and saves its changes', async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage session={session as never} />);

    await user.click(await screen.findByRole('button', { name: 'Editar Novedad' }));
    const message = screen.getByLabelText('Mensaje');
    await user.clear(message);
    await user.type(message, 'Resumen actualizado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_update_notification_campaign', {
        p_campaign_id: 'campaign-1',
        p_title: 'Novedad',
        p_body: 'Resumen actualizado',
        p_target_url: '/feed',
        p_scheduled_for_local: '2099-07-20T20:00:00',
      });
    });
  });
});
