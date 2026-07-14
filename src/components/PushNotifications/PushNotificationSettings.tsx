import { NotificationsActive, NotificationsOff } from '@mui/icons-material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import {
  PUSH_SUBSCRIPTION_CHANGED_EVENT,
  PushNotificationError,
  VAPID_PUBLIC_KEY,
  getCurrentPushSubscription,
  getPushEnvironment,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../../lib/pushNotifications';
import './PushNotifications.css';

type PushNotificationSettingsProps = {
  userId: string;
};

type NotificationPreferences = {
  likes_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  group_invites_enabled: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  likes_enabled: true,
  comments_enabled: true,
  follows_enabled: true,
  group_invites_enabled: true,
};

const preferenceOptions: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: 'likes_enabled', label: 'likes' },
  { key: 'comments_enabled', label: 'comments' },
  { key: 'follows_enabled', label: 'follows' },
  { key: 'group_invites_enabled', label: 'groupInvites' },
];

export function PushNotificationSettings({ userId }: Readonly<PushNotificationSettingsProps>) {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const environment = getPushEnvironment();

  const refreshSubscription = useCallback(async () => {
    const subscription = await getCurrentPushSubscription().catch(() => null);
    setSubscribed(Boolean(subscription));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('likes_enabled, comments_enabled, follows_enabled, group_invites_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Could not load notification preferences', error);
        setNotice('notifications.push.preferencesError');
      } else if (data) {
        setPreferences(data as NotificationPreferences);
      }
      await refreshSubscription();
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshSubscription, userId]);

  useEffect(() => {
    const refresh = () => void refreshSubscription();
    window.addEventListener(PUSH_SUBSCRIPTION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PUSH_SUBSCRIPTION_CHANGED_EVENT, refresh);
  }, [refreshSubscription]);

  const toggleSubscription = async () => {
    setWorking(true);
    setNotice(null);
    try {
      if (subscribed) {
        await unsubscribeFromPushNotifications();
        setSubscribed(false);
        setNotice('notifications.push.deactivated');
      } else {
        await subscribeToPushNotifications(userId);
        setSubscribed(true);
        setNotice('notifications.push.activated');
      }
    } catch (error) {
      if (error instanceof PushNotificationError && error.code === 'permission_denied') {
        setNotice('notifications.push.permissionDenied');
      } else {
        setNotice('notifications.push.activationError');
      }
    } finally {
      setWorking(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, enabled: boolean) => {
    const previous = preferences;
    const next = { ...preferences, [key]: enabled };
    setPreferences(next);
    setNotice(null);

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: userId, push_enabled: true, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      setPreferences(previous);
      setNotice('notifications.push.preferencesError');
    }
  };

  const statusKey = subscribed ? 'active' : 'inactive';
  const unavailableKey = !VAPID_PUBLIC_KEY
    ? 'configurationMissing'
    : environment === 'ios_requires_install'
      ? 'installDescription'
      : environment === 'unsupported'
        ? 'unsupported'
        : Notification.permission === 'denied'
          ? 'permissionDeniedSettings'
          : null;
  const canToggleSubscription = !unavailableKey || subscribed;

  return (
    <section className="bw-push-settings" aria-labelledby="push-settings-title">
      <div className="bw-push-settings-header">
        <div>
          <div className="bw-label" id="push-settings-title">{t('notifications.push.settingsTitle')}</div>
          <p className="bw-helper">{t('notifications.push.settingsDescription')}</p>
        </div>
        <span className={`bw-push-status ${subscribed ? 'is-active' : ''}`}>
          {subscribed ? <NotificationsActive fontSize="small" /> : <NotificationsOff fontSize="small" />}
          {t(`notifications.push.${statusKey}`)}
        </span>
      </div>

      {unavailableKey ? <p className="bw-push-info">{t(`notifications.push.${unavailableKey}`)}</p> : null}

      <button
        type="button"
        className={`bw-btn ${subscribed ? 'bw-btn-ghost' : 'bw-btn-primary'}`}
        onClick={() => void toggleSubscription()}
        disabled={loading || working || !canToggleSubscription}
      >
        {working
          ? t('notifications.push.updating')
          : t(subscribed ? 'notifications.push.deactivateDevice' : 'notifications.push.activateDevice')}
      </button>

      <div className="bw-push-preferences" aria-busy={loading}>
        <div className="bw-push-preferences-title">{t('notifications.push.receiveTitle')}</div>
        {preferenceOptions.map((option) => (
          <div className="bw-push-preference-row" key={option.key}>
            <span>{t(`notifications.push.preference.${option.label}`)}</span>
            <label className="bw-switch">
              <input
                type="checkbox"
                checked={preferences[option.key]}
                onChange={(event) => void updatePreference(option.key, event.target.checked)}
                disabled={loading}
              />
              <span className="bw-switch-slider" aria-hidden="true" />
            </label>
          </div>
        ))}
      </div>

      {notice ? <p className="bw-helper bw-push-settings-notice">{t(notice)}</p> : null}
    </section>
  );
}
