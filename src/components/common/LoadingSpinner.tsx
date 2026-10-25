import { useTranslation } from 'react-i18next';
import '../../styles/shared.css';

type LoadingSpinnerProps = {
  label?: string;
  inline?: boolean;
  large?: boolean;
  className?: string;
};

export function LoadingSpinner({ label, inline = false, large = false, className = '' }: Readonly<LoadingSpinnerProps>) {
  const { t } = useTranslation();
  const accessibleLabel = label ?? t('common.loading');
  return <span role="status" aria-label={accessibleLabel}
    className={`bw-loading-indicator ${inline ? 'is-inline' : 'is-block'}${large ? ' is-large' : ''} ${className}`}>
    <span className="bw-loader-spinner" aria-hidden="true" />
    <span className="bw-visually-hidden">{accessibleLabel}</span>
  </span>;
}
