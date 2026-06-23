import { DynamicFeed, PlaylistAddCheck } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../common/ModalBase';
import './FeatureAnnouncementModal.css';

type FeatureAnnouncementModalProps = {
  open: boolean;
  onDismiss: () => void;
  onViewFeed: () => void;
};

export function FeatureAnnouncementModal({
  open,
  onDismiss,
  onViewFeed,
}: Readonly<FeatureAnnouncementModalProps>) {
  const { t } = useTranslation();
  const highlights = [
    t('featureAnnouncement.highlightSave'),
    t('featureAnnouncement.highlightManage'),
    t('featureAnnouncement.highlightPrivate'),
  ];

  return (
    <ModalBase
      open={open}
      onClose={() => {}}
      modalClassName="bw-modal bw-feature-announcement-modal"
    >
      <div className="bw-feature-announcement-hero" aria-hidden="true">
        <div className="bw-feature-announcement-icon">
          <PlaylistAddCheck fontSize="inherit" />
        </div>
        <span className="bw-feature-announcement-badge">
          {t('featureAnnouncement.badge')}
        </span>
      </div>
      <div className="bw-modal-header bw-feature-announcement-header">
        <div>
          <h2 className="bw-modal-title">{t('featureAnnouncement.title')}</h2>
          <p className="bw-modal-subtitle">{t('featureAnnouncement.subtitle')}</p>
        </div>
      </div>
      <ul className="bw-feature-announcement-list">
        {highlights.map((highlight) => (
          <li key={highlight}>
            <PlaylistAddCheck fontSize="small" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
      <div className="bw-feature-announcement-actions">
        <button type="button" className="bw-btn bw-btn-ghost" onClick={onDismiss}>
          {t('featureAnnouncement.dismiss')}
        </button>
        <button type="button" className="bw-btn bw-btn-primary" onClick={onViewFeed}>
          <DynamicFeed fontSize="small" />
          {t('featureAnnouncement.cta')}
        </button>
      </div>
    </ModalBase>
  );
}
