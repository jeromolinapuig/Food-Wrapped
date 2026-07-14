import { IosShare, NotificationsActive } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PushNotificationError,
  VAPID_PUBLIC_KEY,
  getPushEnvironment,
  subscribeToPushNotifications,
  syncCurrentPushSubscription,
} from '../../lib/pushNotifications';
import { ModalBase } from '../common/ModalBase';
import './PushNotifications.css';

type PushNotificationPromptProps = {
  userId: string | null;
  enabled: boolean;
};

const getDismissedKey = (userId: string) => `bw-push-prompt-dismissed:${userId}`;

export function PushNotificationPrompt({ userId, enabled }: Readonly<PushNotificationPromptProps>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const environment = getPushEnvironment();

  useEffect(() => {
    if (!userId || !enabled || !VAPID_PUBLIC_KEY || environment === 'unsupported') {
      setOpen(false);
      return;
    }

    if (environment === 'ready' && Notification.permission === 'granted') {
      void syncCurrentPushSubscription(userId).catch((error) => {
        console.error('Could not synchronize push subscription', error);
      });
      setOpen(false);
      return;
    }

    if (environment === 'ready' && Notification.permission === 'denied') {
      setOpen(false);
      return;
    }

    if (window.localStorage.getItem(getDismissedKey(userId)) === '1') {
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => setOpen(true), 1800);
    return () => window.clearTimeout(timer);
  }, [enabled, environment, userId]);

  const dismiss = () => {
    if (userId) window.localStorage.setItem(getDismissedKey(userId), '1');
    setOpen(false);
    setErrorKey(null);
  };

  const activate = async () => {
    if (!userId) return;
    setWorking(true);
    setErrorKey(null);
    try {
      await subscribeToPushNotifications(userId);
      window.localStorage.setItem(getDismissedKey(userId), '1');
      setOpen(false);
    } catch (error) {
      if (error instanceof PushNotificationError && error.code === 'permission_denied') {
        setErrorKey('notifications.push.permissionDenied');
      } else {
        setErrorKey('notifications.push.activationError');
      }
    } finally {
      setWorking(false);
    }
  };

  const requiresInstall = environment === 'ios_requires_install';

  return (
    <ModalBase
      open={open}
      onClose={dismiss}
      modalClassName="bw-modal bw-push-prompt-modal"
    >
      <div className="bw-push-prompt-icon" aria-hidden="true">
        {requiresInstall ? <IosShare fontSize="inherit" /> : <NotificationsActive fontSize="inherit" />}
      </div>
      <div className="bw-push-prompt-copy">
        <h2 className="bw-modal-title">
          {t(requiresInstall ? 'notifications.push.installTitle' : 'notifications.push.promptTitle')}
        </h2>
        <p className="bw-modal-subtitle">
          {t(requiresInstall ? 'notifications.push.installDescription' : 'notifications.push.promptDescription')}
        </p>
      </div>
      {requiresInstall ? (
        <ol className="bw-push-install-steps">
          <li>{t('notifications.push.installStepShare')}</li>
          <li>{t('notifications.push.installStepHome')}</li>
          <li>{t('notifications.push.installStepOpen')}</li>
        </ol>
      ) : null}
      {errorKey ? <p className="bw-push-error">{t(errorKey)}</p> : null}
      <div className="bw-push-actions">
        <button type="button" className="bw-btn bw-btn-ghost" onClick={dismiss} disabled={working}>
          {t('notifications.push.notNow')}
        </button>
        {!requiresInstall ? (
          <button type="button" className="bw-btn bw-btn-primary" onClick={() => void activate()} disabled={working}>
            <NotificationsActive fontSize="small" />
            {working ? t('notifications.push.activating') : t('notifications.push.activate')}
          </button>
        ) : null}
      </div>
    </ModalBase>
  );
}
