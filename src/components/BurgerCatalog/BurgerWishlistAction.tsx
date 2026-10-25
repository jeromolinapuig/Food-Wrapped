import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { loadBurgerWishlistStatuses, setBurgerWanted, type BurgerWishlistStatus, type WishlistSource } from '../../lib/burgerWishlist';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { lockBodyScroll } from '../../utils/scrollLock';

// The parent keys this component by viewer, burger and accessible source post.
export function BurgerWishlistAction({ viewerId, source, listAction }: { viewerId?: string | null; source: WishlistSource; listAction?: ReactNode }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BurgerWishlistStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(viewerId));
  const [error, setError] = useState<'load' | 'save' | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const request = useRef(0);
  const loadingRequest = useRef(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const key = `${source.restaurantId}:${source.burgerId}`;
  const { restaurantId, burgerId } = source;

  const load = useCallback(async (refresh = false) => {
    if (!viewerId || busy.current || (loadingRequest.current && !refresh)) return;
    loadingRequest.current = true;
    const id = ++request.current;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const statuses = await loadBurgerWishlistStatuses(viewerId, [{ restaurantId, burgerId }]);
      if (mounted.current && request.current === id) setStatus(statuses[key]);
    } catch {
      if (mounted.current && request.current === id) setError('load');
    } finally {
      if (mounted.current && request.current === id) { loadingRequest.current = false; setLoading(false); }
    }
  }, [viewerId, restaurantId, burgerId, key]);

  const invalidate = useCallback(() => { request.current++; loadingRequest.current = false; }, []);

  useEffect(() => {
    mounted.current = true;
    startTransition(() => { void load(); });
    // An update elsewhere supersedes an in-flight read of the previous state.
    const updated = () => { void load(true); };
    window.addEventListener('bw-burger-wishlist-updated', updated);
    return () => {
      mounted.current = false;
      invalidate();
      window.removeEventListener('bw-burger-wishlist-updated', updated);
    };
  }, [load, invalidate]);

  useEffect(() => {
    if (confirmRemove) {
      if (saving) dialogRef.current?.focus();
      else dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      return lockBodyScroll();
    }
    if (restoreFocus.current && !saving) { actionRef.current?.focus(); restoreFocus.current = false; }
  }, [confirmRemove, saving]);

  const closeConfirmation = () => {
    if (busy.current) return;
    restoreFocus.current = true;
    setConfirmRemove(false);
  };

  const save = async () => {
    if (!viewerId || !status || loading || loadingRequest.current || busy.current || status.tried || status.hasOwnPost) return;
    busy.current = true;
    request.current++;
    setSaving(true);
    setError(null);
    try {
      await setBurgerWanted(viewerId, source, !status.wanted);
      if (mounted.current) {
        setStatus({ ...status, wanted: !status.wanted });
        restoreFocus.current = true;
        setConfirmRemove(false);
      }
    } catch {
      // Keep the last confirmed state and allow the same operation to be retried.
      if (mounted.current) { setError('save'); restoreFocus.current = true; setConfirmRemove(false); }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  if (!viewerId) return <Link className="bw-btn bw-btn-primary bw-catalog-wishlist-login" to="/login">{t('burgerWishlist.loginToSave')}</Link>;

  return <section className="bw-catalog-wishlist" aria-label={t('burgerWishlist.pageTitle')} aria-busy={loading || saving}>
    <p className="bw-helper">{t('burgerWishlist.privateList')}</p>
    <div className="bw-catalog-wishlist-actions">
      {status?.tried || status?.hasOwnPost ? <span role="status">{t(status.hasOwnPost ? 'burgerWishlist.ownPost' : 'burgerWishlist.triedBadge')}</span> :
        <button ref={actionRef} type="button" className="bw-btn bw-btn-primary" disabled={!status || loading || saving}
          onClick={() => status?.wanted ? setConfirmRemove(true) : void save()}>
          {saving || loading ? <LoadingSpinner inline label={t(saving ? 'burgerWishlist.saving' : 'common.loading')} /> : <>
            <BookmarkAddOutlinedIcon aria-hidden="true" fontSize="small" />
            {t(status?.wanted ? 'burgerWishlist.inWishlist' : 'burgerWishlist.wantToTry')}
          </>}
        </button>}
      {listAction}
    </div>
    {error && <div role="alert"><p>{t(error === 'load' ? 'burgerWishlist.statusError' : 'burgerWishlist.saveError')}</p>
      <button type="button" className="bw-btn bw-btn-ghost" disabled={loading || saving}
        onClick={() => { if (error === 'load') void load(); else void save(); }}>{t('burgerCatalog.retry')}</button>
    </div>}
    {confirmRemove && <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label={t('burgerWishlist.removeTitle')}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeConfirmation(); }
        if (event.key === 'Tab') {
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          if (!buttons?.length) { event.preventDefault(); return; }
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <ConfirmDialog open onClose={closeConfirmation} title={t('burgerWishlist.removeTitle')} message={t('burgerWishlist.removeMessage')}
        actions={<>
          <button type="button" className="bw-btn bw-btn-ghost" disabled={saving} onClick={closeConfirmation}>{t('common.cancel')}</button>
          <button type="button" className="bw-btn bw-btn-danger" disabled={saving} onClick={() => void save()}>{saving ? <LoadingSpinner inline label={t('burgerWishlist.saving')} /> : t('burgerWishlist.remove')}</button>
        </>} />
    </div>}
  </section>;
}
