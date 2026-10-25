import { LoadingSpinner } from '../common/LoadingSpinner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { useBurgerEntries, type Entry } from './useBurgerEntries';
import { BackButton } from '../common/BackButton';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import { BurgerWishlistAction } from './BurgerWishlistAction';
import { BurgerRatingChart } from './BurgerRatingChart';
import './BurgerCatalog.css';

type Group = { key: string; burgerId: string; restaurantId: string; name: string; restaurant: string;
  entries: Entry[]; average: number | null; photo: string | null; last: string };
const rel = (r: Entry['burger']) => Array.isArray(r) ? r[0]?.name ?? null : r?.name ?? null;
const mostLikedPhoto = (entries: Entry[], likes: Record<string, number>) => entries
  .filter(entry => !entry.isLocked && entry.photo_url)
  .sort((a, b) => (likes[b.id] ?? 0) - (likes[a.id] ?? 0)
    || b.datetime.localeCompare(a.datetime) || b.id.localeCompare(a.id))[0];
const groupEntries = (entries: Entry[], likes: Record<string, number>, unknownBurger: string, unknownRestaurant: string): Group[] => {
  const groups = new Map<string, Group>();
  [...entries].sort((a,b) => b.datetime.localeCompare(a.datetime)).forEach(entry => {
    if (!entry.burger_id || !entry.restaurant_id) return;
    const key = entry.restaurant_id + ':' + entry.burger_id;
    const old = groups.get(key);
    if (old) old.entries.push(entry);
    else groups.set(key, { key, burgerId: entry.burger_id, restaurantId: entry.restaurant_id,
      name: rel(entry.burger) || unknownBurger, restaurant: rel(entry.restaurant) || unknownRestaurant,
      entries: [entry], average: null, photo: null, last: entry.datetime });
  });
  return [...groups.values()].map(g => {
    const notes = g.entries.map(e => e.rating).filter((n): n is number => n !== null && Number.isFinite(n));
    const photo = mostLikedPhoto(g.entries.filter(entry => !entry.isPrivate), likes)
      ?? mostLikedPhoto(g.entries, likes);
    return { ...g, photo: photo?.photo_url ?? null, average: notes.length ? notes.reduce((a,b)=>a+b,0)/notes.length : null };
  });
};
function CatalogError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return <div role="alert"><p>{t('burgerCatalog.loadError')}</p>
    <button type="button" className="bw-btn bw-btn-ghost" onClick={onRetry}>{t('burgerCatalog.retry')}</button>
  </div>;
}
function Rating({ value }: { value: number | null }) {
  const { t } = useTranslation();
  return <span className="bw-catalog-rating" aria-label={value == null ? t('burgerCatalog.notRated') : t('burgerCatalog.ratingLabel', { value: value.toFixed(1) })}>
    ★ {value == null ? '—' : value.toFixed(1)}
  </span>;
}
function PrivateBadge({ group = false }: { group?: boolean }) {
  const { t } = useTranslation();
  return <span className="bw-catalog-private-badge"><LockOutlinedIcon fontSize="small" aria-hidden="true" />{t(group ? 'burgerCatalog.hasPrivatePosts' : 'burgerCatalog.privatePost')}</span>;
}

function PrivatePost() {
  const { t } = useTranslation();
  return <div className="bw-catalog-private-post">
    <div className="bw-catalog-cover"><LockOutlinedIcon aria-hidden="true" /></div>
    <PrivateBadge />
    <small>{t('burgerCatalog.privateDescription')}</small>
  </div>;
}
function Cover({ src, name }: { src: string | null; name: string }) {
  return <div className="bw-catalog-cover">
    {src ? <img src={src} alt={name} loading="lazy" /> : <span aria-hidden="true">🍔</span>}
  </div>;
}
export function BurgerCollection({ userId, viewerId, own = false }: { userId: string; viewerId?: string | null; own?: boolean }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'collection'|'diary'|'top'>('collection');
  const { entries, likes, loading, error, retry } = useBurgerEntries({ userId, viewerId });
  const groups = useMemo(() => groupEntries(entries, likes, t('burgerCatalog.unknownBurger'), t('burgerCatalog.unknownRestaurant')), [entries, likes, t]);
  const sorted = useMemo(() => mode === 'top'
    ? [...groups].sort((a,b)=>(b.average ?? -1)-(a.average ?? -1)) : groups, [groups,mode]);
  const displayed = mode === 'diary'
    ? entries.filter(e=>e.burger_id && e.restaurant_id).map(e=>({ entry:e, group:groups.find(g=>g.key===e.restaurant_id+':'+e.burger_id) }))
    : [];
  return <section className="bw-catalog-section">
    <div className="bw-catalog-heading"><h2>{t(own ? 'burgerCatalog.ownCollection' : 'burgerCatalog.collection')}</h2>
      <span>{groups.length} {t('burgerCatalog.different',{defaultValue:'diferentes'})} · {entries.length} {t('burgerCatalog.experiences',{defaultValue:'experiencias'})}</span></div>
    <div className="bw-catalog-tabs" role="tablist" aria-label={t('burgerCatalog.collectionLabel')}>
      {(['collection','diary','top'] as const).map(item=><button type="button" role="tab" aria-selected={mode===item}
        className={mode===item?'is-active':''} key={item} onClick={()=>setMode(item)}>
        {item==='collection'?t('burgerCatalog.burgers',{defaultValue:'Burgers'}):item==='diary'?t('burgerCatalog.diary',{defaultValue:'Diario'}):t('burgerCatalog.top',{defaultValue:'Top'})}
      </button>)}
    </div>
    {loading ? <LoadingSpinner label={t('common.loading',{defaultValue:'Cargando...'})} /> : error ? <CatalogError onRetry={retry} /> :
      entries.length===0 ? <p>{t('burgerCatalog.empty',{defaultValue:'Todavía no hay hamburguesas registradas.'})}</p> :
      <div className="bw-catalog-grid">
        {mode==='diary'?displayed.map(({entry,group})=>entry.isLocked ? <PrivatePost key={entry.id} /> : <button type="button" className="bw-catalog-tile" key={entry.id}
          onClick={()=>navigate('/posts/'+entry.id,{state:{returnTo:own?'/profile':'/users/'+userId}})}>
          <Cover src={entry.photo_url} name={rel(entry.burger)||t('burgerCatalog.unknownBurger')} />
          {entry.isPrivate && <PrivateBadge />}<strong>{rel(entry.burger)||t('burgerCatalog.unknownBurger')}</strong><small>{new Date(entry.datetime).toLocaleDateString(i18n.language)}</small>
          <Rating value={entry.rating}/>{group && <small>{group.restaurant}</small>}
        </button>) : sorted.map(g=><button className="bw-catalog-tile" type="button" key={g.key}
          onClick={()=>navigate('/burgers/'+g.restaurantId+'/'+g.burgerId)}>
          <Cover src={g.photo} name={g.name}/><strong>{g.name}</strong><small>{g.restaurant}</small>
          {g.entries.some(entry => entry.isPrivate) && <PrivateBadge group />}
          <Rating value={g.average}/><small>{g.entries.length} {t('burgerCatalog.reviews',{defaultValue:'valoraciones'})}</small>
        </button>)}
      </div>}
  </section>;
}
const BURGER_PAGE_SIZE = 24;
// Match display names like the restaurant search, preserving Japanese and Thai text.
const normalizeCatalogSearch = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '');

export function BurgerExplore({ searchTerm = '', hideSearch = false, viewerId }: { searchTerm?: string; hideSearch?: boolean; viewerId?: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [localTerm, setLocalTerm] = useState('');
  const term = hideSearch ? searchTerm : localTerm;
  const normalizedTerm = normalizeCatalogSearch(term);
  const [sort, setSort] = useState<'popular' | 'best' | 'latest'>('popular');
  const [visibleCount, setVisibleCount] = useState(BURGER_PAGE_SIZE);
  const [previousFilters, setPreviousFilters] = useState({ term, sort });
  if (previousFilters.term !== term || previousFilters.sort !== sort) {
    setPreviousFilters({ term, sort });
    setVisibleCount(BURGER_PAGE_SIZE);
  }
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { entries, likes, loading, error, retry } = useBurgerEntries({ viewerId, publicOnly: true });
  const groups = useMemo(() => groupEntries(entries, likes, t('burgerCatalog.unknownBurger'), t('burgerCatalog.unknownRestaurant')), [entries, likes, t]);
  const matches = useMemo(() => groups
    .filter(g => normalizeCatalogSearch(g.name + ' ' + g.restaurant).includes(normalizedTerm))
    .sort((a, b) => sort === 'best'
      ? (b.average ?? -1) - (a.average ?? -1)
      : sort === 'latest'
        ? b.last.localeCompare(a.last)
        : b.entries.length - a.entries.length || (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name)),
    [groups, sort, normalizedTerm]);
  const visibleBurgers = useMemo(() => matches.slice(0, visibleCount), [matches, visibleCount]);
  const hasMore = visibleCount < matches.length;
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || loading || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(count => Math.min(count + BURGER_PAGE_SIZE, matches.length));
    }, { rootMargin: '300px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMore, matches.length, visibleCount]);
  return <section className="bw-catalog-section">
    <div className="bw-catalog-toolbar">
      {!hideSearch && <input className="bw-input" type="search" value={term} onChange={e => setLocalTerm(e.target.value)}
        placeholder={t('burgerCatalog.search', { defaultValue: 'Buscar hamburguesa o restaurante...' })} aria-label={t('burgerCatalog.searchLabel')}/>}
      <select className="bw-input" value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label={t('burgerCatalog.sortLabel')}>
        <option value="popular">{t('burgerCatalog.popular', { defaultValue: 'Más valoraciones' })}</option>
        <option value="best">{t('burgerCatalog.best', { defaultValue: 'Mejor valoradas' })}</option>
        <option value="latest">{t('burgerCatalog.recent', { defaultValue: 'Recientes' })}</option>
      </select>
    </div>
    {loading ? <LoadingSpinner label={t('common.loading', { defaultValue: 'Cargando...' })} /> : error ? <CatalogError onRetry={retry} /> : <>
      <div className="bw-catalog-grid">{visibleBurgers.map(g => <button key={g.key} type="button" className="bw-catalog-tile"
        onClick={() => navigate('/burgers/' + g.restaurantId + '/' + g.burgerId)}>
        <Cover src={g.photo} name={g.name}/><strong>{g.name}</strong><small>{g.restaurant}</small>
        {g.entries.some(entry => entry.isPrivate) && <PrivateBadge group />}
        <Rating value={g.average}/><small>{g.entries.length} {t('burgerCatalog.reviews', { defaultValue: 'valoraciones' })}</small>
      </button>)}</div>
      {matches.length === 0 && <p>{t('burgerCatalog.noResults', { defaultValue: 'No hay hamburguesas que coincidan con la búsqueda.' })}</p>}
      {hasMore && <div ref={loadMoreRef} className="bw-catalog-load-more">
        <LoadingSpinner label={t('burgerCatalog.loadingMore', { defaultValue: 'Cargar más hamburguesas' })} />
      </div>}
    </>}
  </section>;
}

export function BurgerDetailPage({ viewerId }: { viewerId?: string | null }) {
  const { restaurantId, burgerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { entries, likes, loading, error, retry } = useBurgerEntries({ viewerId, restaurantId, burgerId });
  const summary = useMemo(() => groupEntries(entries, likes, t('burgerCatalog.unknownBurger'), t('burgerCatalog.unknownRestaurant'))[0], [entries, likes, t]);
  const visible = useMemo(() => entries.filter(entry => !entry.isLocked), [entries]);
  const featured = mostLikedPhoto(visible.filter(entry => !entry.isPrivate), likes);
  // Only accessible posts can supply a wishlist reference, photo or currency.
  const source = featured ?? visible[0];
  const rated = visible.filter((entry): entry is Entry & { rating: number } => entry.rating !== null && Number.isFinite(entry.rating));
  const openPost = (id: string) => navigate(`/posts/${id}`, { state: { returnTo: `/burgers/${restaurantId}/${burgerId}` } });
  const wishlistLink = viewerId ? <Link className="bw-btn bw-btn-ghost bw-catalog-wishlist-link" to="/burger-wishlist">
    <ListAltOutlinedIcon aria-hidden="true" fontSize="small" />{t('burgerWishlist.viewList')}
  </Link> : null;

  return <AppShell>
    <PageHeader title={summary?.name || t('burgerCatalog.unknownBurger')} subtitle={summary?.restaurant || ''}
      leading={<BackButton onClick={() => {
        const state = location.state as { returnTo?: string } | null;
        if (state?.returnTo === '/burger-wishlist') navigate('/burger-wishlist');
        else if (location.key === 'default') navigate('/search');
        else navigate(-1);
      }} ariaLabel={t('burgerCatalog.back')} />} />
    <main className="bw-main bw-catalog-detail">
      {!loading && (error || !source) && wishlistLink}
      {loading ? <LoadingSpinner label={t('common.loading')} /> : error ? <CatalogError onRetry={retry} /> : !summary ? <p>{t('burgerCatalog.noReviews')}</p> : <>
        <div className="bw-catalog-summary">
          <Cover src={featured?.photo_url ?? summary.photo} name={summary.name} />
          <div><h2>{summary.name}</h2><p>{summary.restaurant}</p><Rating value={summary.average} />
            <p>{t('burgerCatalog.reviewSummary', { count: rated.length, users: new Set(visible.map(entry => entry.user_id)).size })}</p>
          </div>
        </div>
        {source && restaurantId && burgerId && <BurgerWishlistAction
          key={JSON.stringify([viewerId, restaurantId, burgerId, source.id])}
          viewerId={viewerId} listAction={wishlistLink} source={{ id: source.id, restaurantId, burgerId, photoUrl: source.photo_url, currency: source.currency }} />}
        {entries.some(entry => entry.isLocked) && <p className="bw-catalog-privacy-note">{t('burgerCatalog.privateRatingsExcluded')}</p>}
        <BurgerRatingChart ratings={rated.map(entry => entry.rating)} average={summary.average} />
        {featured && <section className="bw-catalog-featured"><h3>{t('burgerCatalog.popularPhoto', { count: likes[featured.id] ?? 0 })}</h3>
          <button type="button" onClick={() => openPost(featured.id)}>
            <img src={featured.photo_url ?? ''} alt={summary.name} /><span>{t('burgerCatalog.viewPost')}</span>
          </button>
        </section>}
        <section><h3>{t('burgerCatalog.posts', { count: entries.length })}</h3><div className="bw-catalog-posts">
          {entries.map(entry => entry.isLocked ? <PrivatePost key={entry.id} /> :
            <button type="button" key={entry.id} onClick={() => openPost(entry.id)}
              className={viewerId && entry.user_id === viewerId ? 'is-own-post' : undefined}>
              <Cover src={entry.photo_url} name={summary.name} />
              {viewerId && entry.user_id === viewerId && <span className="bw-catalog-own-badge">{t('burgerCatalog.ownPost')}</span>}
              {entry.isPrivate && <PrivateBadge />}
              <span>{new Date(entry.datetime).toLocaleDateString(i18n.language)}</span><Rating value={entry.rating} />
              <small>♥ {likes[entry.id] ?? 0}</small>
            </button>)}
        </div></section>
      </>}
    </main>
  </AppShell>;
}
