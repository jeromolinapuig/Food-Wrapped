import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabaseClient';
import { whereNotDeleted } from '../../lib/whereNotDeleted';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import './BurgerCatalog.css';

type Relation = { name: string | null } | { name: string | null }[] | null;
type Entry = {
  id: string; user_id: string; burger_id: string | null; restaurant_id: string | null;
  rating: number | null; photo_url: string | null; datetime: string;
  restaurant: Relation; burger: Relation;
};
type Group = { key: string; burgerId: string; restaurantId: string; name: string; restaurant: string;
  entries: Entry[]; average: number | null; photo: string | null; last: string };
const rel = (r: Relation) => Array.isArray(r) ? r[0]?.name ?? null : r?.name ?? null;
const groupEntries = (entries: Entry[]): Group[] => {
  const groups = new Map<string, Group>();
  [...entries].sort((a,b) => b.datetime.localeCompare(a.datetime)).forEach(entry => {
    if (!entry.burger_id || !entry.restaurant_id) return;
    const key = entry.restaurant_id + ':' + entry.burger_id;
    const old = groups.get(key);
    if (old) { old.entries.push(entry); if (!old.photo && entry.photo_url) old.photo = entry.photo_url; }
    else groups.set(key, { key, burgerId: entry.burger_id, restaurantId: entry.restaurant_id,
      name: rel(entry.burger) || 'Burger', restaurant: rel(entry.restaurant) || 'Restaurant',
      entries: [entry], average: null, photo: entry.photo_url, last: entry.datetime });
  });
  return [...groups.values()].map(g => {
    const notes = g.entries.map(e => e.rating).filter((n): n is number => n !== null && Number.isFinite(n));
    return { ...g, average: notes.length ? notes.reduce((a,b)=>a+b,0)/notes.length : null };
  });
};
function useBurgerEntries(userId?: string, allPublic = false) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      // Paginate so the community catalogue doesn't silently stop at Supabase's default 1,000 rows.
      const rows: Entry[] = [];
      for (let offset = 0; offset < 100000; offset += 500) {
        let query = supabase.from('entries')
          .select('id,user_id,burger_id,restaurant_id,rating,photo_url,datetime,restaurant:restaurants(name),burger:burgers(name)')
          .eq('is_burger', true).eq('burger_origin', 'restaurant')
          .not('burger_id', 'is', null).not('restaurant_id', 'is', null)
          .order('datetime', { ascending: false }).range(offset, offset + 499);
        query = whereNotDeleted(query);
        if (allPublic) query = query.eq('visibility', 'public');
        else if (userId) query = query.eq('user_id', userId);
        const { data, error: queryError } = await query;
        if (!active) return;
        if (queryError) { setError(queryError.message); break; }
        const batch = (data ?? []) as unknown as Entry[];
        rows.push(...batch);
        if (batch.length < 500) break;
      }
      if (active) { setEntries(rows); setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [userId, allPublic]);
  return { entries, loading, error };
}
function Rating({ value }: { value: number | null }) {
  return <span className="bw-catalog-rating" aria-label={value == null ? 'Not rated' : String(value)}>
    ★ {value == null ? '—' : value.toFixed(1)}
  </span>;
}
function Cover({ src, name }: { src: string | null; name: string }) {
  return <div className="bw-catalog-cover">
    {src ? <img src={src} alt={name} loading="lazy" /> : <span aria-hidden="true">🍔</span>}
  </div>;
}
export function BurgerCollection({ userId, own = false }: { userId: string; own?: boolean }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'collection'|'diary'|'top'>('collection');
  const { entries, loading, error } = useBurgerEntries(userId);
  const groups = useMemo(() => groupEntries(entries), [entries]);
  const sorted = useMemo(() => mode === 'top'
    ? [...groups].sort((a,b)=>(b.average ?? -1)-(a.average ?? -1)) : groups, [groups,mode]);
  const displayed = mode === 'diary'
    ? entries.filter(e=>e.burger_id && e.restaurant_id).map(e=>({ entry:e, group:groups.find(g=>g.key===e.restaurant_id+':'+e.burger_id) }))
    : [];
  return <section className="bw-catalog-section">
    <div className="bw-catalog-heading"><h2>{t('burgerCatalog.collection',{defaultValue:own?'Mis burgers':'Sus burgers'})}</h2>
      <span>{groups.length} {t('burgerCatalog.different',{defaultValue:'diferentes'})} · {entries.length} {t('burgerCatalog.experiences',{defaultValue:'experiencias'})}</span></div>
    <div className="bw-catalog-tabs" role="tablist" aria-label="Burger collection">
      {(['collection','diary','top'] as const).map(item=><button type="button" role="tab" aria-selected={mode===item}
        className={mode===item?'is-active':''} key={item} onClick={()=>setMode(item)}>
        {item==='collection'?t('burgerCatalog.burgers',{defaultValue:'Burgers'}):item==='diary'?t('burgerCatalog.diary',{defaultValue:'Diario'}):t('burgerCatalog.top',{defaultValue:'Top'})}
      </button>)}
    </div>
    {loading ? <p>{t('common.loading',{defaultValue:'Cargando...'})}</p> : error ? <p role="alert">{error}</p> :
      entries.length===0 ? <p>{t('burgerCatalog.empty',{defaultValue:'Todavía no hay hamburguesas registradas.'})}</p> :
      <div className="bw-catalog-grid">
        {mode==='diary'?displayed.map(({entry,group})=><button type="button" className="bw-catalog-tile" key={entry.id}
          onClick={()=>navigate('/posts/'+entry.id,{state:{returnTo:own?'/profile':'/users/'+userId}})}>
          <Cover src={entry.photo_url} name={rel(entry.burger)||'Burger'} />
          <strong>{rel(entry.burger)||'Burger'}</strong><small>{new Date(entry.datetime).toLocaleDateString()}</small>
          <Rating value={entry.rating}/>{group && <small>{group.restaurant}</small>}
        </button>) : sorted.map(g=><button className="bw-catalog-tile" type="button" key={g.key}
          onClick={()=>navigate('/burgers/'+g.restaurantId+'/'+g.burgerId)}>
          <Cover src={g.photo} name={g.name}/><strong>{g.name}</strong><small>{g.restaurant}</small>
          <Rating value={g.average}/><small>{g.entries.length} {t('burgerCatalog.reviews',{defaultValue:'valoraciones'})}</small>
        </button>)}
      </div>}
  </section>;
}
export function BurgerExplore({ searchTerm = '', hideSearch = false }: { searchTerm?: string; hideSearch?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [localTerm,setLocalTerm]=useState('');
  const term = hideSearch ? searchTerm : localTerm;
  const [sort,setSort]=useState<'popular'|'best'|'latest'>('popular');
  const {entries,loading,error}=useBurgerEntries(undefined,true);
  const groups=useMemo(()=>groupEntries(entries),[entries]);
  const matches=useMemo(()=>groups.filter(g=>(g.name+' '+g.restaurant).toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()))
    .sort((a,b)=>sort==='best'?(b.average??-1)-(a.average??-1):sort==='latest'?b.last.localeCompare(a.last):b.entries.length-a.entries.length || (b.average??-1)-(a.average??-1) || a.name.localeCompare(b.name)),[groups,sort,term]);
  return <section className="bw-catalog-section">
    <div className="bw-catalog-toolbar">
      {!hideSearch && <input className="bw-input" type="search" value={term} onChange={e=>setLocalTerm(e.target.value)}
        placeholder={t('burgerCatalog.search',{defaultValue:'Buscar hamburguesa o restaurante...'})} aria-label="Buscar burgers"/>}
      <select className="bw-input" value={sort} onChange={e=>setSort(e.target.value as typeof sort)} aria-label="Ordenar burgers">
        <option value="popular">{t('burgerCatalog.popular',{defaultValue:'Más valoraciones'})}</option>
        <option value="best">{t('burgerCatalog.best',{defaultValue:'Mejor valoradas'})}</option>
        <option value="latest">{t('burgerCatalog.recent',{defaultValue:'Recientes'})}</option>
      </select>
    </div>
    {loading?<p>{t('common.loading',{defaultValue:'Cargando...'})}</p>:error?<p role="alert">{error}</p>:
      <div className="bw-catalog-grid">{matches.map(g=><button key={g.key} type="button" className="bw-catalog-tile"
        onClick={()=>navigate('/burgers/'+g.restaurantId+'/'+g.burgerId)}>
        <Cover src={g.photo} name={g.name}/><strong>{g.name}</strong><small>{g.restaurant}</small>
        <Rating value={g.average}/><small>{g.entries.length} {t('burgerCatalog.reviews',{defaultValue:'valoraciones'})}</small>
      </button>)}</div>}
  </section>;
}
export function BurgerDetailPage() {
  const {restaurantId,burgerId}=useParams();
  const navigate=useNavigate();
  const {t}=useTranslation();
  const {entries,loading,error}=useBurgerEntries(undefined,true);
  const selected=useMemo(()=>entries.filter(e=>e.restaurant_id===restaurantId&&e.burger_id===burgerId),[entries,restaurantId,burgerId]);
  const summary=useMemo(()=>groupEntries(selected)[0], [selected]);
  const [likes,setLikes]=useState<Record<string,number>>({});
  useEffect(()=>{
    let active=true;
    async function load(){
      const counts:Record<string,number>={};
      for(let i=0;i<selected.length;i+=100){
        const ids=selected.slice(i,i+100).map(e=>e.id);
        if(!ids.length)break;
        const {data}=await supabase.from('entry_likes').select('entry_id').in('entry_id',ids);
        for(const row of data??[]) counts[row.entry_id]=(counts[row.entry_id]??0)+1;
      }
      if(active)setLikes(counts);
    }
    void load();return()=>{active=false;};
  },[selected]);
  const featured=selected.filter(e=>e.photo_url).sort((a,b)=>(likes[b.id]??0)-(likes[a.id]??0)||b.datetime.localeCompare(a.datetime))[0];
  const rated=selected.filter(e=>e.rating!==null);
  const bins=[1,2,3,4,5].map(star=>({star,count:rated.filter(e=>Math.min(5,Math.max(1,Math.round(e.rating??0)))===star).length}));
  const max=Math.max(1,...bins.map(b=>b.count));
  return <AppShell><PageHeader title={summary?.name||'Burger'} subtitle={summary?.restaurant||''}
    leading={<button type="button" className="bw-catalog-back" onClick={()=>navigate(-1)} aria-label="Volver">←</button>}/>
    <main className="bw-main bw-catalog-detail">
      {loading?<p>Cargando...</p>:error?<p role="alert">{error}</p>:!summary?<p>No hay valoraciones públicas para esta burger.</p>:<>
        <div className="bw-catalog-summary"><Cover src={featured?.photo_url??summary.photo} name={summary.name}/>
          <div><h2>{summary.name}</h2><p>{summary.restaurant}</p><Rating value={summary.average}/>
          <p>{rated.length} valoraciones · {new Set(selected.map(e=>e.user_id)).size} usuarios</p></div></div>
        <section className="bw-card bw-catalog-chart"><h3>Distribución de puntuaciones</h3>
          <div className="bw-catalog-bars">{bins.map(b=><div key={b.star} className="bw-catalog-bar-col">
            <span>{b.count}</span><div className="bw-catalog-bar-track"><div style={{height:(b.count/max*100)+'%'}}/></div><small>{b.star}★</small>
          </div>)}</div>
        </section>
        {featured&&<section className="bw-catalog-featured"><h3>Foto más popular · ♥ {likes[featured.id]??0}</h3>
          <button type="button" onClick={()=>navigate('/posts/'+featured.id,{state:{returnTo:'/burgers/'+restaurantId+'/'+burgerId}})}>
            <img src={featured.photo_url??''} alt={summary.name}/><span>Ver publicación ↗</span></button>
        </section>}
        <section><h3>Publicaciones ({selected.length})</h3><div className="bw-catalog-posts">
          {selected.map(e=><button type="button" key={e.id} onClick={()=>navigate('/posts/'+e.id,{state:{returnTo:'/burgers/'+restaurantId+'/'+burgerId}})}>
            <Cover src={e.photo_url} name={summary.name}/><span>{new Date(e.datetime).toLocaleDateString()}</span><Rating value={e.rating}/>
            <small>♥ {likes[e.id]??0}</small></button>)}
        </div></section>
      </>}
    </main></AppShell>;
}
