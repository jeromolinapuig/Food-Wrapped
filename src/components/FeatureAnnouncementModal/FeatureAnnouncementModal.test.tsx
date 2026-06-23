import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeatureAnnouncementModal } from './FeatureAnnouncementModal';

vi.mock('@mui/icons-material', () => ({
  DynamicFeed: () => null,
  PlaylistAddCheck: () => null,
}));

describe('FeatureAnnouncementModal', () => {
  it('no renderiza si open es false', () => {
    render(
      <FeatureAnnouncementModal
        open={false}
        onDismiss={() => {}}
        onViewFeed={() => {}}
      />
    );

    expect(screen.queryByText('featureAnnouncement.title')).not.toBeInTheDocument();
  });

  it('permite descartar el anuncio', () => {
    const onDismiss = vi.fn();
    render(
      <FeatureAnnouncementModal
        open
        onDismiss={onDismiss}
        onViewFeed={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'featureAnnouncement.dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('no cierra al pulsar el fondo', () => {
    const onDismiss = vi.fn();
    render(
      <FeatureAnnouncementModal
        open
        onDismiss={onDismiss}
        onViewFeed={() => {}}
      />
    );

    const backdrop = document.querySelector('.bw-modal-backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);
    expect(onDismiss).toHaveBeenCalledTimes(0);
  });

  it('abre el feed desde el CTA', () => {
    const onViewFeed = vi.fn();
    render(
      <FeatureAnnouncementModal
        open
        onDismiss={() => {}}
        onViewFeed={onViewFeed}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'featureAnnouncement.cta' }));
    expect(onViewFeed).toHaveBeenCalledTimes(1);
  });
});
