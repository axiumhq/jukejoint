/* =====================================================================
   v8 · runtime compartilhado: dados fictícios, avatares, ícones,
   capas dos modos (SVG pintado só com variáveis de tema) e a casca.
   ===================================================================== */

/* ---------- dados (fictícios; uma fonte de verdade) ---------- */
const ME = 'Corvo_Noturno';
const MODES = {
  cp:{name:'Círculo Profano',     shift:0,   seed:7,  rule:'Todos contra todos', rules:['Todos contra todos, sem times.','O círculo encolhe a cada 60 s.','Cada abate dá um item aleatório.']},
  ub:{name:'Último Bonde',        shift:-12, seed:3,  rule:'Times de 6', rules:['Dois times de 6.','O bonde anda sozinho; escolte até o fim.','Quem cai do trilho volta no próximo vagão.']},
  nb:{name:'Neblina',             shift:8,   seed:11, rule:'Caçada em duplas', rules:['Duplas contra duplas.','Visão curta: a neblina fecha a cada rodada.','Rodadas de 4 min, melhor de 5.']},
  cc:{name:'Cerco ao Cofre',      shift:16,  seed:19, rule:'Ataque e defesa', rules:['Ataque e defesa, troca no meio.','O cofre abre em 3 travas.','Sem renascer na última trava.']},
  dm:{name:'Duelo à Meia-Noite',  shift:-18, seed:5,  rule:'1 contra 1', rules:['Um contra um, chave eliminatória.','Primeiro a 5 abates.','Sem itens de cura.']},
  ct:{name:'Campo de Treino',     shift:22,  seed:23, rule:'Livre', rules:['Sem placar.','Alvos e bonecos reaparecem.','Troque de arma quando quiser.']},
};
const MODE_ORDER = ['cp','ub','nb','cc','dm','ct'];

/* estado: open | match (em partida) | invite (só com convite) | full (lotado) */
const LOBBIES = [
  {id:'so-mira',num:'04',     name:'Só mira, sem choro',               mode:'cp', n:11, max:12, ping:22, host:'k0rvo',      inside:['k0rvo','Brasa','Faísca','Vela','Coruja'], tags:[], rec:true},
  {id:'bonde-23h',num:'07',   name:'Bonde das 23h',                    mode:'ub', n:10, max:12, ping:18, host:'trilho_7',   inside:['trilho_7','ferro_velho','Maré','Pião'], tags:[]},
  {id:'madrugada',num:'02',   name:'Círculo da madrugada',             mode:'cp', n:9,  max:12, ping:14, host:'Ametista',   inside:['Ametista','Odete','Tordo','capivara.exe','Lanterneiro'], tags:[], fav:true},
  {id:'cacada',num:'11',      name:'Caçada rápida',                    mode:'nb', n:8,  max:10, ping:26, host:'Vigia',      inside:['Vigia','Sopro','Cardo'], tags:[], state:'match', round:'Rodada 3 de 5'},
  {id:'sem-lanterna',num:'09',name:'Neblina sem lanterna, iniciantes ok',mode:'nb',n:6,  max:10, ping:31, host:'luz_baixa',  inside:['luz_baixa','Musgo','Tule'], tags:['iniciantes']},
  {id:'vigilia',num:'13',     name:'Clã Vigília',                      mode:'cc', n:7,  max:10, ping:20, host:'Sentinela',  inside:['Sentinela','Ferrolho','Brisa'], tags:[], state:'invite'},
  {id:'x1-sol',num:'05',      name:'x1 até o sol nascer',              mode:'dm', n:5,  max:8,  ping:12, host:'Meia_Lua',   inside:['Meia_Lua','Agulha','Rubi'], tags:[]},
  {id:'trilho-sul',num:'08',  name:'Trilho sul, sem tóxico',           mode:'ub', n:12, max:12, ping:24, host:'Ferrugem',   inside:['Ferrugem','Cobre','Anil','Jabuti'], tags:[], state:'full'},
  {id:'build-arma',num:'16',  name:'Testando build de arma',           mode:'ct', n:2,  max:6,  ping:9,  host:'Garoa',      inside:['Garoa','Lume'], tags:[], fav:true},
  {id:'cofre-call',num:'12',  name:'Cofre com call, sem flame',        mode:'cc', n:9,  max:10, ping:19, host:'Trinco',     inside:['Trinco','Petra','Gume'], tags:[]},
  {id:'sem-pressa',num:'03',  name:'Círculo sem pressa',               mode:'cp', n:8,  max:12, ping:28, host:'Sereno',     inside:['Sereno','Algodão','Nimbo'], tags:['iniciantes']},
  {id:'bonde-casual',num:'14',name:'Último Bonde casual',              mode:'ub', n:5,  max:12, ping:35, host:'Pixel_Torto',inside:['Pixel_Torto','Graxa'], tags:['iniciantes']},
  {id:'cerco-sexta',num:'17', name:'Cerco de sexta',                   mode:'cc', n:10, max:10, ping:22, host:'Cadeado',    inside:['Cadeado','Chave','Selo'], tags:[], state:'full'},
  {id:'neblina-hc',num:'10',  name:'Neblina hardcore',                 mode:'nb', n:10, max:10, ping:27, host:'Breu',       inside:['Breu','Fuligem','Carvão'], tags:[], state:'full', round:'Rodada 4 de 5'},
  {id:'relampago',num:'06',   name:'Círculo relâmpago',                mode:'cp', n:5,  max:12, ping:16, host:'Faísca',     inside:['Faísca','Trovão'], tags:[]},
  {id:'novatos',num:'15',     name:'Círculo dos novatos',              mode:'cp', n:8,  max:12, ping:33, host:'Vela',       inside:['Vela','Pavio','Cera'], tags:['iniciantes']},
  {id:'madrugueiro',num:'18', name:'Bonde madrugueiro',                mode:'ub', n:12, max:12, ping:41, host:'Coruja',     inside:['Coruja','Insone','Lua'], tags:[], state:'full'},
  {id:'cofre-treino',num:'01',name:'Cofre: treino de call',            mode:'cc', n:6,  max:10, ping:23, host:'Âncora',     inside:['Âncora','Leme'], tags:['iniciantes']},
];
const FRIENDS = [
  {name:'Odete',     st:'game', where:'madrugada',   verb:'em'},
  {name:'Tordo',     st:'game', where:'madrugada',   verb:'em'},
  {name:'k0rvo',     st:'game', where:'so-mira',     verb:'abriu'},
  {name:'luz_baixa', st:'game', where:'sem-lanterna',verb:'abriu'},
  {name:'Garoa',     st:'game', where:'build-arma',  verb:'abriu'},
  {name:'Lume',      st:'on',   where:null, txt:'no menu do Deadlock'},
  {name:'Pixote',    st:'on',   where:null, txt:'no menu do Deadlock'},
];
const FRIEND_NAMES = FRIENDS.map(f=>f.name);
const lobbyById = id => LOBBIES.find(l=>l.id===id);
const modeCount = k => LOBBIES.filter(l=>l.mode===k).reduce((s,l)=>s+l.n,0);
const totalPlaying = () => LOBBIES.reduce((s,l)=>s+l.n,0);
const friendsIn = l => FRIENDS.filter(f=>f.where===l.id).map(f=>f.name);

/* ---------- utilidades ---------- */
function hash(s){let h=2166136261;for(const c of s){h^=c.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;return h>>>0}
function rng(seed){let h=hash(String(seed))||1;return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%10000)/10000}}
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const store = {
  get(k,d){try{const v=localStorage.getItem('lobby.'+k);return v===null?d:JSON.parse(v)}catch{return d}},
  set(k,v){try{localStorage.setItem('lobby.'+k,JSON.stringify(v))}catch{}}
};

/* ---------- avatares: formas abstratas determinísticas ---------- */
function avatarSVG(name){
  const h=hash(name), g=hash(name+'·');
  const b=(x,i,m)=>((x>>>i)&255)%m;
  const hue=h%360, h2=(hue+40+b(g,4,80))%360, h3=(hue+180+b(g,12,60))%360;
  const bg=`hsl(${hue} 42% 17%)`, A=`hsl(${h2} 72% ${58+b(h,6,12)}%)`, B=`hsl(${h3} 68% ${62+b(g,20,12)}%)`;
  const rot=b(g,0,8)*22.5, kind=b(g,28,3);
  const cx=4+b(h,4,28), cy=4+b(h,12,28), r=14+b(h,20,8);
  const second = kind===0
    ? `<rect x="-4" y="${13+b(g,8,8)}" width="44" height="${8+b(h,26,6)}" transform="rotate(${rot} 18 18)" fill="${B}" style="mix-blend-mode:screen" opacity=".82"/>`
    : kind===1
    ? `<circle cx="${36-cx}" cy="${36-cy}" r="${9+b(g,16,6)}" fill="${B}" style="mix-blend-mode:screen" opacity=".85"/>`
    : `<path d="M-2 ${24+b(g,8,8)} Q18 ${6+b(g,16,10)} 38 ${22+b(g,24,10)} L38 38 L-2 38Z" fill="${B}" style="mix-blend-mode:screen" opacity=".8"/>`;
  return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" fill="${bg}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${A}"/>${second}<circle cx="18" cy="18" r="17.4" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="1.2"/></svg>`;
}
const av=(name,size=28,cls='')=>`<span class="av ${cls}" style="--s:${size}px" title="${esc(name)}">${avatarSVG(name)}</span>`;
const pres=(name,size,kind='on')=>`<span class="pres ${kind}">${av(name,size)}<i></i></span>`;
function stack(names,size=22,total){
  const shown=names.slice(0,4), more=(total??names.length)-shown.length;
  return `<span class="stack" style="--s:${size}px">${shown.map(n=>av(n,size,FRIEND_NAMES.includes(n)?'friend':'')).join('')}${more>0?`<span class="more">+${more}</span>`:''}</span>`;
}

/* ---------- ícones (traço único, 16 px) ---------- */
const I = {
  search:'<circle cx="7" cy="7" r="4.6"/><path d="m10.5 10.5 3.6 3.6"/>',
  arrow:'<path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/>',
  back:'<path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5"/>',
  left:'<path d="M10 3.5 5.5 8l4.5 4.5"/>',
  right:'<path d="M6 3.5 10.5 8 6 12.5"/>',
  chev:'<path d="m4.5 6.2 3.5 3.5 3.5-3.5"/>',
  x:'<path d="m4 4 8 8M12 4l-8 8"/>',
  check:'<path d="m3.5 8.4 3 3 6-6.4"/>',
  plus:'<path d="M8 3.5v9M3.5 8h9"/>',
  play:'<path d="M5.2 3.6v8.8L12.3 8z"/>',
  bolt:'<path d="M8.8 1.8 3.8 9h4l-.6 5.2L12.2 7h-4z"/>',
  lobbies:'<rect x="2.2" y="2.6" width="11.6" height="4.4" rx="1.3"/><rect x="2.2" y="9" width="11.6" height="4.4" rx="1.3"/><path d="M4.6 4.8h3M4.6 11.2h3"/>',
  modes:'<path d="M8 1.9 14 5 8 8.1 2 5z"/><path d="m2 8 6 3.1L14 8M2 11l6 3.1 6-3.1"/>',
  users:'<circle cx="6" cy="5.5" r="2.4"/><path d="M1.8 13.2c.4-2.3 2-3.6 4.2-3.6s3.8 1.3 4.2 3.6"/><circle cx="11.4" cy="5.9" r="1.9"/><path d="M11.6 9.6c1.6.2 2.6 1.3 2.9 3.1"/>',
  mail:'<rect x="2" y="3.5" width="12" height="9" rx="1.6"/><path d="m2.6 4.6 5.4 4 5.4-4"/>',
  sun:'<circle cx="8" cy="8" r="2.8"/><path d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M3.5 12.5l1.1-1.1M11.4 4.6l1.1-1.1"/>',
  plusSq:'<rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2.4"/><path d="M8 5.2v5.6M5.2 8h5.6"/>',
  download:'<path d="M8 2.5v7.2M5 6.9 8 9.8l3-2.9M2.8 11.2v1.2c0 .7.5 1.2 1.2 1.2h8c.7 0 1.2-.5 1.2-1.2v-1.2"/>',
  gear:'<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/><circle cx="8" cy="8" r="4.6"/>',
  sideC:'<rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M6 2.5v11M10.6 6.2 8.8 8l1.8 1.8"/>',
  railC:'<rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M10 2.5v11M5.4 6.2 7.2 8 5.4 9.8"/>',
  menu:'<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  palette:'<path d="M8 2a6 6 0 1 0 0 12c.9 0 1.3-.6 1.1-1.3-.3-.9.3-1.7 1.2-1.7H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2Z"/><circle cx="5" cy="7" r=".9" fill="currentColor"/><circle cx="7.6" cy="4.8" r=".9" fill="currentColor"/><circle cx="10.6" cy="5.8" r=".9" fill="currentColor"/>',
  star:'<path d="m8 2.4 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11l-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z"/>',
  lock:'<rect x="3.5" y="7" width="9" height="6.5" rx="1.6"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>',
  bell:'<path d="M4 11.5V7.2a4 4 0 0 1 8 0v4.3l1 1.2H3z"/><path d="M6.6 14.2a1.5 1.5 0 0 0 2.8 0"/>',
  knock:'<path d="M5 8.5V4.2a1.1 1.1 0 0 1 2.2 0V8M7.2 7.4V3.4a1.1 1.1 0 0 1 2.2 0v4M9.4 7.6V4.4a1.1 1.1 0 0 1 2.2 0v5.2c0 2.6-1.7 4.4-4.2 4.4-1.8 0-2.7-.8-3.7-2.2L2.4 9.4a1.1 1.1 0 0 1 1.8-1.2L5 9.2"/>',
  enterMid:'<path d="M2.5 8h7M7 5l3 3-3 3"/><path d="M12.5 3v10"/>',
  grid:'<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="9" width="4.5" height="4.5" rx="1.2"/>',
  rows:'<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
  signal:'<path d="M3 12.5v-1.5M6.3 12.5V9M9.6 12.5V6.5M12.9 12.5V4"/>',
  link:'<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.7.7"/><path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.7-.7"/>',
  monitor:'<rect x="2" y="2.8" width="12" height="8.4" rx="1.4"/><path d="M5.6 13.6h4.8M8 11.2v2.4"/>',
  pad:'<path d="M4.8 4.6h6.4a3 3 0 0 1 2.9 2.3l.7 3.1a1.8 1.8 0 0 1-3.1 1.6l-1.2-1.3H5.5l-1.2 1.3a1.8 1.8 0 0 1-3.1-1.6l.7-3.1a3 3 0 0 1 2.9-2.3Z"/><path d="M5.4 6.6v2M4.4 7.6h2"/><circle cx="10.6" cy="7.6" r=".6" fill="currentColor"/>',
  globe:'<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.7 1.7 2.5 3.7 2.5 6S9.7 12.3 8 14M8 2C6.3 3.7 5.5 5.7 5.5 8s.8 4.3 2.5 6"/>',
  refresh:'<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.8v2.6h-2.6"/>',
  crown:'<path d="M2.6 5.2 5.4 8 8 3.6 10.6 8l2.8-2.8-1 6.6H3.6z"/><path d="M3.6 13.4h8.8"/>',
  exit:'<path d="M9.5 3.5h3v9h-3M7 5.2 4.2 8 7 10.8M4.4 8h6"/>',
  info:'<circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.8M8 5v.2"/>',
  pause:'<path d="M5.6 3.8v8.4M10.4 3.8v8.4"/>',
  shrink:'<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2.6"/><path d="M8 .9v1.6M8 13.5v1.6M.9 8h1.6M13.5 8h1.6"/>',
  dice:'<rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4"/><circle cx="5.7" cy="5.7" r=".7" fill="currentColor"/><circle cx="10.3" cy="10.3" r=".7" fill="currentColor"/><circle cx="8" cy="8" r=".7" fill="currentColor"/>',
  swords:'<path d="m2.5 2.5 7 7M2.5 2.5h3M2.5 2.5v3M13.5 2.5l-7 7M13.5 2.5h-3M13.5 2.5v3M5 11l-2 2M11 11l2 2M4 9.5 6.5 12M12 9.5 9.5 12"/>',
  volume:'<path d="M2.5 6.2h2.2L8 3.5v9L4.7 9.8H2.5z"/><path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8"/>',
  copy:'<rect x="5.2" y="5.2" width="8.3" height="8.3" rx="1.6"/><path d="M10.8 5.2V3.8c0-.7-.6-1.3-1.3-1.3H3.8c-.7 0-1.3.6-1.3 1.3v5.7c0 .7.6 1.3 1.3 1.3h1.4"/>',
};
const ico=(n,c='')=>`<svg class="ico ${c}" viewBox="0 0 16 16" aria-hidden="true">${I[n]||''}</svg>`;

/* marca provisória (original): anel aberto com um nó, lido como "porta" */
const MARK = `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round">
<path d="M19.6 7.4A8.6 8.6 0 1 0 20.6 12" stroke-width="2.2"/><path d="M12 7.2v9.6" stroke-width="2.2"/><path d="M8.4 9.4v5.2M15.6 9.4v5.2" stroke-width="1.4" opacity=".55"/>
<circle cx="20.2" cy="4.6" r="1.7" fill="currentColor" stroke="none"/></svg>`;

/* =====================================================================
   CAPAS: emblemas de oficina oculta, pintados com var(--k*) do tema.
   Cada capa tem defs próprios (para herdar --m*, o deslocamento de matiz
   do modo) e usa filtros de desfoque globais.
   ===================================================================== */
let COVER_UID = 0;
function globalDefs(){
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <filter id="fb1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter>
  <filter id="fb2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2"/></filter>
  <filter id="fb3" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="fb4" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="24"/></filter>
  </defs></svg>`;
}
const S = (prop,v,op) => `style="${prop}:var(--${v})${op!=null?`;${prop==='stop-color'?'stop-opacity':prop==='fill'?'fill-opacity':'stroke-opacity'}:${op}`:''}"`;
function embers(seed,n,area=[20,16,360,200]){
  const r=rng('e'+seed); let o='';
  for(let i=0;i<n;i++){const x=area[0]+r()*area[2], y=area[1]+r()*area[3], s=.4+r()*1.3, op=.25+r()*.6, hot=r()>.7;
    o+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" ${S('fill',hot?'kc':'kh',op.toFixed(2))}${s>1.3?' filter="url(#fb1)"':''}/>`;}
  return o;
}
function coverDefs(u,k){
  const sd=MODES[k].seed;
  return `<defs>
  <radialGradient id="${u}g" gradientUnits="userSpaceOnUse" cx="200" cy="118" r="260"><stop offset="0" ${S('stop-color','m2',.5)}/><stop offset=".34" ${S('stop-color','m1',.95)}/><stop offset=".78" ${S('stop-color','k0')}/><stop offset="1" ${S('stop-color','k0')}/></radialGradient>
  <linearGradient id="${u}mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
  <mask id="${u}mk" maskUnits="userSpaceOnUse" x="-420" y="-40" width="1240" height="320"><rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}mg)"/></mask>
  <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" ${S('stop-color','kh')}/><stop offset=".26" ${S('stop-color','kl')}/><stop offset=".48" ${S('stop-color','kh',.95)}/><stop offset=".7" ${S('stop-color','kl')}/><stop offset="1" ${S('stop-color','m2')}/></linearGradient>
  <linearGradient id="${u}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" ${S('stop-color','kc')}/><stop offset=".45" ${S('stop-color','kh')}/><stop offset="1" ${S('stop-color','kl')}/></linearGradient>
  <linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" ${S('stop-color','m2',0)}/><stop offset="1" ${S('stop-color','m2',.7)}/></linearGradient>
  <radialGradient id="${u}vg" cx="50%" cy="46%" r="70%"><stop offset=".55" ${S('stop-color','k0',0)}/><stop offset="1" ${S('stop-color','k0',.92)}/></radialGradient>
  <filter id="${u}s" filterUnits="userSpaceOnUse" x="-420" y="-20" width="1240" height="300">
    <feTurbulence type="fractalNoise" baseFrequency=".0026 .017" numOctaves="5" seed="${sd}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.4 0 0 0 -2.02" result="a"/>
    <feFlood ${S('flood-color','ks')} result="c"/><feComposite in="c" in2="a" operator="in"/></filter>
  <filter id="${u}s2" filterUnits="userSpaceOnUse" x="-420" y="-20" width="1240" height="300">
    <feTurbulence type="fractalNoise" baseFrequency=".006 .045" numOctaves="4" seed="${sd+40}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -2.5" result="a"/>
    <feFlood ${S('flood-color','kh')} result="c"/><feComposite in="c" in2="a" operator="in"/></filter>
  </defs>`;
}
const smoke=(u,op=.4,y=-20,h=300)=>`<rect x="-420" y="${y}" width="1240" height="${h}" filter="url(#${u}s)" opacity="${op}" mask="url(#${u}mk)"/>`;
const smoke2=(u,op=.18,y=-20,h=300)=>`<rect x="-420" y="${y}" width="1240" height="${h}" filter="url(#${u}s2)" opacity="${op}"/>`;
const polar=(cx,cy,r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
const f1=n=>n.toFixed(1);

function emblem(k,u){
  const B=`url(#${u}b)`;
  if(k==='cp'){ // anel que fecha: diafragma de sete lâminas, pinos no aro
    const C=[200,120]; let ticks='', arcs='', nodes='', blades='', edges='';
    for(let i=0;i<120;i++){const a=i/120*Math.PI*2, L=i%10?4:8, [x1,y1]=polar(...C,90,a), [x2,y2]=polar(...C,90-L,a);
      ticks+=`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" ${S('stroke','kh',i%10?.32:.7)} stroke-width="${i%10?.6:1}"/>`;}
    const th=i=>-Math.PI/2+i/7*Math.PI*2, V=i=>polar(...C,21,th(i)), Q=i=>polar(...C,45,th(i)+.3), O=i=>polar(...C,61,th(i)+1.3), pt=p=>p.map(f1).join(' ');
    const open='M'+[0,1,2,3,4,5,6].map(i=>pt(V(i))).join('L')+'Z';
    for(let i=0;i<7;i++){const j=(i+1)%7;
      blades+=`<path d="M${pt(V(i))}L${pt(V(j))}Q${pt(Q(j))} ${pt(O(j))}A61 61 0 0 0 ${pt(O(i))}Q${pt(Q(i))} ${pt(V(i))}Z" ${S('fill',i%2?'kl':'k1',.92)}/>`;
      edges+=`M${pt(V(i))}Q${pt(Q(i))} ${pt(O(i))}`;}
    const P=[0,1,2,3,4,5,6].map(O);
    for(let i=0;i<7;i++){const a0=-Math.PI/2+i/7*Math.PI*2+.12, a1=a0+Math.PI*2/7-.24, [x0,y0]=polar(...C,58,a0),[x1,y1]=polar(...C,58,a1);
      arcs+=`M${f1(x0)} ${f1(y0)}A58 58 0 0 1 ${f1(x1)} ${f1(y1)}`;}
    P.forEach(([x,y])=>nodes+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="7" ${S('fill','m2',.6)} filter="url(#fb2)"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" ${S('fill','kc')}/>`);
    return `
    <rect x="194" y="-40" width="12" height="320" ${S('fill','m2',.35)} filter="url(#fb3)"/>
    <ellipse cx="200" cy="218" rx="170" ry="16" ${S('fill','m2',.35)} filter="url(#fb3)"/>
    <circle cx="200" cy="120" r="104" ${S('fill','m2',.22)} filter="url(#fb4)"/>
    <circle cx="200" cy="120" r="73" ${S('fill','k0',.62)}/>
    <circle cx="200" cy="120" r="99" fill="none" ${S('stroke','kh',.3)} stroke-width=".6"/>
    <circle cx="200" cy="120" r="95" fill="none" stroke="${B}" stroke-width="3.2"/>
    ${ticks}
    <circle cx="200" cy="120" r="76" fill="none" ${S('stroke','k0',.7)} stroke-width="11"/>
    <circle cx="200" cy="120" r="76" fill="none" stroke="${B}" stroke-width="7"/>
    <circle cx="200" cy="120" r="72.2" fill="none" ${S('stroke','k0',.6)} stroke-width="1"/>
    <path d="M131 92A76 76 0 0 1 228 49" fill="none" ${S('stroke','kc',.9)} stroke-width="1.6" stroke-linecap="round" filter="url(#fb1)"/>
    <circle cx="200" cy="120" r="30" ${S('fill','kc',.5)} filter="url(#fb3)"/>
    ${blades}
    <path d="${edges}" fill="none" ${S('stroke','k0',.7)} stroke-width="2.4"/>
    <path d="${edges}" fill="none" stroke="${B}" stroke-width="1.3"/>
    <path d="${edges}" fill="none" ${S('stroke','kc',.5)} stroke-width=".5" transform="translate(-.7 -.7)"/>
    <path d="${open}" fill="none" ${S('stroke','kc',.85)} stroke-width="1" stroke-linejoin="round"/>
    <path d="${arcs}" fill="none" ${S('stroke','m2')} stroke-width="6" opacity=".7" filter="url(#fb2)"/>
    <path d="${arcs}" fill="none" ${S('stroke','kh')} stroke-width="1.8" stroke-linecap="round"/>
    ${nodes}
    <circle cx="200" cy="120" r="11" ${S('fill','kc',.6)} filter="url(#fb2)"/>
    <circle cx="200" cy="120" r="3.4" ${S('fill','kc')}/>`;
  }
  if(k==='ub'){ // trilho, catenária e farol no ponto de fuga
    const V=[200,106]; let sl='', masts='';
    for(let i=1;i<=16;i++){const f=Math.pow(i/16,2.2), y=V[1]+138*f, hw=3+128*f;
      sl+=`<line x1="${f1(200-hw)}" y1="${f1(y)}" x2="${f1(200+hw)}" y2="${f1(y)}" ${S('stroke','kl',.9)} stroke-width="${(.4+3.2*f).toFixed(2)}"/><line x1="${f1(200-hw)}" y1="${f1(y-.6-1.2*f)}" x2="${f1(200+hw)}" y2="${f1(y-.6-1.2*f)}" ${S('stroke','kh',(.12+.3*f).toFixed(2))} stroke-width="${(.3+.8*f).toFixed(2)}"/>`;}
    for(let i=1;i<=6;i++){const f=Math.pow(i/6,1.9), xl=200-14-236*f, xr=200+14+236*f, yt=V[1]-16-96*f, yb=V[1]+138*f+4, w=(.5+3.4*f).toFixed(2);
      masts+=`<line x1="${f1(xl)}" y1="${f1(yt)}" x2="${f1(xl)}" y2="${f1(yb)}" ${S('stroke','kl')} stroke-width="${w}"/><line x1="${f1(xr)}" y1="${f1(yt)}" x2="${f1(xr)}" y2="${f1(yb)}" ${S('stroke','kl')} stroke-width="${w}"/>
      <line x1="${f1(xl)}" y1="${f1(yt+4*f)}" x2="${f1(200-6-60*f)}" y2="${f1(yt+4*f)}" ${S('stroke','kh',.35)} stroke-width="${(.4+1.2*f).toFixed(2)}"/><line x1="${f1(xr)}" y1="${f1(yt+4*f)}" x2="${f1(200+6+60*f)}" y2="${f1(yt+4*f)}" ${S('stroke','kh',.35)} stroke-width="${(.4+1.2*f).toFixed(2)}"/>`;}
    return `
    <ellipse cx="200" cy="106" rx="260" ry="34" ${S('fill','m2',.5)} filter="url(#fb4)"/>
    ${masts}
    <path d="M200 92 L-60 -10 M200 92 L460 -10" ${S('stroke','kh',.5)} stroke-width=".7"/>
    <path d="M200 96 Q60 40 -60 14 M200 96 Q340 40 460 14" fill="none" ${S('stroke','kh',.3)} stroke-width=".5"/>
    ${sl}
    <polygon points="197.6,106 199.4,106 86,250 60,250" fill="${B}"/>
    <polygon points="200.6,106 202.4,106 340,250 314,250" fill="${B}"/>
    <line x1="197.6" y1="106" x2="60" y2="250" ${S('stroke','kc',.85)} stroke-width=".8"/>
    <line x1="202.4" y1="106" x2="340" y2="250" ${S('stroke','kc',.85)} stroke-width=".8"/>
    <polygon points="197,106 203,106 360,250 40,250" ${S('fill','m2',.12)} filter="url(#fb3)"/>
    <ellipse cx="200" cy="104" rx="130" ry="1.6" ${S('fill','kc',.7)} filter="url(#fb1)"/>
    <circle cx="200" cy="104" r="26" ${S('fill','m2',.7)} filter="url(#fb3)"/>
    <circle cx="200" cy="104" r="7" ${S('fill','kc',.9)} filter="url(#fb2)"/>
    <circle cx="200" cy="104" r="2.6" ${S('fill','kc')}/>`;
  }
  if(k==='nb'){ // bússola afogada na neblina
    const C=[200,116]; let rays='', ring='';
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2, L=i%4?44:118, [x,y]=polar(...C,L,a);
      rays+=`<line x1="200" y1="116" x2="${f1(x)}" y2="${f1(y)}" ${S('stroke','kh',i%4?.25:.55)} stroke-width="${i%4?.6:1}"/>`;}
    for(let i=0;i<48;i++){const a=i/48*Math.PI*2,[x1,y1]=polar(...C,70,a),[x2,y2]=polar(...C,i%4?66:62,a); ring+=`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" ${S('stroke','kh',.5)} stroke-width=".7"/>`;}
    return `
    <polygon points="140,-30 166,-30 330,260 -40,260" ${S('fill','m2',.3)} filter="url(#fb3)"/>
    ${smoke(u,.55,20,260)}
    <circle cx="200" cy="116" r="70" fill="none" ${S('stroke','kh',.55)} stroke-width="1.1"/>
    <circle cx="200" cy="116" r="74" fill="none" ${S('stroke','kh',.22)} stroke-width=".6" stroke-dasharray="2 4"/>
    ${ring}${rays}
    <path d="M200 64 L208 116 L200 168 L192 116Z" fill="${B}" opacity=".92"/>
    <path d="M148 116 L200 110 L252 116 L200 122Z" fill="${B}" opacity=".6"/>
    <circle cx="200" cy="116" r="28" ${S('fill','m2',.6)} filter="url(#fb3)"/>
    <circle cx="200" cy="116" r="3" ${S('fill','kc')}/>
    <circle cx="153" cy="40" r="5" ${S('fill','kc',.9)} filter="url(#fb2)"/>
    <ellipse cx="200" cy="200" rx="320" ry="40" ${S('fill','ks',.16)} filter="url(#fb4)"/>
    ${smoke(u,.42,90,190)}${smoke2(u,.14,60,200)}`;
  }
  if(k==='cc'){ // roda de cofre com treliça
    let lat='', bolts='', spokes='';
    for(let i=-14;i<=24;i++){lat+=`<line x1="${i*26-110}" y1="-20" x2="${i*26+150}" y2="270" ${S('stroke','kl',.55)} stroke-width=".6"/><line x1="${i*26+150}" y1="-20" x2="${i*26-110}" y2="270" ${S('stroke','kl',.55)} stroke-width=".6"/>`;}
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2,[x,y]=polar(200,120,93,a); bolts+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="2.7" fill="${B}"/><circle cx="${f1(x-.7)}" cy="${f1(y-.7)}" r=".8" ${S('fill','kc',.8)}/>`;}
    for(let i=0;i<6;i++){const r=i*60+14; spokes+=`<g transform="rotate(${r} 200 120)"><line x1="200" y1="102" x2="200" y2="64" stroke="${B}" stroke-width="5" stroke-linecap="round"/><circle cx="200" cy="60" r="6.4" fill="${B}"/><circle cx="198.6" cy="58.6" r="1.6" ${S('fill','kc',.8)}/></g>`;}
    return lat+`
    <circle cx="200" cy="120" r="112" ${S('fill','m2',.32)} filter="url(#fb4)"/>
    <circle cx="200" cy="120" r="101" ${S('fill','k0',.82)}/>
    <circle cx="200" cy="120" r="93" fill="none" stroke="${B}" stroke-width="12"/>
    <circle cx="200" cy="120" r="86.5" fill="none" ${S('stroke','k0',.6)} stroke-width="1.2"/>
    ${bolts}
    <circle cx="200" cy="120" r="74" fill="none" ${S('stroke','m2',.7)} stroke-width=".8"/>
    <circle cx="200" cy="120" r="62" fill="none" stroke="${B}" stroke-width="3.4"/>
    ${spokes}
    <circle cx="200" cy="120" r="21" fill="${B}"/>
    <circle cx="200" cy="120" r="14" fill="none" ${S('stroke','k0',.55)} stroke-width="1.2"/>
    <circle cx="200" cy="120" r="6.5" ${S('fill','k0')}/>
    <path d="M124 70A93 93 0 0 1 222 29" fill="none" ${S('stroke','kc',.85)} stroke-width="2.2" stroke-linecap="round" filter="url(#fb1)"/>`;
  }
  if(k==='dm'){ // relógio à meia-noite, ponteiros como lâminas
    let ticks='';
    for(let i=0;i<60;i++){const L=i%5?4:11; ticks+=`<line x1="200" y1="${36}" x2="200" y2="${36+L}" ${S('stroke',i%5?'kh':'kc',i%5?.3:.75)} stroke-width="${i%5?.6:1.4}" transform="rotate(${i*6} 200 126)"/>`;}
    const blade=(rot,len,w)=>`<g transform="rotate(${rot} 200 126)"><polygon points="${200-w},132 200,${126-len} ${200+w},132 200,144" fill="url(#${u}v)"/><line x1="200" y1="${126-len+2}" x2="200" y2="138" ${S('stroke','kc',.9)} stroke-width=".6"/><rect x="${200-w*2.2}" y="130" width="${w*4.4}" height="2.4" rx="1" fill="${B}"/></g>`;
    return `
    <circle cx="312" cy="54" r="30" ${S('fill','kh',.6)}/><circle cx="324" cy="46" r="28" ${S('fill','k0')}/>
    <circle cx="312" cy="54" r="40" ${S('fill','m2',.25)} filter="url(#fb3)"/>
    <circle cx="200" cy="126" r="98" ${S('fill','m2',.22)} filter="url(#fb4)"/>
    <circle cx="200" cy="126" r="92" ${S('fill','k0',.72)}/>
    <circle cx="200" cy="126" r="92" fill="none" stroke="${B}" stroke-width="4"/>
    <circle cx="200" cy="126" r="97" fill="none" ${S('stroke','kh',.22)} stroke-width=".6"/>
    ${ticks}
    <ellipse cx="200" cy="42" rx="42" ry="20" ${S('fill','m2',.7)} filter="url(#fb3)"/>
    <g filter="url(#fb3)" opacity=".8">${blade(-9,86,6)}${blade(7,74,5)}</g>
    ${blade(-9,86,5)}${blade(7,74,4)}
    <circle cx="200" cy="126" r="8" fill="${B}"/><circle cx="200" cy="126" r="2.4" ${S('fill','kc')}/>
    <circle cx="200" cy="40" r="2.6" ${S('fill','kc')} filter="url(#fb1)"/>`;
  }
  if(k==='ct'){ // estande: grade em perspectiva, alvo e régua
    let g='', ruler='';
    for(let i=-18;i<=28;i++){const xb=i*28-130, x0=200+(xb-200)*.22; g+=`<line x1="${f1(x0)}" y1="128" x2="${xb}" y2="250" stroke="url(#${u}f)" stroke-width=".8"/>`;}
    for(let i=1;i<=12;i++){const f=Math.pow(i/12,2), y=128+122*f; g+=`<line x1="-420" y1="${f1(y)}" x2="820" y2="${f1(y)}" ${S('stroke','m2',(.08+.5*f).toFixed(2))} stroke-width="${(.3+.8*f).toFixed(2)}"/>`;}
    for(let i=0;i<=24;i++){const y=30+i*7.5; ruler+=`<line x1="${i%4?318:312}" y1="${y}" x2="324" y2="${y}" ${S('stroke','kh',i%4?.35:.7)} stroke-width="${i%4?.6:1}"/>`;}
    return g+ruler+`
    <line x1="-420" y1="128" x2="820" y2="128" ${S('stroke','m2')} stroke-width="1" filter="url(#fb1)"/>
    <ellipse cx="200" cy="128" rx="220" ry="16" ${S('fill','m2',.35)} filter="url(#fb3)"/>
    <line x1="324" y1="30" x2="324" y2="210" ${S('stroke','kh',.5)} stroke-width=".7"/>
    <ellipse cx="200" cy="176" rx="50" ry="7" ${S('fill','k0',.85)} filter="url(#fb2)"/>
    <line x1="200" y1="132" x2="200" y2="176" ${S('stroke','kl')} stroke-width="2.4"/>
    <circle cx="200" cy="90" r="50" ${S('fill','m2',.3)} filter="url(#fb4)"/>
    <circle cx="200" cy="90" r="38" ${S('fill','k0',.6)}/>
    <circle cx="200" cy="90" r="38" fill="none" stroke="${B}" stroke-width="3"/>
    <circle cx="200" cy="90" r="27" fill="none" ${S('stroke','m2')} stroke-width="5" opacity=".85"/>
    <circle cx="200" cy="90" r="16" fill="none" ${S('stroke','kh',.8)} stroke-width="1.2"/>
    <circle cx="200" cy="90" r="6" ${S('fill','m2')}/><circle cx="200" cy="90" r="2" ${S('fill','kc')}/>
    <path d="M200 40v12M200 128v-12M150 90h12M250 90h-12" ${S('stroke','kc',.7)} stroke-width="1"/>
    <path d="M168 58a45 45 0 0 1 40-13" fill="none" ${S('stroke','kc',.8)} stroke-width="1.4" stroke-linecap="round" filter="url(#fb1)"/>`;
  }
  return '';
}
const FRAME={cp:[1.06,0,4],ub:[1,0,0],nb:[1.12,0,6],cc:[1.5,74,34],dm:[1.22,-46,16],ct:[1.08,0,6]};
const FRAME_W={cp:[1.04,0,2],ub:[1,0,0],nb:[1.1,0,4],cc:[1.16,20,8],dm:[1.06,0,4],ct:[1,0,0]};
function frame(k,wide){const[s,dx,dy]=(wide?FRAME_W:FRAME)[k];return `translate(${200+dx} ${120+dy}) scale(${s}) translate(-200 -120)`}
function coverSVG(k,{wide=false}={}){
  const u='c'+(COVER_UID++)+'_';
  const vb = wide ? '-300 0 700 240' : '0 0 400 240';
  const sm = k==='nb' ? '' : smoke(u,k==='ub'?.45:.34);
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${coverDefs(u,k)}
  <rect x="-420" y="-40" width="1240" height="320" ${S('fill','k0')}/>
  <rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}g)"/>
  ${sm}
  <g transform="${frame(k,wide)}">${emblem(k,u)}</g>
  ${k==='nb'?'':smoke2(u,.1,110,170)}
  ${embers(k+(wide?'w':''),wide?34:20,wide?[-260,10,640,210]:[16,12,368,214])}
  <rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}vg)"/>
  </svg>`;
}
function paintCovers(root=document){
  root.querySelectorAll('[data-cover]').forEach(el=>{
    if(el.dataset.painted) return; el.dataset.painted='1';
    const k=el.dataset.cover; el.style.setProperty('--m',MODES[k].shift);
    el.insertAdjacentHTML('afterbegin',coverSVG(k,{wide:el.hasAttribute('data-wide')}));
  });
}
function repaintCover(el,k){el.dataset.cover=k;el.dataset.painted='';el.querySelector('svg')?.remove();paintCovers(el.parentNode||document)}

/* line-art de maquinário: engrenagem, anéis de régua e cruz de mira */
function lineArt(){
  let teeth='';const N=36,R1=232,R2=248;
  for(let i=0;i<N;i++){const a0=i/N*Math.PI*2,a1=a0+Math.PI/N*.9,a2=a0+Math.PI/N*1.1,a3=a0+Math.PI*2/N;
    const p=(r,a)=>`${f1(300+r*Math.cos(a))} ${f1(300+r*Math.sin(a))}`;
    teeth+=(i?'L':'M')+p(R1,a0)+'L'+p(R2,a0+.02)+'L'+p(R2,a1)+'L'+p(R1,a1+.02)+'L'+p(R1,a2)+'L'+p(R1,a3);}
  let ticks='';for(let i=0;i<180;i++){const a=i/180*Math.PI*2,L=i%15?6:16;const[x1,y1]=polar(300,300,196,a),[x2,y2]=polar(300,300,196-L,a);ticks+=`M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;}
  return `<svg viewBox="0 0 600 600" aria-hidden="true"><path d="${teeth}Z" stroke-width="1"/><circle cx="300" cy="300" r="214" stroke-width="1"/>
  <path d="${ticks}" stroke-width=".8"/><circle cx="300" cy="300" r="150" stroke-width="1" stroke-dasharray="3 6"/><circle cx="300" cy="300" r="96" stroke-width="1.2"/>
  <circle cx="300" cy="300" r="40" stroke-width="1"/><path d="M300 20v560M20 300h560" stroke-width=".7"/><circle cx="452" cy="148" r="58" stroke-width="1"/><circle cx="452" cy="148" r="22" stroke-width="1"/></svg>`;
}

/* =====================================================================
   TEMAS
   ===================================================================== */
const THEMES = [
  {id:'deadlock',   name:'Deadlock',   note:'Verde-fumaça, pergaminho e âmbar. Padrão.', sw:['hsl(170 16% 7%)','hsl(35 85% 56%)']},
  {id:'carmim',     name:'Carmim',     note:'Vinho e carmim.', sw:['hsl(345 30% 6%)','hsl(350 76% 49%)']},
  {id:'pergaminho', name:'Pergaminho', note:'Quase preto quente e creme.', sw:['hsl(20 10% 7%)','hsl(42 60% 84%)']},
  {id:'gelo',       name:'Gelo',       note:'Frio, herdeiro da pele B.', sw:['hsl(218 30% 6%)','hsl(190 92% 70%)']},
  {id:'grafite',    name:'Grafite',    note:'Neutro e calmo, para longas sessões.', sw:['hsl(225 6% 11%)','hsl(20 50% 64%)']},
];
function setTheme(id){
  document.documentElement.dataset.theme=id; store.set('theme',id);
  $$('.theme-opt').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.theme===id)));
}

/* =====================================================================
   CASCA (estrutura da pele B): barra superior + trilho social fixo
   ===================================================================== */
function inRoom(){return store.get('room',null)}
function titlebar(page){
  const room=inRoom(); const rl=room&&lobbyById(room.id);
  return `
  <a class="brand" href="home.html" aria-label="Lobby, início">${MARK}<b>Lobby</b></a>
  <nav class="nav" aria-label="Principal"><a href="home.html" ${page==='home'?'aria-current="page"':''}>Jogar</a><a href="home.html#modos">Modos</a><a href="#">Hoje</a><a href="#">Instalar</a></nav>
  <span class="tb-sp"></span>
  <label class="search"><span class="sr">Buscar</span>${ico('search')}<input id="q" type="search" placeholder="Buscar lobby, modo ou jogador" autocomplete="off"><kbd>Ctrl K</kbd></label>
  ${rl?'':`<span class="live-count"><span class="dot-live"></span><b class="num" data-live>${totalPlaying()}</b><span class="w">jogando</span></span>`}
  <a class="room-pill" href="sala.html?l=${rl?rl.id:''}" ${rl?'':'hidden'} data-roompill>${stack(rl?rl.inside.slice(0,3):[],22)}<span class="rp-name">Na sala · ${rl?esc(rl.name):''}</span><span class="num">${rl?`${room.n}/${rl.max}`:''}</span></a>
  <button class="icon-btn only-phone" data-act="search" aria-label="Buscar">${ico('search')}</button>
  <span class="theme-pop" id="themePop"><button class="icon-btn" data-act="theme" aria-haspopup="true" aria-expanded="false" aria-label="Tema">${ico('palette')}</button>
    <div class="theme-menu" role="menu"><div class="cap">Tema</div>${THEMES.map(t=>`<button class="theme-opt" role="menuitemradio" data-theme="${t.id}" aria-checked="false"><span class="sw" style="background:linear-gradient(135deg,${t.sw[0]} 0 55%,${t.sw[1]} 55%)"></span><span><b>${t.name}</b><small>${t.note}</small></span>${ico('check')}</button>`).join('')}</div></span>
  <button class="acct" aria-label="Sua conta: ${ME}">${pres(ME,30,'on')}<span>${ME}</span>${ico('chev')}</button>`;
}
function friendRow(f,action='Entrar'){
  const l=f.where&&lobbyById(f.where);
  const sub=l?`${f.verb} <em>${esc(l.name)}</em>`:esc(f.txt);
  const btn=l?(action==='Entrar'?`<a class="btn btn-s btn-sm" href="sala.html?l=${l.id}">Entrar</a>`:`<button class="btn btn-s btn-sm" data-invite="${esc(f.name)}">Convidar</button>`)
            :`<button class="btn btn-g btn-sm" data-invite="${esc(f.name)}">${action==='Entrar'?'Chamar':'Convidar'}</button>`;
  return `<div class="fr">${pres(f.name,32,f.st)}<div class="fr-t"><b>${esc(f.name)}</b><small>${sub}</small></div>${btn}</div>`;
}
let toastT;
function toast(msg,icon='check'){
  let t=$('.toast'); if(!t){t=document.createElement('div');t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.innerHTML=ico(icon)+`<span>${msg}</span>`; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),2600);
}
function mountShell(page){
  document.body.insertAdjacentHTML('afterbegin',globalDefs());
  $('#tb').innerHTML=titlebar(page);
  setTheme(document.documentElement.dataset.theme||'deadlock');
  const html=document.documentElement;
  const close=()=>html.classList.remove('sheet-open');
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-act]'); const pop=$('#themePop');
    if(pop && !e.target.closest('#themePop')){pop.classList.remove('open');pop.firstElementChild.setAttribute('aria-expanded','false')}
    if(e.target.closest('.theme-opt')){setTheme(e.target.closest('.theme-opt').dataset.theme);return}
    if(e.target.classList.contains('scrim')){close();return}
    if(!a) return;
    const act=a.dataset.act;
    if(act==='sheet'){e.preventDefault();html.classList.toggle('sheet-open')}
    else if(act==='close'){close()}
    else if(act==='theme'){e.stopPropagation();pop.classList.toggle('open');a.setAttribute('aria-expanded',String(pop.classList.contains('open')))}
    else if(act==='search'){toast('A busca abre aqui no app; no protótipo, use a barra no desktop.','search')}
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const q=$('#q');if(q&&q.offsetParent){q.focus();q.select()}}
    if(e.key==='Escape'){close();$('#themePop')?.classList.remove('open')}
  });
  document.addEventListener('click',e=>{const b=e.target.closest('[data-invite]');if(b){b.textContent='Chamado';b.disabled=true;toast(`Convite enviado para ${b.dataset.invite}.`,'mail')}});
  const rail=$('#rail'); if(rail) rail.insertAdjacentHTML('afterbegin',`<div class="sheet-h"><b>${page==='home'?'Amigos e convites':'Sala'}</b><button class="icon-btn" data-act="close" aria-label="Fechar">${ico('x')}</button></div>`);
  $$('.lineart[data-art]').forEach(el=>el.innerHTML=lineArt());
}
