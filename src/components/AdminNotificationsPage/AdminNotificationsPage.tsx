import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Edit, NotificationsActive, Schedule, Send } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import {
  getCurrentPushSubscription,
  subscribeToPushNotifications,
  syncCurrentPushSubscription,
} from '../../lib/pushNotifications';
import { formatLocalDateTime } from '../../utils/datetime';
import { AppShell } from '../common/AppShell';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PageHeader } from '../common/PageHeader';
import '../../styles/layout.css';
import '../../styles/shared.css';
import './AdminNotificationsPage.css';

type AdminNotificationsPageProps = {
  session: Session;
};

type CampaignStatus = 'scheduled' | 'completed' | 'cancelled';
type DeliveryMode = 'scheduled' | 'immediate';

type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  target_url: string;
  scheduled_for_local: string;
  delivery_mode: DeliveryMode;
  status: CampaignStatus;
  created_at: string;
  queued_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  can_edit: boolean;
};

type CampaignForm = {
  title: string;
  body: string;
  targetUrl: string;
  scheduledForLocal: string;
};

const getDefaultSchedule = () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  return formatLocalDateTime(tomorrow);
};

const EMPTY_FORM: CampaignForm = {
  title: 'Burger Wrapped',
  body: '',
  targetUrl: '/',
  scheduledForLocal: '',
};

const getInitialForm = (): CampaignForm => ({
  ...EMPTY_FORM,
  scheduledForLocal: getDefaultSchedule(),
});

const statusLabels: Record<CampaignStatus, string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const formatScheduledLocal = (value: string) => {
  const normalized = value.slice(0, 16);
  const [date, time] = normalized.split('T');
  if (!date || !time) return value;
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} a las ${time}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
};

export function AdminNotificationsPage({ session }: Readonly<AdminNotificationsPageProps>) {
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [form, setForm] = useState<CampaignForm>(getInitialForm);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('scheduled');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelCampaign, setCancelCampaign] = useState<NotificationCampaign | null>(null);
  const [confirmImmediate, setConfirmImmediate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preparingDevice, setPreparingDevice] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc('admin_list_notification_campaigns');
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setCampaigns(((data ?? []) as NotificationCampaign[]).map((campaign) => ({
      ...campaign,
      queued_count: Number(campaign.queued_count),
      sent_count: Number(campaign.sent_count),
      failed_count: Number(campaign.failed_count),
      skipped_count: Number(campaign.skipped_count),
    })));
    setLoading(false);
  }, []);

  const detectCurrentDevice = useCallback(async () => {
    try {
      await syncCurrentPushSubscription(session.user.id);
      const subscription = await getCurrentPushSubscription();
      setCurrentEndpoint(subscription?.endpoint ?? null);
    } catch (deviceError) {
      console.error('Could not synchronize the admin push subscription', deviceError);
      setCurrentEndpoint(null);
    }
  }, [session.user.id]);

  useEffect(() => {
    void loadCampaigns();
    void detectCurrentDevice();
  }, [detectCurrentDevice, loadCampaigns]);

  const resetForm = () => {
    setEditingId(null);
    setDeliveryMode('scheduled');
    setForm(getInitialForm());
    setError(null);
  };

  const updateField = (field: keyof CampaignForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const validateContent = () => {
    if (!form.title.trim() || form.title.trim().length > 80) {
      return 'El título debe tener entre 1 y 80 caracteres.';
    }
    if (!form.body.trim() || form.body.trim().length > 240) {
      return 'El mensaje debe tener entre 1 y 240 caracteres.';
    }
    if (!form.targetUrl.startsWith('/') || form.targetUrl.startsWith('//')) {
      return 'El enlace debe ser una ruta interna que empiece por /.';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateContent();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!form.scheduledForLocal || new Date(form.scheduledForLocal).getTime() <= Date.now()) {
      setError('Elige una fecha y hora futuras. Debe seguir siendo futura en todas las zonas horarias registradas.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    const parameters = {
      p_title: form.title.trim(),
      p_body: form.body.trim(),
      p_target_url: form.targetUrl.trim(),
      p_scheduled_for_local: `${form.scheduledForLocal}:00`,
    };
    const result = editingId
      ? await supabase.rpc('admin_update_notification_campaign', {
          p_campaign_id: editingId,
          ...parameters,
        })
      : await supabase.rpc('admin_create_notification_campaign', parameters);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSuccess(editingId ? 'Notificación programada actualizada.' : 'Notificación programada correctamente.');
    resetForm();
    await loadCampaigns();
    setSaving(false);
  };

  const requestImmediateSend = () => {
    const validationError = validateContent();
    if (validationError) {
      setError(validationError);
      return;
    }
    setConfirmImmediate(true);
  };

  const handleSendNow = async () => {
    setConfirmImmediate(false);
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { data, error: sendError } = await supabase.functions.invoke('send-admin-push-now', {
      body: {
        title: form.title.trim(),
        body: form.body.trim(),
        targetUrl: form.targetUrl.trim(),
      },
    });

    if (sendError) {
      setError(sendError.message);
      setSaving(false);
      return;
    }

    const result = data as { sent?: number; skipped?: number; failed?: number; error?: string } | null;
    if (result?.error) {
      setSuccess('La campaña se ha creado y el programador continuará intentando el envío.');
      resetForm();
      await loadCampaigns();
      setSaving(false);
      return;
    }

    const sent = Number(result?.sent ?? 0);
    const skipped = Number(result?.skipped ?? 0);
    const failed = Number(result?.failed ?? 0);
    setSuccess(`Envío iniciado: ${sent} enviadas, ${skipped} omitidas y ${failed} fallidas.`);
    resetForm();
    await loadCampaigns();
    setSaving(false);
  };

  const handlePrepareDevice = async () => {
    setPreparingDevice(true);
    setError(null);
    setSuccess(null);
    try {
      const subscription = await subscribeToPushNotifications(session.user.id);
      setCurrentEndpoint(subscription.endpoint);
      setSuccess('Este dispositivo ya está preparado para recibir la prueba.');
    } catch (prepareError) {
      setError(getErrorMessage(prepareError, 'No se pudo activar este dispositivo.'));
    } finally {
      setPreparingDevice(false);
    }
  };

  const handlePreview = async () => {
    const validationError = validateContent();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!currentEndpoint) {
      setError('Activa primero las notificaciones en este dispositivo.');
      return;
    }

    setPreviewing(true);
    setError(null);
    setSuccess(null);
    const { error: previewError } = await supabase.functions.invoke('preview-admin-push', {
      body: {
        endpoint: currentEndpoint,
        title: form.title.trim(),
        body: form.body.trim(),
        targetUrl: form.targetUrl.trim(),
      },
    });

    if (previewError) {
      setError(previewError.message);
    } else {
      setSuccess('Prueba enviada a este dispositivo.');
    }
    setPreviewing(false);
  };

  const handleEdit = (campaign: NotificationCampaign) => {
    setEditingId(campaign.id);
    setDeliveryMode('scheduled');
    setForm({
      title: campaign.title,
      body: campaign.body,
      targetUrl: campaign.target_url,
      scheduledForLocal: campaign.scheduled_for_local.slice(0, 16),
    });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = async () => {
    if (!cancelCampaign) return;
    setSaving(true);
    const { error: cancelError } = await supabase.rpc('admin_cancel_notification_campaign', {
      p_campaign_id: cancelCampaign.id,
    });
    setCancelCampaign(null);
    if (cancelError) {
      setError(cancelError.message);
    } else {
      setSuccess('Notificación programada cancelada.');
      if (editingId === cancelCampaign.id) resetForm();
      await loadCampaigns();
    }
    setSaving(false);
  };

  const minimumDateTime = useMemo(() => formatLocalDateTime(new Date(Date.now() + 60_000)), []);

  return (
    <AppShell>
      <PageHeader
        title="Admin · Notificaciones"
        subtitle="Envía avisos al instante o prográmalos en la hora local de cada dispositivo"
      />

      <main className="bw-main bw-admin-notifications">
        <section className="bw-card bw-admin-notification-editor">
          <div className="bw-admin-notification-heading">
            <div>
              <h2>{editingId ? 'Editar notificación programada' : 'Nueva notificación'}</h2>
              <p className="bw-helper">
                {deliveryMode === 'scheduled'
                  ? 'La fecha y la hora se interpretarán localmente en cada dispositivo suscrito.'
                  : 'La notificación comenzará a enviarse a todos los dispositivos al confirmar.'}
              </p>
            </div>
            <Schedule aria-hidden="true" />
          </div>

          {!editingId ? (
            <div className="bw-admin-notification-mode" role="group" aria-label="Tipo de envío">
              <button
                type="button"
                className={deliveryMode === 'immediate' ? 'is-active' : ''}
                aria-pressed={deliveryMode === 'immediate'}
                onClick={() => setDeliveryMode('immediate')}
              >
                Enviar ahora
              </button>
              <button
                type="button"
                className={deliveryMode === 'scheduled' ? 'is-active' : ''}
                aria-pressed={deliveryMode === 'scheduled'}
                onClick={() => setDeliveryMode('scheduled')}
              >
                Programar
              </button>
            </div>
          ) : null}

          <div className="bw-field">
            <label className="bw-label" htmlFor="admin-notification-title">Título</label>
            <input
              id="admin-notification-title"
              className="bw-input"
              maxLength={80}
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
            />
            <span className="bw-admin-notification-counter">{form.title.length}/80</span>
          </div>

          <div className="bw-field">
            <label className="bw-label" htmlFor="admin-notification-body">Mensaje</label>
            <textarea
              id="admin-notification-body"
              className="bw-textarea"
              maxLength={240}
              value={form.body}
              onChange={(event) => updateField('body', event.target.value)}
              placeholder="Escribe el mensaje que recibirán los usuarios"
            />
            <span className="bw-admin-notification-counter">{form.body.length}/240</span>
          </div>

          <div className="bw-field">
            <label className="bw-label" htmlFor="admin-notification-url">Ruta al abrir</label>
            <input
              id="admin-notification-url"
              className="bw-input"
              maxLength={500}
              value={form.targetUrl}
              onChange={(event) => updateField('targetUrl', event.target.value)}
              placeholder="/feed"
            />
          </div>

          {deliveryMode === 'scheduled' ? (
            <div className="bw-field">
              <label className="bw-label" htmlFor="admin-notification-schedule">Fecha y hora local</label>
              <input
                id="admin-notification-schedule"
                type="datetime-local"
                className="bw-input"
                min={minimumDateTime}
                value={form.scheduledForLocal}
                onChange={(event) => updateField('scheduledForLocal', event.target.value)}
              />
            </div>
          ) : null}

          {error ? <p className="bw-admin-notification-feedback is-error" role="alert">{error}</p> : null}
          {success ? <p className="bw-admin-notification-feedback is-success" role="status">{success}</p> : null}

          <div className="bw-admin-notification-actions">
            {currentEndpoint ? (
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                disabled={previewing || saving}
                onClick={() => void handlePreview()}
              >
                <Send fontSize="small" />
                {previewing ? 'Enviando prueba…' : 'Probar en este dispositivo'}
              </button>
            ) : (
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                disabled={preparingDevice || saving}
                onClick={() => void handlePrepareDevice()}
              >
                <NotificationsActive fontSize="small" />
                {preparingDevice ? 'Activando…' : 'Activar este dispositivo'}
              </button>
            )}
            <button
              type="button"
              className="bw-btn bw-btn-primary"
              disabled={saving || previewing}
              onClick={() => deliveryMode === 'immediate' ? requestImmediateSend() : void handleSave()}
            >
              {deliveryMode === 'immediate' ? <Send fontSize="small" /> : <Schedule fontSize="small" />}
              {saving
                ? deliveryMode === 'immediate' ? 'Enviando…' : 'Guardando…'
                : deliveryMode === 'immediate' ? 'Enviar ahora'
                  : editingId ? 'Guardar cambios' : 'Programar notificación'}
            </button>
            {editingId ? (
              <button type="button" className="bw-btn bw-btn-ghost" disabled={saving} onClick={resetForm}>
                Dejar de editar
              </button>
            ) : null}
          </div>
        </section>

        <section className="bw-admin-notification-list" aria-labelledby="campaign-list-title">
          <h2 id="campaign-list-title">Historial de notificaciones</h2>
          {loading ? <p className="bw-helper">Cargando notificaciones…</p> : null}
          {!loading && campaigns.length === 0 ? (
            <div className="bw-card"><p className="bw-helper">Todavía no hay notificaciones.</p></div>
          ) : null}
          {campaigns.map((campaign) => (
            <article className="bw-card bw-admin-notification-campaign" key={campaign.id}>
              <div className="bw-admin-notification-campaign-header">
                <div>
                  <span className={`bw-admin-notification-status is-${campaign.status}`}>
                    {campaign.delivery_mode === 'immediate' && campaign.status === 'scheduled'
                      ? 'Enviando'
                      : statusLabels[campaign.status]}
                  </span>
                  <h3>{campaign.title}</h3>
                </div>
                {campaign.can_edit ? (
                  <button
                    type="button"
                    className="bw-admin-notification-icon-button"
                    aria-label={`Editar ${campaign.title}`}
                    onClick={() => handleEdit(campaign)}
                  >
                    <Edit fontSize="small" />
                  </button>
                ) : null}
              </div>
              <p>{campaign.body}</p>
              <dl className="bw-admin-notification-details">
                {campaign.delivery_mode === 'immediate' ? (
                  <div><dt>Envío</dt><dd>Inmediato</dd></div>
                ) : (
                  <div><dt>Hora local</dt><dd>{formatScheduledLocal(campaign.scheduled_for_local)}</dd></div>
                )}
                <div><dt>Destino</dt><dd>{campaign.target_url}</dd></div>
                <div><dt>Entregas</dt><dd>{campaign.sent_count} enviadas · {campaign.queued_count} pendientes</dd></div>
                {campaign.failed_count > 0 ? <div><dt>Fallos</dt><dd>{campaign.failed_count}</dd></div> : null}
                {campaign.skipped_count > 0 ? <div><dt>Omitidas</dt><dd>{campaign.skipped_count}</dd></div> : null}
              </dl>
              {campaign.can_edit ? (
                <button
                  type="button"
                  className="bw-btn bw-btn-danger-outline"
                  disabled={saving}
                  onClick={() => setCancelCampaign(campaign)}
                >
                  Cancelar programación
                </button>
              ) : null}
            </article>
          ))}
        </section>
      </main>

      <ConfirmDialog
        open={confirmImmediate}
        onClose={() => setConfirmImmediate(false)}
        title="Enviar notificación ahora"
        message="La notificación empezará a enviarse inmediatamente a todos los dispositivos suscritos. Esta acción no se puede editar ni cancelar."
        actions={(
          <>
            <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setConfirmImmediate(false)}>
              Volver
            </button>
            <button type="button" className="bw-btn bw-btn-primary" onClick={() => void handleSendNow()}>
              Enviar ahora
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={Boolean(cancelCampaign)}
        onClose={() => setCancelCampaign(null)}
        title="Cancelar notificación programada"
        message="La notificación dejará de enviarse a todos los dispositivos pendientes."
        actions={(
          <>
            <button type="button" className="bw-btn bw-btn-ghost" onClick={() => setCancelCampaign(null)}>
              Volver
            </button>
            <button type="button" className="bw-btn bw-btn-danger" onClick={() => void handleCancel()}>
              Cancelar programación
            </button>
          </>
        )}
      />
    </AppShell>
  );
}
