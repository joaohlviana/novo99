'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { commonSports, normalise, sports } from './catalog';
import './trainer-onboarding.css';

export type City = { id: string; name: string; uf: string };
export type TrainerDraft = { name: string; sports: string[]; presential: boolean; online: boolean; city: City | null; regions: string[]; languages: string[] };
export type TrainerOnboardingProps = {
  /** Non-sensitive identity + role + session generation. */
  sessionScope: string;
  lookupCities?: (query: string, signal: AbortSignal) => Promise<City[]>;
  searchSports?: (query: string, signal: AbortSignal) => Promise<string[]>;
  resolveLocation?: (latitude: number, longitude: number, signal: AbortSignal) => Promise<City | null>;
  saveDraft?: (draft: TrainerDraft) => Promise<void>;
  initialCity?: City | null;
};
const states = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
// Shape validation is not authoritative: the server must verify the ID/UF.
const validCity = (c: City) => /^\d{7}$/.test(c.id) && states.has(c.uf) && !!c.name.trim();
const validCities = (list: City[]) => Array.isArray(list) ? list.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.uf === 'string' && validCity(c)) : [];
function highlightName(name: string, query: string) {
  const term = normalise(query);
  if (!term) return name;
  const chars = Array.from(name);
  const positions: number[] = [];
  let folded = '';
  chars.forEach((char, index) => { const part = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); for (let i = 0; i < part.length; i++) positions.push(index); folded += part; });
  const index = folded.indexOf(term);
  if (index < 0) return name;
  const start = positions[index], end = positions[index + term.length - 1] + 1;
  return <>{chars.slice(0,start).join('')}<mark className="vf-match">{chars.slice(start,end).join('')}</mark>{chars.slice(end).join('')}</>;
}


/** The outer boundary discards the complete draft when identity changes. */
export function TrainerOnboarding(props: TrainerOnboardingProps) {
  if (!props.sessionScope || props.sessionScope.length > 512) return null;
  return <TrainerOnboardingInner key={props.sessionScope} {...props} />;
}

/** UI only: the app supplies authenticated lookup and persistence implementations. */
function TrainerOnboardingInner({ lookupCities, searchSports, resolveLocation, saveDraft, initialCity = null }: TrainerOnboardingProps) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [presential, setPresential] = useState(false);
  const [online, setOnline] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [languages, setLanguages] = useState<string[]>(['pt']);
  const [regions, setRegions] = useState('');
  const [more, setMore] = useState(false);
  const [sportQuery, setSportQuery] = useState('');
  const [sportResults, setSportResults] = useState<string[]>([]);
  const [sportStatus, setSportStatus] = useState<'idle'|'loading'|'ready'|'error'|'unavailable'>('idle');
  const [cityOpen, setCityOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [cityStatus, setCityStatus] = useState<'idle'|'loading'|'ready'|'error'|'locating'|'denied'>('idle');
  const [cityRetry, setCityRetry] = useState(0);
  const [results, setResults] = useState<City[]>([]);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'error'|'unknown'>('idle');
  const cityInput = useRef<HTMLInputElement>(null);
  const cityTrigger = useRef<HTMLButtonElement>(null);
  const cityHeading = useRef<HTMLSpanElement>(null);
  const modalTrigger = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const sportEpoch = useRef(0);
  const sportController = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const lookupRef = useRef(lookupCities);
  const sportLookupRef = useRef(searchSports);
  const locationRef = useRef(resolveLocation);
  if (lookupRef.current !== lookupCities || locationRef.current !== resolveLocation) { lookupRef.current = lookupCities; locationRef.current = resolveLocation; epoch.current++; }
  if (sportLookupRef.current !== searchSports) { sportLookupRef.current = searchSports; sportEpoch.current++; }
  const id = useId().replace(/:/g,'');
  const incomplete = !name.trim() || !selected.length || !(presential || online) || (presential && !city) || !languages.length;

  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; controller.current?.abort(); sportEpoch.current++; sportController.current?.abort(); }; }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 599px)');
    const update = () => setMobile(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const requestId = ++sportEpoch.current;
    sportController.current?.abort();
    setSportResults([]);
    if (!more) { setSportStatus('idle'); return; }
    if (!searchSports) { setSportStatus('unavailable'); return; }
    if (!sportQuery.trim()) { setSportStatus('idle'); return; }
    const ac = new AbortController(); sportController.current = ac; setSportStatus('loading');
    const timer = setTimeout(() => {
      if (ac.signal.aborted || requestId !== sportEpoch.current) return;
      Promise.resolve().then(() => {
        if (ac.signal.aborted || requestId !== sportEpoch.current) throw new Error('Cancelled');
        return searchSports(sportQuery.trim(), ac.signal);
      }).then(items => {
        if (ac.signal.aborted || requestId !== sportEpoch.current) return;
        if (!Array.isArray(items)) throw new Error('Invalid search response');
        const permitted = new Set(sports.map(item => item[0]));
        setSportResults([...new Set(items.filter(item => permitted.has(item as typeof sports[number][0])))]);
        setSportStatus('ready');
      }).catch(() => { if (!ac.signal.aborted && requestId === sportEpoch.current) setSportStatus('error'); });
    }, 180);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [more, sportQuery, searchSports]);
  useEffect(() => {
    const requestId = ++epoch.current;
    controller.current?.abort();
    if (!cityOpen || query.trim().length < 2) { setResults([]); setCityStatus('idle'); setActive(-1); return; }
    if (!lookupCities) { setResults([]); setCityStatus('error'); return; }
    const ac = new AbortController(); controller.current = ac;
    setResults([]); setCityStatus('loading'); setActive(-1);
    const timer = setTimeout(() => {
      if (ac.signal.aborted || requestId !== epoch.current) return;
      Promise.resolve().then(() => {
        if (ac.signal.aborted || requestId !== epoch.current) throw new Error('Cancelled');
        return lookupCities(query.trim(), ac.signal);
      }).then(items => {
        if (ac.signal.aborted || requestId !== epoch.current) return;
        if (!Array.isArray(items) || validCities(items).length !== items.length) throw new Error('Invalid city response');
        const term = normalise(query);
        const unique = Array.from(new Map(validCities(items).map(item => [item.id,item])).values());
        unique.sort((a,b) => Number(normalise(b.name).startsWith(term)) - Number(normalise(a.name).startsWith(term)) || a.name.localeCompare(b.name,'pt-BR') || a.uf.localeCompare(b.uf));
        setResults(unique); setCityStatus('ready'); setMessage(unique.length ? `${unique.length} cidades encontradas.` : 'Nenhuma cidade encontrada.');
      }).catch(() => { if (!ac.signal.aborted && requestId === epoch.current) { setCityStatus('error'); setMessage('Não foi possível buscar cidades.'); } });
    }, 180);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [cityOpen, query, lookupCities, cityRetry]);

  function toggleSport(slug: string) {
    setMessage(selected.includes(slug) ? 'Modalidade removida.' : selected.length >= 5 ? 'Até 5 modalidades. Remova uma para escolher outra.' : 'Modalidade adicionada.');
    setSelected(current => current.includes(slug) ? current.filter(item => item !== slug) : current.length >= 5 ? current : [...current, slug]);
  }
  function toggleLanguage(lang: string) { setLanguages(current => current.includes(lang) ? current.length > 1 ? current.filter(item => item !== lang) : current : [...current,lang]); }
  function closeCity() { const previous = document.activeElement; epoch.current++; controller.current?.abort(); setCityOpen(false); setQuery(''); setResults([]); setActive(-1); requestAnimationFrame(() => { if (mounted.current && (document.activeElement === previous || document.activeElement === document.body)) (cityTrigger.current || cityHeading.current)?.focus(); }); }
  function closeMore() { const previous = document.activeElement; sportEpoch.current++; sportController.current?.abort(); setMore(false); requestAnimationFrame(() => { if (mounted.current && (document.activeElement === previous || document.activeElement === document.body)) modalTrigger.current?.focus(); }); }
  function chooseCity(c: City) { if (!validCity(c)) return; setCity(c); setRegions(''); setMessage(`${c.name}, ${c.uf} selecionada.`); closeCity(); }
  function onCityKey(event: KeyboardEvent<HTMLInputElement>) {
    const initial = query.trim().length < 2;
    const count = initial ? (initialCity && validCity(initialCity) ? 2 : 1) : results.length;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeCity(); }
    if (event.key === 'ArrowDown' && count) { event.preventDefault(); setActive(n => Math.min(n + 1, count - 1)); }
    if (event.key === 'ArrowUp' && count) { event.preventDefault(); setActive(n => Math.max(n - 1, 0)); }
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      if (initial && active === 0) openLocation();
      else if (initial && active === 1 && initialCity) chooseCity(initialCity);
      else if (!initial && results[active]) chooseCity(results[active]);
    }
  }
  function openLocation() {
    if (!navigator.geolocation || !resolveLocation) { setCityStatus('error'); setMessage('Localização indisponível. Digite sua cidade.'); return; }
    const requestId = ++epoch.current; controller.current?.abort(); const ac = new AbortController(); controller.current = ac; setCityStatus('locating');
    navigator.geolocation.getCurrentPosition(position => {
      if (ac.signal.aborted || requestId !== epoch.current) return;
      Promise.resolve().then(() => {
        if (ac.signal.aborted || requestId !== epoch.current) throw new Error('Cancelled');
        return resolveLocation(position.coords.latitude, position.coords.longitude, ac.signal);
      }).then(c => {
        if (ac.signal.aborted || requestId !== epoch.current) return;
        if (c && validCity(c)) chooseCity(c); else { setCityStatus('error'); setMessage('Não foi possível identificar a cidade. Digite o nome.'); }
      }).catch(() => { if (!ac.signal.aborted && requestId === epoch.current) { setCityStatus('error'); setMessage('Não foi possível identificar a cidade. Digite o nome.'); } });
    }, () => { if (!ac.signal.aborted && requestId === epoch.current) { setCityStatus('denied'); setMessage('Sem acesso à localização. Digite a cidade; localização é opcional.'); } });
  }
  async function save() {
    if (!saveDraft || incomplete || busy.current || saveStatus === 'unknown') return;
    busy.current = true; setSaveStatus('saving');
    try { await saveDraft({ name: name.trim(), sports: selected, presential, online, city, regions: regions.split(',').map(v => v.trim()).filter(Boolean), languages }); if (mounted.current) setSaveStatus('idle'); }
    catch { if (mounted.current) setSaveStatus('unknown'); }
    finally { busy.current = false; }
  }
  const filtered = sportResults.map(slug => sports.find(item => item[0] === slug)).filter((item): item is typeof sports[number] => !!item);
  return <div className={`vf-shell${cityOpen ? ' vf-has-city' : ''}`}>
    <header className="vf-top" data-testid="vfinal-top"><a href="/" aria-label="99Coach, página inicial"><img src="/logo.svg" alt="99Coach" width="110" height="28" /></a><div>Cadastro do treinador · <b>Passo 1 de 3</b><span className="vf-help-link">Ajuda indisponível</span></div></header>
    <div className="vf-mobile-bar"><a href="/painel" aria-label="Voltar">←</a><b>Passo 1 de 3</b><button type="button" disabled title="Pular temporariamente indisponível">Pular</button></div>
    <main id="main" className="vf-card" data-testid="vfinal-card" aria-labelledby={`${id}-title`}>
      <header className="vf-head"><div className="vf-steps" aria-hidden="true"><span/><span/><span/></div><p className="vf-eyebrow">Seu perfil</p><h1 id={`${id}-title`}>O que você treina?</h1><p>Três respostas para alunos te encontrarem na busca. O resto você completa depois, no painel.</p></header>
      <div className="vf-field"><label className="vf-label" htmlFor={`${id}-name`}>Nome</label><input className="vf-input" id={`${id}-name`} autoComplete="name" value={name} maxLength={120} onChange={e=>setName(e.target.value)} /></div>
      <section className="vf-field" aria-labelledby={`${id}-sports`}><div className="vf-label"><span id={`${id}-sports`}>Modalidades</span><small>{selected.length ? `${selected.length} escolhida${selected.length === 1 ? '' : 's'}` : 'nenhuma escolhida'}</small></div><div className="vf-chips">{commonSports.map(slug => { const item=sports.find(s=>s[0]===slug)!;return <button key={slug} type="button" className={`vf-chip${selected.includes(slug)?' is-selected':''}`} aria-pressed={selected.includes(slug)} onClick={()=>toggleSport(slug)}>{selected.includes(slug)&&<span aria-hidden="true">✓ </span>}{item[1]}</button>; })}<button ref={modalTrigger} type="button" className="vf-more" aria-expanded={more} onClick={()=>setMore(true)}>＋ Mais modalidades</button></div>{selected.filter(s=>!commonSports.includes(s as typeof commonSports[number])).length>0&&<div className="vf-chips" aria-label="Outras modalidades escolhidas">{selected.filter(s=>!commonSports.includes(s as typeof commonSports[number])).map(slug=><button type="button" className="vf-chip is-selected" aria-pressed="true" key={slug} onClick={()=>toggleSport(slug)}>✓ {sports.find(item=>item[0]===slug)?.[1]}</button>)}</div>}</section>
      <section className="vf-field" aria-labelledby={`${id}-format`}><div className="vf-label"><span id={`${id}-format`}>Como você atende</span><small>uma ou as duas</small></div><div className="vf-format"><button type="button" className={`vf-option${presential?' is-selected':''}`} aria-pressed={presential} onClick={()=>setPresential(v=>!v)}><span className="vf-check">{presential?'✓':''}</span><span><b>Presencial</b><small>Na sua cidade</small></span></button><button type="button" className={`vf-option${online?' is-selected':''}`} aria-pressed={online} onClick={()=>setOnline(v=>!v)}><span className="vf-check">{online?'✓':''}</span><span><b>Online</b><small>Treino no app, todo o Brasil</small></span></button></div></section>
      <section className="vf-field vf-city-field" aria-labelledby={`${id}-where`}><div className="vf-label"><span id={`${id}-where`} ref={cityHeading} tabIndex={-1}>Onde você atende</span><small>{presential?'obrigatória':'opcional'}</small></div>{city ? <div className="vf-picked"><span className="vf-picked-chip">{city.name}, {city.uf} <button type="button" aria-label={`Remover ${city.name}, ${city.uf}`} onClick={()=>{setCity(null);setRegions('');}}>×</button></span><button type="button" className="vf-link" onClick={()=>{const previous=document.activeElement;setCity(null);setRegions('');setCityOpen(true);requestAnimationFrame(()=>{if(mounted.current && (document.activeElement===previous || document.activeElement===document.body))cityInput.current?.focus();});}}>Trocar cidade</button></div> : <><button ref={cityTrigger} type="button" className="vf-city-trigger" aria-expanded={cityOpen} onClick={()=>{const previous=document.activeElement;setCityOpen(true);requestAnimationFrame(()=>{if(mounted.current && (document.activeElement===previous || document.activeElement===document.body))cityInput.current?.focus();});}}>⌖ <span>Digite sua cidade</span>⌄</button>{cityOpen && <div className="vf-city-popup" role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined} aria-label={mobile ? "Buscar cidade" : undefined} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeCity();}else if(mobile && e.key==='Tab'){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}}}}><div className="vf-city-row"><input ref={cityInput} type="text" role="combobox" autoComplete="off" aria-label="Buscar cidade" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-city-list`} aria-activedescendant={active>=0?`${id}-option-${active}`:undefined} aria-describedby={`${id}-city-help`} aria-invalid={presential && !city ? true : undefined} placeholder="Digite sua cidade" value={query} onChange={e=>{epoch.current++;controller.current?.abort();setResults([]);setQuery(e.target.value);}} onKeyDown={onCityKey}/><button type="button" className="vf-cancel" onClick={closeCity}>Cancelar</button></div><div className="vf-city-list" id={`${id}-city-list`} role="listbox" aria-label="Cidades">{query.trim().length<2 && <><button type="button" id={`${id}-option-0`} role="option" aria-selected={active===0} onClick={openLocation} className="vf-city-option"><b>Usar minha localização</b><small>Só para achar a cidade; o endereço não aparece no perfil</small></button>{initialCity && validCity(initialCity) && <button type="button" id={`${id}-option-1`} role="option" aria-selected={active===1} onClick={()=>chooseCity(initialCity)} className="vf-city-option"><b>{initialCity.name}</b><small>{initialCity.uf} · usada anteriormente</small></button>}<p>Digite ao menos 2 letras</p></>}{cityStatus==='loading' && <p>Buscando cidades…</p>}{cityStatus==='locating' && <p>Buscando localização…</p>}{cityStatus==='denied' && <p>Sem acesso à localização. Tudo bem: digite a cidade.</p>}{cityStatus==='error' && <div><p>Busca indisponível. Tente novamente mais tarde.</p>{lookupCities && <button type="button" onClick={()=>setCityRetry(v=>v+1)}>Tentar novamente</button>}</div>}{cityStatus==='ready' && results.length===0 && <div><p>Nenhuma cidade encontrada.</p><p>Não encontrou sua cidade? A solicitação de revisão está temporariamente indisponível.</p></div>}{cityStatus==='ready' && results.map((result,index)=><button key={result.id} id={`${id}-option-${index}`} type="button" role="option" aria-selected={index===active} className="vf-city-option" onClick={()=>chooseCity(result)}><b>{highlightName(result.name, query)}</b><small>{result.uf}</small></button>)}</div></div>}</>}<p id={`${id}-city-help`} className="vf-help">{presential?'Escolha a cidade onde você atende presencialmente.':'Só online? A cidade é opcional e não exige endereço público.'}</p>{city && <div className="vf-regions"><label className="vf-label" htmlFor={`${id}-regions`}>Regiões ou bairros <small>opcional</small></label><input id={`${id}-regions`} className="vf-input" value={regions} onChange={e=>setRegions(e.target.value)} placeholder="Separe por vírgulas"/><p className="vf-help">Aparece no perfil como região. Endereço completo nunca é público.</p></div>}</section>
      <section className="vf-field" aria-labelledby={`${id}-languages`}><span className="vf-label" id={`${id}-languages`}>Idioma de atendimento</span><div className="vf-chips">{([['pt','Português'],['en','Inglês'],['es','Espanhol']] as const).map(([value,label])=><button key={value} type="button" className={`vf-chip${languages.includes(value)?' is-selected':''}`} aria-pressed={languages.includes(value)} onClick={()=>toggleLanguage(value)}>{languages.includes(value)&&'✓ '}{label}</button>)}</div></section>
      <div className="vf-footer" data-testid="vfinal-footer"><button type="button" className="vf-submit" disabled={incomplete || !saveDraft || saveStatus==='saving' || saveStatus==='unknown'} onClick={save}>Salvar e continuar <span aria-hidden="true">→</span></button><p className="vf-why">{!saveDraft ? 'Salvamento temporariamente indisponível.' : incomplete ? 'Preencha nome, modalidade, atendimento, idioma e cidade quando necessária.' : saveStatus==='saving' ? 'Salvando…' : ''}</p>{saveStatus==='unknown'&&<p role="alert">Não foi possível confirmar o salvamento. Volte ao painel para conferir antes de tentar novamente.</p>}<button type="button" className="vf-skip-desktop" disabled>Pular por agora</button></div>
    </main><p className="vf-note">O perfil só aparece na busca depois de publicado. Nada aqui é público até lá.</p>
    <p className="vf-sr" role="status" aria-live="polite">{message}</p>
    {more && <div className="vf-modal-backdrop" onClick={closeMore}><section className="vf-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-more`} onClick={event=>event.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeMore();}else if(e.key==='Tab'){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><h2 id={`${id}-more`}>Mais modalidades</h2><button type="button" aria-label="Fechar" onClick={closeMore}>×</button></header><label className="vf-search">Buscar modalidade<input type="search" value={sportQuery} onChange={e=>{sportEpoch.current++;sportController.current?.abort();setSportResults([]);setSportQuery(e.target.value);}} autoFocus /></label><div className="vf-chips">{filtered.map(([slug,label])=><button type="button" key={slug} className={`vf-chip${selected.includes(slug)?' is-selected':''}`} aria-pressed={selected.includes(slug)} onClick={()=>toggleSport(slug)}>{selected.includes(slug)&&'✓ '}{label}</button>)}</div><p className="vf-help" role="status">{sportStatus==='idle'?'Digite para buscar modalidades.':sportStatus==='loading'?'Buscando modalidades…':sportStatus==='unavailable'?'Busca de modalidades temporariamente indisponível.':sportStatus==='error'?'Não foi possível buscar modalidades.':sportStatus==='ready'&&!filtered.length?'Nenhuma modalidade encontrada.':''}</p><p className="vf-help">Até 5 modalidades no perfil.</p></section></div>}
  </div>;
}
