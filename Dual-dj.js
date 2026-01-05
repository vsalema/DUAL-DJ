(() => {
  // ✅ XML PLAYLIST SOURCES
  const playlistSources = [
    { id:"electro",     name:"Electro",     url:"https://vsalema.github.io/tvpt4/css/electro.xml",     image:"https://audioplayer.luna-universe.com/playlists/cover/42.jpg" },
    { id:"drumandbass", name:"Drum & Bass", url:"https://vsalema.github.io/tvpt4/css/drumandbass.xml", image:"https://audioplayer.luna-universe.com/playlists/cover/23.jpg" },
    { id:"ambient",     name:"Ambient",     url:"https://vsalema.github.io/tvpt4/css/ambient.xml",     image:"https://audioplayer.luna-universe.com/playlists/cover/25.jpg" },
  ];

  const DEFAULT_COVER = "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=640&q=80";

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[m]));
  }

  function inferTitleFromFile(url){
    try{
      const file = decodeURIComponent(String(url).split("/").pop() || "Track");
      return file
        .replace(/\.(mp3|aac|m4a|ogg|wav)$/i,"")
        .replace(/_preview$/i,"")
        .replace(/[_-]+/g," ")
        .trim() || "Track";
    }catch(_){ return "Track"; }
  }

  function resolveMaybeRelative(file, baseUrl){
    try{ return new URL(file, baseUrl).href; }catch(_){ return file; }
  }

  function isProbablyAudioFile(url){
    const s = String(url || "").toLowerCase();
    return /\.(mp3|aac|m4a|ogg|wav)(\?|#|$)/i.test(s);
  }

  function normalizeImgUrl(url){
    const u = String(url || "").trim();
    if(!u) return "";
    try{ return encodeURI(new URL(u, location.href).href); }
    catch(_){ return encodeURI(u); }
  }

  function sameUrl(a,b){
    try{
      const aa = new URL(String(a||""), location.href).href;
      const bb = new URL(String(b||""), location.href).href;
      return aa === bb;
    }catch(_){
      return String(a||"") === String(b||"");
    }
  }

  function parsePlaylistXml(xmlText, playlist){
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const parserError = doc.getElementsByTagName("parsererror");
    if(parserError && parserError.length) throw new Error("XML parse error");

    const li = Array.from(doc.getElementsByTagName("li"));
    const out = [];

    for(const node of li){
      const rawFile = node.getAttribute("data-file") || node.getAttribute("data-src") || "";
      if(!rawFile) continue;

      const file = resolveMaybeRelative(rawFile, playlist.url);
      if(!file || !isProbablyAudioFile(file)) continue;

      const rawImg = (node.getAttribute("data-image") || node.getAttribute("data-cover") || "").trim();
      const imgResolved = rawImg ? resolveMaybeRelative(rawImg, playlist.url) : (playlist.image || DEFAULT_COVER);

      const title  = (node.getAttribute("data-songtitle") || node.getAttribute("data-title") || "").trim() || inferTitleFromFile(file);
      const artist = (node.getAttribute("data-songartist") || node.getAttribute("data-artist") || "").trim() || playlist.name;

      out.push({
        __kind: "mp3",
        __playlistId: playlist.id,
        __fallbackCover: playlist.image || DEFAULT_COVER,
        name: title,
        subtitle: `${playlist.name} • MP3`,
        streamUrl: file,
        cover: imgResolved || "",
        logo: imgResolved || "",
        artist: artist,
        badge: "MP3",
      });
    }
    return out;
  }

  async function fetchText(url){
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  async function fetchJson(url){
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // ✅ WEB RADIO (JSON)
  const WEBRADIO_JSON_URL = "https://vsalema.github.io/ipodfm/stations.json";
  let webRadioStations = [];

  function normalizeWebRadioItem(item, baseUrl){
    const name = String(item.name || item.title || "Web radio").trim() || "Web radio";
    const desc = String(item.description || item.rds || item.subtitle || "").trim();
    const url  = String(item.url || item.streamUrl || item.stream || "").trim();
    const logoRaw = String(item.logo || item.image || "").trim();

    const logo = logoRaw ? (()=>{
      try{ return new URL(logoRaw, baseUrl).href; }catch(_){ return logoRaw; }
    })() : "";

    const streamUrl = url;
    const subtitle = desc ? `Web radio • ${desc}` : "Web radio";

    return {
      __kind: "webradio",
      __id: String(item.id || item.freq || name).trim(),
      name,
      subtitle,
      streamUrl,
      cover: logo,
      logo: logo,
      artist: desc || "Web radio",
      badge: "LIVE"
    };
  }

  async function loadWebRadiosJson(){
    const data = await fetchJson(WEBRADIO_JSON_URL);
    const baseUrl = WEBRADIO_JSON_URL;

    let arr = [];
    if(Array.isArray(data)) arr = data;
    else if(data && Array.isArray(data.webRadios)) arr = data.webRadios;
    else if(data && Array.isArray(data.fmStations)) arr = data.fmStations;

    const parsed = arr
      .map(x => normalizeWebRadioItem(x, baseUrl))
      .filter(x => x && x.streamUrl);

    const seen = new Set();
    webRadioStations = [];
    for(const st of parsed){
      const key = String(st.streamUrl);
      if(seen.has(key)) continue;
      seen.add(key);
      webRadioStations.push(st);
    }
    return webRadioStations;
  }

  // UI refs
  const dj = document.getElementById("dj");
  const audio = document.getElementById("audio");
  const bgCover = document.getElementById("bgCover");

  const btnLibrary = document.getElementById("btnLibrary");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnEject = document.getElementById("btnEject");
  const btnShuffle = document.getElementById("btnShuffle");
  const btnRepeat = document.getElementById("btnRepeat");
  const btnAutoNext = document.getElementById("btnAutoNext");
  const btnTheme = document.getElementById("btnTheme");

  const statusText = document.getElementById("statusText");
  const chipDot = document.getElementById("chipDot");

  const nowCover = document.getElementById("nowCover");
  const nowTitle = document.getElementById("nowTitle");
  const nowSub = document.getElementById("nowSub");

  const wrapA = document.getElementById("wrapA");
  const wrapB = document.getElementById("wrapB");
  const diskMountA = document.getElementById("diskMountA");
  const diskMountB = document.getElementById("diskMountB");

  const platterVizA = document.getElementById("platterVizA");

  
  const deckHelpA = document.getElementById("deckHelpA");
const carriage = document.getElementById("carriage");
  const gripper = document.getElementById("gripper");
  const recordCarrier = document.getElementById("recordCarrier");

  
  const carriageLayerEl = document.getElementById("carriageLayer");
const elRoot = document.documentElement;
  const elDisk = document.getElementById("disk");
  const labelImg = document.getElementById("labelImg");

  const elTonearmLayer = document.getElementById("tonearmLayer");
  const elTonearmRotor = document.getElementById("tonearmRotor");

  // ✅ Audio sync avec la pose de l’aiguille (son audible seulement quand le bras est "down")
  let ARM_DESIRED_VOL = 1;
  let armCueMuteActive = false;

  function armRememberDesiredVolume(){
    // garde la dernière valeur "audible" (utile si on a temporairement mis le volume à 0)
    if(!armCueMuteActive){
      const v = (typeof audio.volume === "number") ? audio.volume : 1;
      ARM_DESIRED_VOL = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
      if(ARM_DESIRED_VOL === 0) ARM_DESIRED_VOL = 1;
    }
  }

  function armCueMute(){
    armRememberDesiredVolume();
    armCueMuteActive = true;
    audio.volume = 0;
  }

  function armCueRestoreImmediate(){
    audio.volume = ARM_DESIRED_VOL;
    armCueMuteActive = false;
  }

  const ARM_AUDIO_FADE_MS = 240;

  function armCueFadeIn(){
    const to = ARM_DESIRED_VOL;
    const t0 = performance.now();
    function step(t){
      const p = Math.min(1, (t - t0) / ARM_AUDIO_FADE_MS);
      audio.volume = to * p;
      if(p < 1) requestAnimationFrame(step);
      else armCueMuteActive = false;
    }
    requestAnimationFrame(step);
  }

  function armUnmuteWhenDown(){
    // si déjà posé, on fade tout de suite
    if(elTonearmLayer.classList.contains("down")){
      armCueFadeIn();
      return;
    }
    elTonearmLayer.addEventListener("arm:down", () => armCueFadeIn(), { once:true });
  }


  // Drawer
  const drawer = document.getElementById("drawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerClose = document.getElementById("drawerClose");

  const playlistGrid = document.getElementById("playlistGrid");
  const trackList = document.getElementById("trackList");
  const wrList = document.getElementById("wrList");

  const mp3Hint = document.getElementById("mp3Hint");
  const tracksHint = document.getElementById("tracksHint");
  const wrHint = document.getElementById("wrHint");

  const mp3Count = document.getElementById("mp3Count");
  const wrCount = document.getElementById("wrCount");
  const mp3Sub = document.getElementById("mp3Sub");
  const wrSub = document.getElementById("wrSub");

  // VU
  const vuMeter = document.getElementById("vuMeter");
  const vuLabel = document.getElementById("vuLabel");
  const VU_BARS = 24;
  const vuBars = [];
  for(let i=0;i<VU_BARS;i++){
    const b = document.createElement("div");
    b.className = "vuBar";
    vuMeter.appendChild(b);
    vuBars.push(b);
  }

  // State
  const state = {
    busy:false,
    playing:false,
    shuffle:false,
    repeat:false,
    autoNext:false,
    recordLocation:"A",

    currentItem: null,
    queue: [],
    queueIndex: -1,
    activePlaylistId: null,

    lastGoodCover: DEFAULT_COVER
  };

  function setStatus(text, on){
    statusText.textContent = text;
    chipDot.classList.toggle("on", !!on);
  }
  function setToggle(btn, on){ btn.classList.toggle("on", !!on); }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
  function getRect(el){ return el.getBoundingClientRect(); }
  function getCenterInDj(el){
    const djRect = getRect(dj);
    const r = getRect(el);
    return { x: (r.left - djRect.left) + r.width/2, y: (r.top - djRect.top) + r.height/2 };
  }
  function setCarriageX(x){
    const djRect = getRect(dj);
    const baseX = djRect.width / 2;
    const dx = x - baseX;
    carriage.style.transform = `translateX(calc(-50% + ${dx}px))`;
  }
  function ensureDiskOnMount() {
    if(state.recordLocation === "A"){
      if(elDisk.parentElement !== diskMountA) diskMountA.appendChild(elDisk);
    } else {
      if(elDisk.parentElement !== diskMountB) diskMountB.appendChild(elDisk);
    }
  }

  // ✅ Cover centre : IMG + fallback
  function setDiskCover(url, fallback){
    const primary = normalizeImgUrl(url);
    const fb = normalizeImgUrl(fallback || "") || DEFAULT_COVER;

    if(!primary){
      labelImg.src = fb;
      state.lastGoodCover = fb;
      return;
    }

    labelImg.onerror = () => {
      const safe = normalizeImgUrl(fallback || "") || state.lastGoodCover || DEFAULT_COVER;
      labelImg.onerror = null;
      labelImg.src = safe;
    };

    labelImg.onload = () => {
      state.lastGoodCover = primary;
      labelImg.onload = null;
    };

    labelImg.src = primary;
  }

  function setBackgroundCover(url){
    const safe = normalizeImgUrl(url || "");
    if(!bgCover) return;

    if(!safe){
      bgCover.style.opacity = "0";
      bgCover.style.backgroundImage = "";
      return;
    }

    bgCover.style.opacity = "0.18";
    requestAnimationFrame(() => {
      bgCover.style.backgroundImage = `url('${safe}')`;
      bgCover.style.opacity = "0.50";
    });
  }

  function setNowPlaying(item){
    if(!item){
      nowCover.style.backgroundImage = "";
      nowTitle.textContent = "Aucun titre";
      nowSub.textContent = "Sélectionne un MP3 / Web radio";
      setBackgroundCover("");
      return;
    }

    const cov = normalizeImgUrl(item.cover || item.logo || "");
    nowCover.style.backgroundImage = cov ? `url('${cov}')` : "";
    nowTitle.textContent = item.name || "Lecture";
    nowSub.textContent = item.subtitle || "";

    setBackgroundCover(cov);
  }

  // Drawer open/close (calé sur #dj)
  function syncDrawerToDj(){
    if(!dj) return;

    const r = dj.getBoundingClientRect();

    // Calage dans le viewport (drawer en position:fixed)
    const left = Math.max(0, r.left);
    const top  = Math.max(0, r.top);

    const w = Math.max(320, Math.min(r.width, window.innerWidth - left));
    const h = Math.max(240, Math.min(r.height, window.innerHeight - top));

    document.documentElement.style.setProperty("--dj-left", `${left}px`);
    document.documentElement.style.setProperty("--dj-top",  `${top}px`);
    document.documentElement.style.setProperty("--dj-w",    `${w}px`);
    document.documentElement.style.setProperty("--dj-h",    `${h}px`);
  }

  // sync initial + resize/scroll + changements de taille
  syncDrawerToDj();
  window.addEventListener("resize", () => requestAnimationFrame(syncDrawerToDj), { passive:true });
  window.addEventListener("scroll",  () => requestAnimationFrame(syncDrawerToDj), { passive:true });

  if("ResizeObserver" in window && dj){
    const ro = new ResizeObserver(() => requestAnimationFrame(syncDrawerToDj));
    ro.observe(dj);
  }

  function openDrawer(){
    syncDrawerToDj(); // ✅ calcule la position exacte juste avant d'ouvrir
    drawer.classList.add("open");
    drawerOverlay.classList.add("open");
    btnLibrary.classList.add("on");
  }
  function closeDrawer(){
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
    btnLibrary.classList.remove("on");
  }
  btnLibrary.addEventListener("click", () => drawer.classList.contains("open") ? closeDrawer() : openDrawer());
  drawerClose.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);
  window.addEventListener("keydown", (e) => { if(e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });

  
  // Accordéon Quick Open
 // ===============================
// QUICK OPEN + FAVORIS (persistant)
// ===============================
const quickToggle = document.getElementById("quickToggle");
const quickContent = document.getElementById("quickContent");
const quickRoot = quickToggle ? quickToggle.closest(".drawerQuick") : null;

function setQuickOpen(open){
  if(!quickToggle || !quickContent || !quickRoot) return;
  quickRoot.classList.toggle("open", !!open);
  quickToggle.setAttribute("aria-expanded", open ? "true" : "false");
  quickContent.hidden = !open;
}

// fermé par défaut (tu peux mettre true si tu veux l’ouvrir au lancement)
setQuickOpen(false);

if(quickToggle){
  quickToggle.addEventListener("click", () => {
    const isOpen = quickToggle.getAttribute("aria-expanded") === "true";
    setQuickOpen(!isOpen);
  });
}

// UI refs
const btnOpenFile = document.getElementById("btnOpenFile");
const localFileInput = document.getElementById("localFileInput");
const urlInput = document.getElementById("urlInput");
const btnOpenUrl = document.getElementById("btnOpenUrl");
const btnFavUrl = document.getElementById("btnFavUrl");
const autoFavOnUrl = document.getElementById("autoFavOnUrl");

const openHint = document.getElementById("openHint");

const recentList = document.getElementById("recentList");
const recentCount = document.getElementById("recentCount");

const favList = document.getElementById("favList");
const btnExportFav = document.getElementById("btnExportFav");
const btnImportFav = document.getElementById("btnImportFav");
const favImportInput = document.getElementById("favImportInput");

// Storage keys
const LS_FAV = "dualDj_favorites_v1";
const LS_AUTO_FAV = "dualDj_autoFavOnUrl_v1";

// Optionnel : liste de favoris “par défaut” (mets tes URLs ici si tu veux)
const DEFAULT_FAVORITES = [
  // { name: "Radio Example", url: "https://example.com/stream.mp3" },
];
// ===============================
// ✅ Mask opacity control
// ===============================
const maskAslider = document.getElementById("maskAslider");
const maskAminus  = document.getElementById("maskAminus");
const maskAplus   = document.getElementById("maskAplus");
const maskAvalue  = document.getElementById("maskAvalue");

const LS_MASK_ALPHA = "dualDj_vizMaskAlpha_v1";

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setMaskAlphaPct(pct){
  const p = clamp(pct, 0, 100);
  const a = p / 100;

  document.documentElement.style.setProperty("--vizMaskAlpha", a.toFixed(2));

    if(maskAvalue){
    const tag = (p <= 15) ? "FULL" : (p >= 85) ? "RING" : "";
    maskAvalue.innerHTML = `<span class="maskTag">${tag}</span><span class="maskPct">${p}%</span>`;
  }
  if(maskAslider) maskAslider.value = String(p);

  try{ localStorage.setItem(LS_MASK_ALPHA, String(p)); }catch(_){}
}

function loadMaskAlpha(){
  let p = 88;
  try{
    const raw = localStorage.getItem(LS_MASK_ALPHA);
    if(raw !== null){
      const n = parseInt(raw, 10);
      if(Number.isFinite(n)) p = n;
    }
  }catch(_){}
  setMaskAlphaPct(p);
}

function stepMaskAlpha(delta){
  const cur = parseInt(maskAslider?.value || "88", 10) || 88;
  setMaskAlphaPct(cur + delta);
}

if(maskAslider){
  maskAslider.addEventListener("input", () => {
    const p = parseInt(maskAslider.value, 10) || 0;
    setMaskAlphaPct(p);
  });
}

if(maskAminus) maskAminus.addEventListener("click", () => stepMaskAlpha(-5));
if(maskAplus)  maskAplus.addEventListener("click", () => stepMaskAlpha(+5));

// Init
loadMaskAlpha();

function setOpenHint(msg){
  if(openHint) openHint.textContent = msg;
}

function safeAbsUrl(u){
  const raw = String(u || "").trim();
  if(!raw) return "";
  try{ return new URL(raw, location.href).href; }
  catch(_){ return raw; }
}

function inferNameFromUrl(u){
  try{
    const file = decodeURIComponent(String(u).split("/").pop() || "Audio");
    return file
      .replace(/\.(mp3|aac|m4a|ogg|wav|flac|opus|m3u8)$/i,"")
      .replace(/[_-]+/g," ")
      .trim() || "Audio";
  }catch(_){ return "Audio"; }
}

// ---------- RECENT (non persistant) ----------
const recentItems = [];
let lastObjectUrl = "";

function addRecent(item){
  if(!item) return;
  const key = String(item.streamUrl || "");
  const i0 = recentItems.findIndex(x => String(x.streamUrl || "") === key);
  if(i0 >= 0) recentItems.splice(i0, 1);

  recentItems.unshift(item);
  if(recentItems.length > 8) recentItems.length = 8;
  renderRecent();
}

function renderRecent(){
  if(!recentList || !recentCount) return;
  recentCount.textContent = String(recentItems.length);

  recentList.innerHTML = "";
  if(!recentItems.length){
    const h = document.createElement("div");
    h.className = "drawerHint";
    h.textContent = "Aucune source récente. Ouvre un fichier local ou colle une URL.";
    recentList.appendChild(h);
    return;
  }

  for(const it of recentItems){
    const row = document.createElement("div");
    const active = state.currentItem && state.currentItem.streamUrl === it.streamUrl;
    row.className = "trackItem" + (active ? " active" : "");

    const badge = it.badge || (it.__kind === "local" ? "LOCAL" : "URL");
    const sub = it.subtitle || "";
    const title = it.name || "Audio";

    row.innerHTML = `
      <div class="trackThumb" style="background-image:url('')"></div>
      <div class="trackTxt">
        <div class="trackTitle">${escapeHtml(title)}</div>
        <div class="trackSub">${escapeHtml(sub)}</div>
      </div>
      <div class="badge">${escapeHtml(badge)}</div>
    `;

    row.addEventListener("click", async () => {
      await changeSourceWhilePlaying(it, [it], 0);
    });

    recentList.appendChild(row);
  }
}

// ---------- FAVORIS (persistant) ----------
let favorites = [];

function loadFavorites(){
  try{
    const raw = localStorage.getItem(LS_FAV);
    favorites = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(favorites)) favorites = [];
  }catch(_){
    favorites = [];
  }

  // Seed defaults si aucun favori sauvegardé
  if(!favorites.length && DEFAULT_FAVORITES.length){
    favorites = DEFAULT_FAVORITES.map(x => ({
      name: String(x.name || inferNameFromUrl(x.url)).trim(),
      url: safeAbsUrl(x.url)
    })).filter(x => x.url);
    saveFavorites();
  }
}

function saveFavorites(){
  try{ localStorage.setItem(LS_FAV, JSON.stringify(favorites)); }catch(_){}
}

function normalizeFavItem(name, url){
  const u = safeAbsUrl(url);
  if(!u) return null;
  return {
    name: String(name || inferNameFromUrl(u)).trim() || inferNameFromUrl(u),
    url: u
  };
}

function favToPlayable(f){
  return {
    __kind: "url",
    __id: `fav:${f.url}`,
    name: f.name || inferNameFromUrl(f.url),
    subtitle: "Favori • URL",
    streamUrl: f.url,
    cover: "",
    logo: "",
    artist: "Favori",
    badge: "★",
    __fallbackCover: state.lastGoodCover || DEFAULT_COVER
  };
}

function addFavorite(name, url){
  const item = normalizeFavItem(name, url);
  if(!item) return false;

  const key = item.url;
  const i0 = favorites.findIndex(x => String(x.url) === key);
  if(i0 >= 0){
    // si déjà présent, remonte + met à jour le nom si besoin
    favorites[i0].name = item.name || favorites[i0].name;
    const moved = favorites.splice(i0, 1)[0];
    favorites.unshift(moved);
  }else{
    favorites.unshift(item);
  }

  if(favorites.length > 50) favorites.length = 50;
  saveFavorites();
  renderFavorites();
  return true;
}

function removeFavorite(url){
  const key = String(url || "");
  const i0 = favorites.findIndex(x => String(x.url) === key);
  if(i0 >= 0){
    favorites.splice(i0, 1);
    saveFavorites();
    renderFavorites();
  }
}

function renderFavorites(){
  if(!favList) return;

  favList.innerHTML = "";
  if(!favorites.length){
    const h = document.createElement("div");
    h.className = "drawerHint";
    h.textContent = "Aucun favori. Lis une URL puis clique ★, ou active l’auto-favori.";
    favList.appendChild(h);
    return;
  }

  for(const f of favorites){
    const playable = favToPlayable(f);

    const row = document.createElement("div");
    const active = state.currentItem && state.currentItem.streamUrl === playable.streamUrl;
    row.className = "trackItem favItem" + (active ? " active" : "");

    row.innerHTML = `
      <div class="trackThumb" style="background-image:url('')"></div>
      <div class="trackTxt">
        <div class="trackTitle">${escapeHtml(playable.name)}</div>
        <div class="trackSub">${escapeHtml(f.url)}</div>
      </div>
      <button class="favRemove" type="button" title="Supprimer">✕</button>
      <div class="badge">★</div>
    `;

    row.addEventListener("click", async () => {
      await changeSourceWhilePlaying(playable, [playable], 0);
      setStatus("Prêt (favori sur Deck A)", false);
      addRecent(playable);
    });

    const btnX = row.querySelector(".favRemove");
    btnX.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeFavorite(f.url);
    });

    favList.appendChild(row);
  }
}

// autoFav option
function loadAutoFavOption(){
  try{
    const v = localStorage.getItem(LS_AUTO_FAV);
    const on = (v === null) ? true : (v === "1");
    if(autoFavOnUrl) autoFavOnUrl.checked = on;
  }catch(_){
    if(autoFavOnUrl) autoFavOnUrl.checked = true;
  }
}
function saveAutoFavOption(){
  try{
    localStorage.setItem(LS_AUTO_FAV, (autoFavOnUrl && autoFavOnUrl.checked) ? "1" : "0");
  }catch(_){}
}
if(autoFavOnUrl){
  autoFavOnUrl.addEventListener("change", saveAutoFavOption);
}

// export/import
function exportFavorites(){
  const data = JSON.stringify({ version: 1, favorites }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dual-dj-favoris.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 250);
}

async function importFavoritesFile(file){
  if(!file) return;
  try{
    const txt = await file.text();
    const obj = JSON.parse(txt);
    const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.favorites) ? obj.favorites : []);
    const cleaned = arr.map(x => normalizeFavItem(x.name, x.url)).filter(Boolean);
    favorites = cleaned.slice(0, 50);
    saveFavorites();
    renderFavorites();
    setOpenHint("Favoris importés ✔");
  }catch(e){
    console.warn(e);
    setOpenHint("Import impossible (JSON invalide).");
  }
}

if(btnExportFav) btnExportFav.addEventListener("click", exportFavorites);

if(btnImportFav && favImportInput){
  btnImportFav.addEventListener("click", () => favImportInput.click());
  favImportInput.addEventListener("change", async () => {
    const f = favImportInput.files && favImportInput.files[0];
    await importFavoritesFile(f);
  });
}

// ---------- Actions Local / URL ----------
async function openLocalFile(file){
  if(!file) return;

  // libère l’ancien objectURL
  if(lastObjectUrl){
    try{ URL.revokeObjectURL(lastObjectUrl); }catch(_){}
    lastObjectUrl = "";
  }

  const objUrl = URL.createObjectURL(file);
  lastObjectUrl = objUrl;

  const name = (file.name || "Fichier audio").replace(/\.(mp3|aac|m4a|ogg|wav|flac|opus)$/i,"");
  const item = {
    __kind: "local",
    __id: `local:${file.name}:${file.size}:${file.lastModified}`,
    name,
    subtitle: `Fichier local • ${file.type || "audio"}`,
    streamUrl: objUrl,
    cover: "",
    logo: "",
    artist: "Local file",
    badge: "LOCAL",
    __fallbackCover: state.lastGoodCover || DEFAULT_COVER
  };

  await changeSourceWhilePlaying(item, [item], 0);
  setStatus("Prêt (fichier local sur Deck A)", false);
  addRecent(item);
  setOpenHint("Fichier local chargé. ▶ Play pour envoyer sur Deck B.");
}

async function openUrlStream(u){
  const url = safeAbsUrl(u);
  if(!url){
    setOpenHint("Colle une URL valide puis clique « Lire URL ».");
    return;
  }

  const item = {
    __kind: "url",
    __id: `url:${url}`,
    name: inferNameFromUrl(url),
    subtitle: "URL • Audio",
    streamUrl: url,
    cover: "",
    logo: "",
    artist: "URL",
    badge: "URL",
    __fallbackCover: state.lastGoodCover || DEFAULT_COVER
  };

  await changeSourceWhilePlaying(item, [item], 0);
  setStatus("Prêt (URL sur Deck A)", false);
  addRecent(item);

  // ✅ option : auto-ajout favoris
  const auto = autoFavOnUrl ? !!autoFavOnUrl.checked : true;
  if(auto){
    addFavorite(item.name, item.streamUrl);
  }

  setOpenHint("URL chargée. ▶ Play pour envoyer sur Deck B.");
}

if(btnOpenFile && localFileInput){
  localFileInput.style.display = "none";
  btnOpenFile.addEventListener("click", () => {
    try{ localFileInput.value = ""; }catch(_){}
    localFileInput.click();
  });
  localFileInput.addEventListener("change", async () => {
    const f = localFileInput.files && localFileInput.files[0];
    await openLocalFile(f);
  });
}

if(btnOpenUrl && urlInput){
  btnOpenUrl.addEventListener("click", async () => {
    await openUrlStream(urlInput.value);
  });
  urlInput.addEventListener("keydown", async (e) => {
    if(e.key === "Enter"){
      e.preventDefault();
      await openUrlStream(urlInput.value);
    }
  });
}

// ★ Favori manuel depuis l’input URL
if(btnFavUrl && urlInput){
  btnFavUrl.addEventListener("click", () => {
    const ok = addFavorite("", urlInput.value);
    setOpenHint(ok ? "Ajouté aux favoris ★" : "URL invalide.");
  });
}

// Init
loadFavorites();
loadAutoFavOption();
renderFavorites();
renderRecent();


// AUDIO ANALYSER (VU)
  let audioCtx = null;
  let analyser = null;
  let analyserData = null;
  let sourceNode = null;

  function ensureAnalyser(){
    if(analyser) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;

    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    analyserData = new Uint8Array(analyser.frequencyBinCount);
  }

  // ✅ AudioMotion (Radial Ring) — Deck A vide
  let aMotion = null;
  let aMotionReady = false;

  const aMotionThemes = ["classic","prism","rainbow","steelblue","orangered"];
  let aMotionThemeIndex = 0;
function ensureAudioMotion(){
  if(aMotionReady) return;
  if(typeof AudioMotionAnalyzer === "undefined"){
    console.warn("AudioMotionAnalyzer introuvable (CDN non chargé).");
    return;
  }
  if(!platterVizA) return;

  try{
    aMotion = new AudioMotionAnalyzer(platterVizA, {
      source: sourceNode || audio,
      connectSpeakers: false,

      /* ✅ Option A: ring "toujours vivant" */
      mode: 1,                // beaucoup de bandes
      fftSize: 8192,

      smoothing: 0.55,        // moins lissé => plus nerveux
      minDecibels: -100,      // capte les niveaux faibles
      maxDecibels: -12,       // pousse plus haut => plus de punch

      /* ✅ RADIAL */
      radial: true,
      radius: 0.50,
      spinSpeed: 1.15,        // un peu plus "club"
      radialInvert: false,

      /* ✅ Look LED */
      bgAlpha: 0,
      showPeaks: true,        // peaks visibles => plus spectaculaire
      lineWidth: 1.25,        // contour léger
      fillAlpha: 0.78,        // ✅ plus rempli => plus visible
      gradient: aMotionThemes[aMotionThemeIndex],

      /* ✅ barres plus serrées => ring plus dense */
      barSpace: 0.18,
      lumiBars: true
    });

    aMotionReady = true;
  }catch(e){
    console.warn("AudioMotion init failed:", e);
  }
}

  
  function setAudioMotionTheme(name){
    if(!aMotionReady || !aMotion) return;
    try{ aMotion.setOptions({ gradient: name }); }catch(_){}
  }

  function nextAudioMotionTheme(){
    aMotionThemeIndex = (aMotionThemeIndex + 1) % aMotionThemes.length;
    setAudioMotionTheme(aMotionThemes[aMotionThemeIndex]);
  }

  function setPlatterAVizOn(isOn){
    if(!platterVizA) return;

    if(isOn){
      ensureAudioMotion();
      platterVizA.classList.add("isOn");
      if(deckHelpA) deckHelpA.classList.add("isHidden");   // ✅ cache l'aide quand le viz est visible
    }else{
      platterVizA.classList.remove("isOn");
      if(deckHelpA) deckHelpA.classList.remove("isHidden");
    }
  }

  if(btnTheme){
    btnTheme.addEventListener("click", () => nextAudioMotionTheme());
  }

  // VU animation
  let vuSmooth = new Array(VU_BARS).fill(0);

  function updateVU(dt){
    if(!analyser || !analyserData){
      const t = performance.now() * 0.001;
      for(let i=0;i<VU_BARS;i++){
        const v = 0.02 + 0.02 * Math.sin(t*1.2 + i*0.35);
        vuBars[i].style.height = `${Math.round(8 + v*18)}%`;
        vuBars[i].classList.remove("hot");
      }
      vuLabel.textContent = "— dB";
      return;
    }

    analyser.getByteFrequencyData(analyserData);

    const start = 2;
    const end = Math.min(analyserData.length-1, 220);
    const slice = end - start;

    let sum = 0;
    for(let i=start;i<end;i++) sum += analyserData[i];
    const avg = sum / slice;

    const norm = avg / 255;
    const db = (norm > 0.0001) ? (20 * Math.log10(norm)) : -60;
    vuLabel.textContent = `${db.toFixed(1)} dB`;

    for(let i=0;i<VU_BARS;i++){
      const idx = Math.floor(start + (i / (VU_BARS-1)) * slice);
      const v = analyserData[idx] / 255;

      const a = 1 - Math.exp(-dt * 18);
      vuSmooth[i] = vuSmooth[i] + (v - vuSmooth[i]) * a;

      const h = Math.max(0.06, Math.min(1, vuSmooth[i]));
      const pct = 8 + h * 92;
      vuBars[i].style.height = `${pct.toFixed(1)}%`;
      vuBars[i].classList.toggle("hot", pct > 82);
    }
  }

  // TONEARM + DISK SPIN
  const ARM_REST_DEG  =  40;
  let ARM_START_DEG =  24; // lead-in (début des rainures)
  let ARM_END_DEG   =  -6; // fin (près de l'étiquette)

  function armReadTuning(){
    const cs = getComputedStyle(elRoot);
    const s = parseFloat(cs.getPropertyValue("--arm-start-deg"));
    const e = parseFloat(cs.getPropertyValue("--arm-end-deg"));
    if(Number.isFinite(s)) ARM_START_DEG = s;
    if(Number.isFinite(e)) ARM_END_DEG = e;
  }
  armReadTuning();

  // 🔧 Helpers console (optionnel)
  window.setArmLeadIn = (deg) => { elRoot.style.setProperty("--arm-start-deg", String(deg)); armReadTuning(); console.log("arm lead-in =", ARM_START_DEG); };
  window.setArmInner  = (deg) => { elRoot.style.setProperty("--arm-end-deg", String(deg));   armReadTuning(); console.log("arm inner  =", ARM_END_DEG); };


  const ARM_CUE_SEC      = 0.65;
  const ARM_RETURN_SEC   = 0.90;
  const ARM_DROP_DELAY   = 0.18;
  const ARM_TRACK_FOLLOW = 6.5;

  const ARM_WOW_DEG = 0.42;
  const ARM_WOW_HZ  = 1.05;

  let isPlaying = false;          // moteur "spin + suivi aiguille"
  let armAngleDeg = ARM_REST_DEG;
  let armMove = null;
  let armDropTimer = null;
  let armPendingDrop = false;

  let armWowPhase = 0;
  let armWowDeg = 0;
  let armWowSmoothed = 0;
  let spinPhase = 0;
  // Inertie plateau (spin-down) : petite décélération réaliste à l'arrêt
  const SPIN_RUN_RAD_PER_SEC = 3.4906585; // 33 1/3 rpm
  const SPIN_COAST_TAU = 0.85;            // secondes (plus petit = s'arrête plus vite)
  const SPIN_STOP_EPS = 0.03;             // seuil arrêt (rad/s)
  let spinVel = 0;                        // rad/s courant
  let spinMode = "stop";                // "run" | "coast" | "stop"

  let lastTs = performance.now();

  function easeInOutCubic(p){ return (p < 0.5) ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; }
  function armApplyTransform(){ elTonearmRotor.style.setProperty("--arm-rot", `${armAngleDeg + armWowDeg}deg`); }

  function armStartMove(toDeg, durSec, after=null){
    armMove = { from: armAngleDeg, to: toDeg, t:0, dur: Math.max(0.001, durSec), after };
  }

  function armSetRestImmediate(){
    armPendingDrop = false;
    clearTimeout(armDropTimer);
    elTonearmLayer.classList.remove("down","playing");
    armMove = null;
    armAngleDeg = ARM_REST_DEG;
    armApplyTransform();
  }

  function armRequestDrop(){ armPendingDrop = true; }

  function armDoDropSoon(){
    clearTimeout(armDropTimer);
    armDropTimer = setTimeout(() => {
      if(!isPlaying) return;
      if(!armPendingDrop) return;
      elTonearmLayer.classList.add("down");
      elTonearmLayer.dispatchEvent(new CustomEvent("arm:down"));
      armPendingDrop = false;
    }, Math.round(ARM_DROP_DELAY * 1000));
  }

  function armCueToStartAndDrop(){
    clearTimeout(armDropTimer);
    elTonearmLayer.classList.remove("down");
    armStartMove(ARM_START_DEG, ARM_CUE_SEC, () => {
      if(armPendingDrop && isPlaying) armDoDropSoon();
    });
  }

  function armReturnToRest(){
    armPendingDrop = false;
    clearTimeout(armDropTimer);
    elTonearmLayer.classList.remove("down","playing");
    armStartMove(ARM_REST_DEG, ARM_RETURN_SEC, () => {
      armAngleDeg = ARM_REST_DEG;
      armApplyTransform();
    });
  }

  function armUpdate(dt){
    if(armMove){
      armMove.t += dt;
      const p = Math.min(1, armMove.t / armMove.dur);
      const e = easeInOutCubic(p);
      armAngleDeg = armMove.from + (armMove.to - armMove.from) * e;
      armApplyTransform();
      if(p >= 1){
        const after = armMove.after;
        armMove = null;
        if(typeof after === "function") after();
      }
      return;
    }

    if(isPlaying && state.recordLocation === "B"){
      const d = audio.duration;
      const t = audio.currentTime;
      const prog = (isFinite(d) && d > 0) ? Math.max(0, Math.min(1, t / d)) : 0;
      const target = ARM_START_DEG + (ARM_END_DEG - ARM_START_DEG) * prog;

      const a = 1 - Math.exp(-dt * ARM_TRACK_FOLLOW);
      armAngleDeg = armAngleDeg + (target - armAngleDeg) * a;

      armWowPhase += dt * (Math.PI * 2) * ARM_WOW_HZ;
      const wowTarget = ARM_WOW_DEG * (0.78 * Math.sin(armWowPhase) + 0.22 * Math.sin(armWowPhase * 2.0));
      const aw = 1 - Math.exp(-dt * 10.0);
      armWowSmoothed = armWowSmoothed + (wowTarget - armWowSmoothed) * aw;
      armWowDeg = armWowSmoothed;

      armApplyTransform();
      const gl = 0.06 * Math.max(0, Math.sin((armAngleDeg * Math.PI) / 180));
      elRoot.style.setProperty("--arm-glint", gl.toFixed(3));
    } else {
      armWowDeg *= Math.exp(-dt * 8.0);
      armWowSmoothed *= Math.exp(-dt * 8.0);
      armApplyTransform();
    }
  }

  function diskUpdate(dt){
    const motorOn = (isPlaying && state.recordLocation === "B");

    // Moteur ON → vitesse nominale
    if(motorOn){
      spinMode = "run";
      spinVel = SPIN_RUN_RAD_PER_SEC;
    } else {
      // Passage moteur OFF → on lance le "coast" (inertie)
      if(spinMode === "run"){
        spinMode = "coast";
        if(!isFinite(spinVel) || spinVel <= 0) spinVel = SPIN_RUN_RAD_PER_SEC;
      }
    }

    // Inertie : décélération exponentielle douce
    if(spinMode === "coast"){
      const k = Math.exp(-dt / Math.max(0.05, SPIN_COAST_TAU));
      spinVel *= k;
      if(spinVel < SPIN_STOP_EPS){
        spinVel = 0;
        spinMode = "stop";
      }
    }

    if(spinMode !== "stop"){
      spinPhase += dt * spinVel;
      elDisk.style.transform = `rotate(${spinPhase}rad)`;
      elDisk.style.setProperty("--spin", `${spinPhase}rad`);
    }
  }

  /* ===== Speaker engine (no controls) ===== */
  const speakerSlots = {
    A: document.querySelector(".speakerSlotA"),
    B: document.querySelector(".speakerSlotB")
  };

  function layoutSpeakers(){
    for(const [k, slot] of Object.entries(speakerSlots)){
      if(!slot) continue;
      const deck = slot.closest(".deckInner");
      const platter = deck?.querySelector(k === "A" ? "#platterA" : "#platterB");
      if(!deck || !platter) continue;

      // Under-platter area (keep Dual DJ layout untouched: absolute overlay)
      const gap = 8;            // closer to platter (premium look)
      const bottomPad = 14;     // keep away from rounded deck border

      const y0 = platter.offsetTop + platter.offsetHeight + gap;
      const avail = Math.max(0, deck.clientHeight - y0 - bottomPad);

      // Size tuned to match your Photoshop mock:
      // - big enough to read
      // - never clips
      // - scales with platter
      const ideal = platter.offsetWidth * 0.55;
      const maxByDeck = deck.clientWidth * 0.62;
      const size = Math.max(210, Math.min(320, Math.min(ideal, maxByDeck, avail)));

      // Place speaker slightly "floating" in the remaining space (not stuck to the bottom)
      const offsetInAvail = Math.max(0, (avail - size) * 0.22);
      const yAdjust = (k === "B") ? -12 : 0; // raise Deck B a bit to match Deck A
      const top = y0 + offsetInAvail + yAdjust;

      slot.style.top = `${Math.round(top)}px`;
      slot.style.width = `${Math.round(size)}px`;
      slot.style.height = `${Math.round(size)}px`;

      // opacity stays stable (no more harsh fades)
      slot.style.opacity = avail < 140 ? "0.70" : "0.96";
    }
  }

  // responsive: resize + font load + small delays
  window.addEventListener("resize", () => requestAnimationFrame(layoutSpeakers));
  setTimeout(layoutSpeakers, 60);
  setTimeout(layoutSpeakers, 220);

  // ===============================
  // Speaker ring pulse preset
  // Preset: EDM_CLUB
  // ===============================
  const RING_PRESET = {
    name: "EDM_CLUB",
    atk: 0.820,          // attack (0..1)
    rel: 0.075,          // release (0..1)
    transientGain: 6.000,
    transientMix: 0.300,
    threshold: 0.020,
    shapePow: 0.550,
    baseOpacity: 0.160,
    opacityGain: 0.800,
    widthGain: 8.200,
  };

  class SpeakerDriver{
    constructor(slot){
      this.slot = slot;
      const svg = slot.querySelector("svg");

      // geometry (supports different SVG layouts)
      this.cx = parseFloat(svg?.dataset?.wooferCx || "280");
      this.cy = parseFloat(svg?.dataset?.wooferCy || "280");

      this.coneGroup = svg.querySelector('[data-part="coneGroup"]');
      this.surround  = svg.querySelector('[data-part="surround"]');
      this.dustcap   = svg.querySelector('[data-part="dustcap"]');
      this.spec      = svg.querySelector('[data-part="coneSpec"]');
      this.dispCone  = svg.querySelector('[data-part="dispCone"]');
      this.turbCone  = svg.querySelector('[data-part="turbCone"]');

      // Hi‑Fi dual: optional tweeter + pulsing ring
      this.pulseRing   = svg.querySelector('[data-part="pulseRing"]');
      this.tweeterDome = svg.querySelector('[data-part="tweeterDome"]');
      this.tweeterSpec = svg.querySelector('[data-part="tweeterSpec"]');

      // baselines from SVG
      this.baseDustR = this.dustcap ? parseFloat(this.dustcap.getAttribute("r") || "34") : 34;
      this.baseTweeterR = this.tweeterDome ? parseFloat(this.tweeterDome.getAttribute("r") || "18") : 18;
      this.baseRingW = this.pulseRing ? parseFloat(this.pulseRing.getAttribute("stroke-width") || "10") : 10;

      this.env = 0;
      this.kickEnv = 0;
      this.prevKickTarget = 0;
    }

    update(dt, inst, bass, rms, kick){
      // envelope: mix bass energy + RMS (fast attack, slower release)
      const target = Math.min(1, Math.max(0, 0.34*bass + 0.88*Math.pow(rms*3.2, 0.92)));
      const a = target > this.env ? 0.26 : 0.11;
      this.env += (target - this.env) * (1 - Math.pow(1-a, dt*60));

      // displacement (time-domain * envelope)
      const DISP_MAX = 20; // controlled but visible
      const disp = inst * this.env * DISP_MAX;

      const squash  = 1 - Math.abs(disp) * 0.0038;
      const stretch = 1 + Math.abs(disp) * 0.0048;

      // cone motion
      if(this.coneGroup){
        this.coneGroup.setAttribute(
          "transform",
          `translate(${this.cx} ${this.cy}) translate(0 ${(-disp * 0.88).toFixed(2)}) scale(${stretch.toFixed(4)} ${squash.toFixed(4)})`
        );
      }

      // surround micro
      if(this.surround){
        const surScale = 1 + this.env * 0.010;
        this.surround.setAttribute("transform", `translate(${this.cx} ${this.cy}) scale(${surScale.toFixed(4)}) translate(-${this.cx} -${this.cy})`);
      }

      // dustcap breath
      if(this.dustcap){
        const dustR = this.baseDustR + this.env * 3.8 + (disp * 0.05);
        this.dustcap.setAttribute("r", dustR.toFixed(2));
      }

      // specular reacts
      if(this.spec){
        const specOp = (0.14 + this.env * 0.20) * (1 - Math.min(0.55, Math.abs(disp)/40));
        this.spec.setAttribute("opacity", specOp.toFixed(3));
      }

      // cone micro-texture (subtle)
      if(this.dispCone) this.dispCone.setAttribute("scale", (2.6 + this.env * 5.2).toFixed(2));
      if(this.turbCone) this.turbCone.setAttribute("baseFrequency", (0.60 + this.env * 0.16).toFixed(3));

      // pulsing black ring (kick-style): ultra fast attack + soft release, driven by bass-kick energy
      if(this.pulseRing){
        const targetKick = Math.min(1, Math.max(0, (kick ?? bass)));
        // kick envelope: fast attack + controlled release (preset)
        const atk = RING_PRESET.atk;
        const rel = RING_PRESET.rel
        const k = targetKick > this.kickEnv ? atk : rel;
        this.kickEnv += (targetKick - this.kickEnv) * (1 - Math.pow(1 - k, dt * 60));

        // transient boost (accent kicks without staying "stuck" on sustained bass)
        const d = Math.max(0, targetKick - (this.prevKickTarget || 0));
        this.prevKickTarget = targetKick;
        const transient = Math.min(1, d * RING_PRESET.transientGain);

        // shape: emphasize hits, keep premium restraint
        const shaped = Math.pow(Math.max(0, this.kickEnv - RING_PRESET.threshold) / (1 - RING_PRESET.threshold), RING_PRESET.shapePow);
        const p = Math.min(1, shaped + transient * RING_PRESET.transientMix);

        this.pulseRing.setAttribute("opacity", (RING_PRESET.baseOpacity + p * RING_PRESET.opacityGain).toFixed(3));
        this.pulseRing.setAttribute("stroke-width", (this.baseRingW + p * RING_PRESET.widthGain).toFixed(2));
      }

      // tweeter micro life (very subtle, hi‑fi)
      if(this.tweeterDome){
        const t = Math.min(1, 0.55*this.env + 0.55*bass);
        this.tweeterDome.setAttribute("r", (this.baseTweeterR + t*1.8).toFixed(2));
        this.tweeterDome.setAttribute("opacity", (0.58 + t*0.26).toFixed(3));
      }
      if(this.tweeterSpec){
        const t = Math.min(1, 0.55*this.env + 0.55*bass);
        this.tweeterSpec.setAttribute("opacity", (0.26 + t*0.22).toFixed(3));
      }
    }
  }

  const speakerA = speakerSlots.A ? new SpeakerDriver(speakerSlots.A) : null;
  const speakerB = speakerSlots.B ? new SpeakerDriver(speakerSlots.B) : null;

  // allocate once, when analyser exists
  let speakerTimeData = null;

  function updateSpeakers(dt){
    // layout can change during animations (carriage / resize)
    // (cheap guard: occasional relayout)
    if((performance.now()|0) % 900 < 16) layoutSpeakers();

    if(!speakerA && !speakerB) return;

    // idle animation when analyser isn't ready
    if(!analyser){
      const t = performance.now() * 0.001;
      const inst = Math.sin(t*2.0) * 0.10;
      const bass = 0.10 + 0.08*Math.sin(t*1.2);
      const rms = 0.06 + 0.02*Math.sin(t*1.6);
      speakerA?.update(dt, inst, bass, rms, bass);
      speakerB?.update(dt, inst, bass, rms, bass);
      return;
    }

    if(!speakerTimeData || speakerTimeData.length !== analyser.fftSize){
      speakerTimeData = new Float32Array(analyser.fftSize);
    }

    // time domain
    analyser.getFloatTimeDomainData(speakerTimeData);
    let sumSq = 0;
    for(let i=0;i<speakerTimeData.length;i++){
      const v = speakerTimeData[i];
      sumSq += v*v;
    }
    const rms = Math.sqrt(sumSq / speakerTimeData.length);

    const mid = (speakerTimeData.length/2)|0;
    const inst = (speakerTimeData[mid-2] + speakerTimeData[mid] + speakerTimeData[mid+2]) / 3;

    // bass energy from existing FFT buffer (already filled by updateVU)
    // make sure it's filled at least once
    if(analyserData) analyser.getByteFrequencyData(analyserData);
    // bass + kick energy from FFT (reuse existing analyser)
    let bass = 0, kick = 0;
    if(analyserData){
      const avgBins = (from, to) => {
        to = Math.min(analyserData.length, to);
        from = Math.max(0, from);
        if(to <= from + 1) return 0;
        let s = 0;
        for(let i=from;i<to;i++) s += analyserData[i];
        return (s / (to - from)) / 255; // 0..1
      };

      // broad bass (sub + low bass)
      bass = avgBins(2, 26);

      // kick focus (tighter low band + a little punch band)
      const lowKick   = avgBins(3, 14);
      const punchKick = avgBins(14, 22);
      kick = Math.min(1, (lowKick * 0.85) + (punchKick * 0.15));
    }

    speakerA?.update(dt, inst, bass, rms, kick);
    speakerB?.update(dt, inst, bass, rms, kick);
  }

function loop(ts){
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    armUpdate(dt);
    diskUpdate(dt);
    updateVU(dt);
    updateSpeakers(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function resetSpin(){
    spinPhase = 0;
    spinVel = 0;
    spinMode = "stop";
    elDisk.style.transform = "rotate(0rad)";
    elDisk.style.setProperty("--spin","0rad");
  }


  // RECORD TRANSFER (A→B)
  async function animateTransfer(from, to){
    
    if(carriageLayerEl) carriageLayerEl.classList.add("active");
const cA = getCenterInDj(wrapA);
    const cB = getCenterInDj(wrapB);
    const src = (from === "A") ? cA : cB;
    const dst = (to === "A") ? cA : cB;

    setCarriageX(src.x);
    await sleep(220);

    gripper.classList.remove("lift"); gripper.classList.add("down","open");
    await sleep(240);
    gripper.classList.remove("open"); gripper.classList.add("close");
    await sleep(220);

    const w = getRect(wrapA).width;
    recordCarrier.style.width = `${w}px`;
    recordCarrier.style.height = `${w}px`;

    recordCarrier.classList.add("on");
    recordCarrier.style.left = `${src.x}px`;
    recordCarrier.style.top = `${src.y}px`;
    recordCarrier.style.transform = "translate(-50%,-50%) translate(0px,0px)";
    recordCarrier.appendChild(elDisk);

    gripper.classList.remove("down"); gripper.classList.add("lift");
    await sleep(220);

    setCarriageX(dst.x);

    const dx = dst.x - src.x;
    const dy = dst.y - src.y;
    const anim = recordCarrier.animate(
      [
        { transform: "translate(-50%,-50%) translate(0px,0px) rotate(0deg)" },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(720deg)` }
      ],
      { duration: 1100, easing: "cubic-bezier(.2,.85,.2,1)", fill: "forwards" }
    );
    await anim.finished;

    gripper.classList.remove("lift"); gripper.classList.add("down");
    await sleep(220);
    gripper.classList.remove("close"); gripper.classList.add("open");
    await sleep(180);

    if(to === "A") diskMountA.appendChild(elDisk);
    else diskMountB.appendChild(elDisk);

    state.recordLocation = to;
    ensureDiskOnMount();

    // ✅ Deck A vide => AudioMotion ON (disque sur B)
    setPlatterAVizOn(state.recordLocation === "B");

    recordCarrier.classList.remove("on");
    recordCarrier.getAnimations().forEach(a => a.cancel());

    gripper.classList.remove("down"); gripper.classList.add("lift","open");
    await sleep(220);

    setCarriageX(cA.x);
    await sleep(420);

    gripper.classList.remove("close","down"); gripper.classList.add("open","lift");
  
    if(carriageLayerEl) carriageLayerEl.classList.remove("active");
}

  // Selection / queue helpers
  function setCurrentItem(item, queue, idx){
    state.currentItem = item || null;
    state.queue = Array.isArray(queue) ? queue : [];
    state.queueIndex = (typeof idx === "number") ? idx : -1;

    const cover = item?.cover || item?.logo || "";
    const fallback = item?.__fallbackCover || state.lastGoodCover || DEFAULT_COVER;

    setDiskCover(cover, fallback);
    setNowPlaying(item);

    renderTracksActive();
    renderWebRadioActive();
  }

  function hasQueue(){ return Array.isArray(state.queue) && state.queue.length > 0; }

  function pickNextIndexForward(){
    if(!hasQueue()) return -1;
    if(state.shuffle){
      if(state.queue.length === 1) return 0;
      let n = state.queueIndex;
      for(let i=0;i<12;i++){
        const r = Math.floor(Math.random() * state.queue.length);
        if(r !== n) return r;
      }
      return Math.floor(Math.random() * state.queue.length);
    }
    const next = state.queueIndex + 1;
    if(next < state.queue.length) return next;
    return 0;
  }

  function pickPrevIndexBackward(){
    if(!hasQueue()) return -1;
    if(state.shuffle){
      if(state.queue.length === 1) return 0;
      let n = state.queueIndex;
      for(let i=0;i<12;i++){
        const r = Math.floor(Math.random() * state.queue.length);
        if(r !== n) return r;
      }
      return Math.floor(Math.random() * state.queue.length);
    }
    const prev = state.queueIndex - 1;
    if(prev >= 0) return prev;
    return state.queue.length - 1;
  }

  async function changeSourceWhilePlaying(item, queue, idx){
    setCurrentItem(item, queue, idx);

    if(state.playing){
      try{
        ensureAnalyser();
        if(audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
        audio.src = state.currentItem.streamUrl;
        await audio.play();
        setStatus("Lecture", true);
      }catch(e){
        console.warn(e);
        setStatus("Erreur audio", false);
      }
    } else {
      setStatus("Prêt (Play)", false);
    }
  }

  async function doNextPrev(dir){
    if(!hasQueue()){
      setStatus("Aucune piste", false);
      return;
    }
    const idx = (dir === "next") ? pickNextIndexForward() : pickPrevIndexBackward();
    if(idx < 0) return;
    const item = state.queue[idx];
    await changeSourceWhilePlaying(item, state.queue, idx);
  }

  // Buttons Next/Prev
  btnNext.addEventListener("click", () => doNextPrev("next"));
  btnPrev.addEventListener("click", () => doNextPrev("prev"));

  // Playback core
  async function playCurrentSource(){
    if(!state.currentItem || !state.currentItem.streamUrl) return false;
    audio.src = state.currentItem.streamUrl;
    try{ await audio.play(); return true; }
    catch(e){ console.warn("audio.play failed:", e); return false; }
  }

  async function playResumeIfPossible(){
    if(!state.currentItem?.streamUrl) return false;
    if(!audio.src) return false;
    if(!sameUrl(audio.src, state.currentItem.streamUrl)) return false;
    if(!(audio.currentTime > 0.05)) return false;
    if(isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.15) return false;

    try{
      await audio.play();
      return true;
    }catch(e){
      console.warn("resume failed:", e);
      return false;
    }
  }

  async function playSequence(){
    if(state.busy || state.playing) return;
    if(!state.currentItem || !state.currentItem.streamUrl){
      setStatus("Choisis un titre / radio", false);
      return;
    }

    state.busy = true;
    setStatus("Play…", true);
    btnPlayPause.disabled = true;
    btnEject.disabled = true;
    btnNext.disabled = true;
    btnPrev.disabled = true;

    try{
      ensureDiskOnMount();
      ensureAnalyser();                // ✅ crée sourceNode (pour AudioMotion aussi)
      ensureAudioMotion();             // ✅ instance prête (mais affichée seulement si Deck A vide)
      if(audioCtx && audioCtx.state === "suspended") await audioCtx.resume();

      // disque sur Deck A → transfert A→B
      if(state.recordLocation === "A"){
        armSetRestImmediate();
        resetSpin();
        await animateTransfer("A","B");  // => active viz Deck A automatiquement

        isPlaying = true;
        elTonearmLayer.classList.add("playing");
        armRequestDrop();
        armCueToStartAndDrop();

        audio.currentTime = 0;
        armCueMute();
        armUnmuteWhenDown();
        const ok = await playCurrentSource();
        if(!ok) throw new Error("play failed after transfer");
      } else {
        const resumed = await playResumeIfPossible();
        if(resumed){
          isPlaying = true;
          armCueRestoreImmediate();
          elTonearmLayer.classList.add("down","playing");
        } else {
          isPlaying = true;
          elTonearmLayer.classList.add("playing");
          armRequestDrop();
          armCueToStartAndDrop();
          audio.currentTime = 0;
          armCueMute();
          armUnmuteWhenDown();
          const ok = await playCurrentSource();
          if(!ok) throw new Error("play failed on deckB");
        }
      }

      state.playing = true;
      btnPlayPause.textContent = "⏸ Pause";
      btnPlayPause.classList.add("on");
      setStatus("Lecture", true);
    } catch(err){
      console.error(err);
      setStatus("Erreur audio", false);
      state.playing = false;
      isPlaying = false;
      armCueRestoreImmediate();
      elTonearmLayer.classList.remove("playing");
      btnPlayPause.classList.remove("on");
    } finally {
      btnPlayPause.disabled = false;
      btnEject.disabled = false;
      btnNext.disabled = false;
      btnPrev.disabled = false;
      state.busy = false;
    }
  }

  async function pauseSequence(){
    if(state.busy || !state.playing) return;

    state.busy = true;
    setStatus("Pause", false);
    btnPlayPause.disabled = true;
    btnEject.disabled = true;
    btnNext.disabled = true;
    btnPrev.disabled = true;

    try{
      audio.pause();

      // si on était en "mute de pose", on restaure le volume pour une reprise normale
      armCueRestoreImmediate();

      state.playing = false;
      btnPlayPause.textContent = "▶ Play";
      btnPlayPause.classList.remove("on");

      // stop moteur mais aiguille reste posée
      isPlaying = false;
      elTonearmLayer.classList.add("down");
      elTonearmLayer.dispatchEvent(new CustomEvent("arm:down"));
      elTonearmLayer.classList.remove("playing");

      setStatus("Pause (aiguille posée)", false);
    } finally {
      btnPlayPause.disabled = false;
      btnEject.disabled = false;
      btnNext.disabled = false;
      btnPrev.disabled = false;
      state.busy = false;
    }
  }

  async function ejectSequence(){
    if(state.busy) return;

    state.busy = true;
    setStatus("Eject…", false);
    btnPlayPause.disabled = true;
    btnEject.disabled = true;
    btnNext.disabled = true;
    btnPrev.disabled = true;

    try{
      audio.pause();

      // si on était en "mute de pose", on restaure le volume pour une reprise normale
      armCueRestoreImmediate();
      try{ audio.currentTime = 0; }catch(_){}
      audio.removeAttribute("src");
      audio.load();

      state.playing = false;
      btnPlayPause.textContent = "▶ Play";
      btnPlayPause.classList.remove("on");

      isPlaying = false;
      resetSpin();

      armReturnToRest();
      await sleep(420);
      armSetRestImmediate();

      ensureDiskOnMount();
      if(state.recordLocation === "B"){
        await animateTransfer("B","A");
      }

      // ✅ disque revenu sur A => viz OFF
      setPlatterAVizOn(state.recordLocation === "B");

      setStatus("En attente (sélection)", false);
    } finally {
      btnPlayPause.disabled = false;
      btnEject.disabled = false;
      btnNext.disabled = false;
      btnPrev.disabled = false;
      state.busy = false;
    }
  }

  // Buttons
  btnPlayPause.addEventListener("click", async () => state.playing ? pauseSequence() : playSequence());
  btnEject.addEventListener("click", async () => ejectSequence());
  btnShuffle.addEventListener("click", () => { state.shuffle = !state.shuffle; setToggle(btnShuffle, state.shuffle); });
  btnRepeat.addEventListener("click", () => { state.repeat = !state.repeat; setToggle(btnRepeat, state.repeat); });
  btnAutoNext.addEventListener("click", () => { state.autoNext = !state.autoNext; setToggle(btnAutoNext, state.autoNext); });

  
  // === AutoNext realism helpers ===
  function diskSwapFlash(){
    const dl = document.querySelector(".disk-label");
    if(!dl) return;
    dl.classList.remove("swapFlash");
    // force reflow
    void dl.offsetWidth;
    dl.classList.add("swapFlash");
    setTimeout(()=>dl.classList.remove("swapFlash"), 520);
  }

  function nextIndexSafe(){
    if(!hasQueue()) return -1;
    const n = pickNextIndexForward();
    return (typeof n === "number") ? n : -1;
  }

  async function autoNextRealisticSameDeck(){
    if(state.busy) return;

    const nextIdx = nextIndexSafe();
    if(nextIdx < 0){
      setStatus("Aucune piste suivante", false);
      return;
    }

    // Lock UI while we perform the "changer" move
    state.busy = true;
    btnPlayPause.disabled = true;
    btnEject.disabled = true;
    btnNext.disabled = true;
    btnPrev.disabled = true;

    try{
      // stop flags (this also lets platter go into "coast" inertia via diskUpdate)
      state.playing = false;
      btnPlayPause.textContent = "▶ Play";
      btnPlayPause.classList.remove("on");
      isPlaying = false;

      setStatus("AutoNext… (changement disque)", true);

      // return tonearm + let platter coast a bit
      armCueRestoreImmediate();
      armReturnToRest();
      await sleep(650);

      // bring record back to rest (A) to simulate the "disk change"
      ensureDiskOnMount();
      if(state.recordLocation === "B"){
        await animateTransfer("B","A");
      }

      // set next track + small visual flash
      const item = state.queue[nextIdx];
      setCurrentItem(item, state.queue, nextIdx);
      diskSwapFlash();
      await sleep(260);

    }catch(e){
      console.warn(e);
      setStatus("AutoNext: erreur", false);
    }finally{
      btnPlayPause.disabled = false;
      btnEject.disabled = false;
      btnNext.disabled = false;
      btnPrev.disabled = false;
      state.busy = false;
    }

    // start next track (normal play sequence does A→B transfer + cue + sync audio)
    await playSequence();
  }


  audio.addEventListener("ended", async () => {
    if(state.repeat){
      audio.currentTime = 0;
      try{
        isPlaying = true;
        elTonearmLayer.classList.add("down","playing");
        await audio.play();
      }catch(_e){}
      return;
    }
    if(state.autoNext){
      await autoNextRealisticSameDeck();
      return;
    }
    state.playing = false;
    btnPlayPause.textContent = "▶ Play";
    btnPlayPause.classList.remove("on");
    isPlaying = false;
    armReturnToRest();
    setStatus("Fin (Next/Prev ou Eject)", false);
  });

  // Drawer rendering
  const mp3Cache = new Map(); // playlistId -> tracks[]

  function renderPlaylists(){
    playlistGrid.innerHTML = "";
    for(const p of playlistSources){
      const card = document.createElement("div");
      card.className = "playCard" + (state.activePlaylistId === p.id ? " active" : "");
      card.innerHTML = `
        <div class="playCover" style="background-image:url('${escapeHtml(normalizeImgUrl(p.image || ""))}')"></div>
        <div class="playMeta">
          <div class="playName">${escapeHtml(p.name)}</div>
          <div class="playSub">${escapeHtml(p.url)}</div>
        </div>
      `;
      card.addEventListener("click", async () => { await selectPlaylist(p, false); });
      playlistGrid.appendChild(card);
    }
  }

  function renderTracks(tracks){
    trackList.innerHTML = "";
    if(!tracks || !tracks.length){
      tracksHint.style.display = "block";
      tracksHint.textContent = "Aucune track dans cette playlist.";
      return;
    }
    tracksHint.style.display = "none";

    tracks.forEach((t, idx) => {
      const item = document.createElement("div");
      const active = state.currentItem && state.currentItem.streamUrl === t.streamUrl;
      item.className = "trackItem" + (active ? " active" : "");
      const cover = normalizeImgUrl(t.cover || t.__fallbackCover || "");
      item.innerHTML = `
        <div class="trackThumb" style="background-image:url('${escapeHtml(cover)}')"></div>
        <div class="trackTxt">
          <div class="trackTitle">${escapeHtml(t.name || "Track")}</div>
          <div class="trackSub">${escapeHtml(t.subtitle || "")}</div>
        </div>
        <div class="badge">MP3</div>
      `;
      item.addEventListener("click", async () => {
        await changeSourceWhilePlaying(t, tracks, idx);
      });
      trackList.appendChild(item);
    });
  }

  function renderTracksActive(){
    if(state.activePlaylistId && mp3Cache.has(state.activePlaylistId)){
      renderTracks(mp3Cache.get(state.activePlaylistId));
      renderPlaylists();
    }
  }

  function renderWebRadios(list, opts={}){
    wrList.innerHTML = "";
    if(opts.error){
      wrHint.textContent = "Impossible de charger les web radios.";
      return;
    }
    if(!list || !list.length){
      wrHint.textContent = "Aucune station.";
      return;
    }
    wrHint.style.display = "none";

    list.forEach((st, idx) => {
      const item = document.createElement("div");
      const active = state.currentItem && state.currentItem.streamUrl === st.streamUrl;
      item.className = "trackItem" + (active ? " active" : "");
      const logo = normalizeImgUrl(st.logo || st.cover || "");
      item.innerHTML = `
        <div class="trackThumb" style="background-image:url('${escapeHtml(logo)}')"></div>
        <div class="trackTxt">
          <div class="trackTitle">${escapeHtml(st.name || "Web radio")}</div>
          <div class="trackSub">${escapeHtml(st.subtitle || "Web radio")}</div>
        </div>
        <div class="badge live">LIVE</div>
      `;
      item.addEventListener("click", async () => {
        await changeSourceWhilePlaying(st, list, idx);
      });
      wrList.appendChild(item);
    });
  }

  function renderWebRadioActive(){
    if(webRadioStations && webRadioStations.length) renderWebRadios(webRadioStations);
  }

  async function selectPlaylist(p, autoSelectFirst){
    state.activePlaylistId = p.id;
    renderPlaylists();

    mp3Hint.style.display = "none";
    tracksHint.style.display = "block";
    tracksHint.textContent = "Chargement des tracks…";
    trackList.innerHTML = "";

    try{
      let tracks = null;
      if(mp3Cache.has(p.id)){
        tracks = mp3Cache.get(p.id);
      } else {
        const xml = await fetchText(p.url);
        tracks = parsePlaylistXml(xml, p);
        mp3Cache.set(p.id, tracks);
      }

      renderTracks(tracks);
      mp3Sub.textContent = `Playlist: ${p.name}`;
      mp3Count.textContent = `${tracks.length} tracks`;

      if(autoSelectFirst && tracks && tracks.length){
        setCurrentItem(tracks[0], tracks, 0);
        setStatus("Prêt (track #1 sur Deck A)", false);
      }
    }catch(e){
      console.warn("playlist load failed:", e);
      tracksHint.style.display = "block";
      tracksHint.textContent = "Erreur de chargement XML.";
      mp3Count.textContent = "—";
    }
  }

  // Init layout
  function layout(){
    const cA = getCenterInDj(wrapA);
    setCarriageX(cA.x);
    ensureDiskOnMount();
    const w = getRect(wrapA).width;
    recordCarrier.style.width = `${w}px`;
    recordCarrier.style.height = `${w}px`;

    // ✅ met le viz dans le bon état au resize
    setPlatterAVizOn(state.recordLocation === "B");
  }
  window.addEventListener("resize", layout);

  // Init UI
  setStatus("Chargement…", false);
  setNowPlaying(null);
  setDiskCover(DEFAULT_COVER, DEFAULT_COVER);
  setPlatterAVizOn(false);

  mp3Hint.textContent = "Playlists XML disponibles (clique une playlist).";
  tracksHint.style.display = "block";
  tracksHint.textContent = "Chargement automatique de la playlist #1…";
  mp3Sub.textContent = "Playlists XML";
  mp3Count.textContent = `${playlistSources.length} playlists`;
  renderPlaylists();

  // Load web radios
  (async () => {
    try{
      const list = await loadWebRadiosJson();
      wrSub.textContent = "Stations JSON";
      wrCount.textContent = `${list.length} stations`;
      renderWebRadios(list);
    }catch(e){
      console.warn("Web radios JSON load failed:", e);
      wrCount.textContent = "—";
      renderWebRadios([], { error:true });
    }
  })();

  // ✅ Auto-load first playlist + select first track
  (async () => {
    try{
      const first = playlistSources[0];
      await selectPlaylist(first, true);
      layout();
    }catch(e){
      console.warn(e);
      setStatus("Erreur init playlist", false);
      layout();
    }
  })();

  // keyboard shortcuts
  window.addEventListener("keydown", async (e) => {
    if(e.code === "Space"){
      e.preventDefault();
      state.playing ? await pauseSequence() : await playSequence();
    }
    if(e.key === "ArrowRight") await doNextPrev("next");
    if(e.key === "ArrowLeft") await doNextPrev("prev");
    if(e.key.toLowerCase() === "e") await ejectSequence();
    if(e.key.toLowerCase() === "c") nextAudioMotionTheme();
  });

})();