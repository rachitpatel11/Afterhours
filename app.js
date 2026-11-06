const $=s=>document.querySelector(s),root=document.documentElement;
const S={track:null,lines:[],synced:false,playing:false,base:0,at:0,mode:'demo',idx:-2,tok:null,ctrl:null};
const cache=new Map(),fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
let tt;const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),3500)};

/* ---------- LRC parser ---------- */
function parseLRC(txt){const out=[];for(const raw of txt.split(/\r?\n/)){const re=/\[(\d+):(\d+(?:\.\d+)?)\]/g;let m,st=[],last=0;while((m=re.exec(raw))){st.push(+m[1]*60000+Math.round(+m[2]*1000));last=re.lastIndex}
 if(!st.length)continue;const text=raw.slice(last).trim();st.forEach(t=>out.push({timestamp:t,text}))}
 return out.sort((a,b)=>a.timestamp-b.timestamp)}

/* ---------- Lyrics service (provider interface; LRCLIB default) ---------- */
const norm=s=>(s||'').toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\.?.*$/g,'').replace(/[^\p{L}\p{N}]+/g,' ').trim();
const variant=s=>/remix|live|acoustic|instrumental|karaoke|sped|slowed|demo/i.test(s||'');
const lrclib={name:'LRCLIB',async get(tr){
 const key=`${norm(tr.artist)}|${norm(tr.title)}|${Math.round(tr.dur/1000)}`;if(cache.has(key))return cache.get(key);
 const j=async u=>{for(let n=0;n<2;n++){const r=await fetch(u);if(r.status===429){await new Promise(z=>setTimeout(z,(+r.headers.get('Retry-After')||2)*1000));continue}
  if(r.status===404)return null;if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}throw new Error('Rate limited')};
 const ok=d=>d&&!d.instrumental&&(!tr.dur||tr.loose||Math.abs((d.duration||0)-tr.dur/1000)<=3)&&norm(d.trackName)===norm(tr.title)&&variant(d.trackName)===variant(tr.title)&&(norm(d.artistName).includes(norm(tr.artist).split(' ')[0])||norm(tr.artist).includes(norm(d.artistName).split(' ')[0]));
 let d=!tr.dur?null:await j('https://lrclib.net/api/get?'+new URLSearchParams({track_name:tr.title,artist_name:tr.artist,album_name:tr.album||'',duration:Math.round(tr.dur/1000)}));
 if(!ok(d)){const list=await j('https://lrclib.net/api/search?'+new URLSearchParams({track_name:tr.title,artist_name:tr.artist}));d=(list||[]).filter(ok).sort((a,b)=>!!b.syncedLyrics-!!a.syncedLyrics)[0]||null}
 const res=d?{synced:d.syncedLyrics?parseLRC(d.syncedLyrics):null,plain:d.plainLyrics||null,dur:d.duration}:null;cache.set(key,res);return res}};
const providers=[lrclib];
async function loadLyrics(tr){setLines([],false,'');$('#note').textContent='finding the words…';
 for(const p of providers){try{const r=await p.get(tr);if(S.track!==tr)return;if(!tr.dur&&r&&r.dur){tr.dur=r.dur*1000;$('#tot').textContent=fmt(tr.dur)}
  if(r&&r.synced&&r.synced.length){setLines(r.synced,true,'');return}
  if(r&&r.plain){setLines(r.plain.split('\n').filter(Boolean).map((t,i)=>({timestamp:i,text:t})),false,'unsynced lyrics — shown as a slow read-through, not timed to the song');return}}
  catch(e){if(S.track===tr)setLines([],false,'lyrics unavailable right now ('+e.message+')');return}}
 if(S.track===tr)setLines([],false,'no lyrics found for this version')}

/* ---------- Sync engine ---------- */
function setLines(l,sync,note){S.lines=l;S.synced=sync;S.idx=-2;$('#note').textContent=note;S.plainT=0;if(!l.length){swap($('#l1'),'');swap($('#l2'),'')}}
const pos=()=>S.playing?S.base+(performance.now()-S.at):S.base;
const swap=(el,t)=>{if(el.dataset.t===t)return;el.dataset.t=t;el.classList.add('hide');setTimeout(()=>{if(el.dataset.t===t){setText(el,t);el.classList.remove('hide')}},t?(S.fast?140:420):0)};
function idxAt(p){let lo=0,hi=S.lines.length-1,r=-1;while(lo<=hi){const m=(lo+hi)>>1;if(S.lines[m].timestamp<=p){r=m;lo=m+1}else hi=m-1}return r}
function tick(){const p=pos(),d=S.track?S.track.dur:0;
 if(S.track){$('#cur').textContent=fmt(p);$('#fill').style.width=Math.min(100,p/d*100)+'%'}
 if(S.lines.length){let i;
  if(S.synced)i=idxAt(p+250);
  else{i=Math.min(S.lines.length-1,Math.floor(p/Math.max(d,1)*S.lines.length))}
  if(i!==S.idx){S.idx=i;S.gap=gapFor(i);const a=S.lines[i],b=S.lines[i+1];
   if(S.synced&&i<0){swap($('#l1'),'');swap($('#l2'),S.lines[0]?.text||'')}
   else{swap($('#l1'),a?a.text:'');swap($('#l2'),b?b.text:'')}}
  if(S.synced&&S.lines[i+1]===undefined&&i>=0&&p>S.lines[i].timestamp+9000){swap($('#l1'),'');swap($('#l2'),'')}}
 requestAnimationFrame(tick)}

/* ---------- Ambient colours from artwork ---------- */
function setArt(url){document.body.classList.toggle('has-art',!!url);$('#thumb').style.backgroundImage=url?`url(${url})`:'';$('#art-bg').style.backgroundImage=url?`url(${url})`:'';
 if(!url){S.art=null;root.style.setProperty('--c1','#3a2a18');root.style.setProperty('--c2','#1c2230');return}
 const im=new Image();im.crossOrigin='anonymous';im.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(im,0,0,16,16);const d=x.getImageData(0,0,16,16).data;
  const avg=(x0,x1)=>{let r=0,g=0,b=0,w=0;for(let y=0;y<16;y++)for(let xx=x0;xx<x1;xx++){const k=(y*16+xx)*4,R=d[k],G=d[k+1],B=d[k+2],s=Math.max(R,G,B)-Math.min(R,G,B)+20;r+=R*s;g+=G*s;b+=B*s;w+=s}return[r/w,g/w,b/w]};
  const f=([r,g,b])=>`rgb(${r*.42|0},${g*.42|0},${b*.42|0})`;S.art=[avg(0,8),avg(8,16)];root.style.setProperty('--c1',f(S.art[0]));root.style.setProperty('--c2',f(S.art[1]));applyUI()}catch(e){}};im.src=url}

/* ---------- Track handling ---------- */
function setTrack(tr,art,link){S.track=tr;$('#t').textContent=tr?tr.title:'—';$('#a').textContent=tr?tr.artist+(tr.album?' · '+tr.album:''):'';$('#tot').textContent=tr?fmt(tr.dur):'0:00';
 const o=$('#open');o.style.display=link?'':'none';if(link)o.href=link;setArt(art||'');if(tr)loadLyrics(tr)}
function setPlay(p,ms){S.playing=p;S.base=ms;S.at=performance.now();document.body.classList.toggle('playing',p)}

/* ---------- Demo mode (original text written for this project) ---------- */
const DEMO=`[00:02.0]the city hums its low blue song
[00:07.0]and every window keeps a small, warm light
[00:12.5]I walk the long way home tonight
[00:18.0]to give the quiet more of me
[00:24.0]
[00:26.0]nothing here is asking me to speak
[00:31.0]the streetlamps count the hours out in amber
[00:36.5]and the hour holds still enough to hold
[00:42.0]everything I almost said`;
function demo(){S.mode='demo';stopPoll();$('#status').textContent='Demo';
 const t={title:'Low Blue Hours',artist:'AFTERHOURS (demo)',album:'',dur:50000};setTrack(t,'');setLines(parseLRC(DEMO),true,'');setPlay(true,0);
 clearInterval(S.loop);S.loop=setInterval(()=>{if(S.mode==='demo'&&pos()>t.dur){S.idx=-2;setPlay(true,0)}},500)}

/* ---------- Manual search ---------- */
async function search(q){const [a,b]=q.includes('–')?q.split('–'):q.includes(' - ')?q.split(' - '):['',q];
 try{const r=await fetch('https://lrclib.net/api/search?'+new URLSearchParams(a?{artist_name:a.trim(),track_name:b.trim()}:{q:q.trim()}));const l=await r.json();
 const d=l.find(x=>x.syncedLyrics)||l[0];if(!d)return toast('Nothing found');
 S.mode='manual';stopPoll();clearInterval(S.loop);$('#status').textContent='Manual';
 const t={title:d.trackName,artist:d.artistName,album:d.albumName,dur:d.duration*1000};S.track=t;$('#t').textContent=t.title;$('#a').textContent=t.artist;$('#tot').textContent=fmt(t.dur);setArt('');$('#open').style.display='none';
 if(d.syncedLyrics)setLines(parseLRC(d.syncedLyrics),true,'');else setLines((d.plainLyrics||'').split('\n').filter(Boolean).map((x,i)=>({timestamp:i,text:x})),false,'unsynced lyrics — shown as a slow read-through');
 setPlay(true,0);toast('Playing a silent preview of the timing — start the song yourself to follow along')}catch(e){toast('Search failed: '+e.message)}}

/* ---------- Spotify (Authorization Code + PKCE, no client secret needed) ---------- */
const RURI=location.origin+'/';$('#ruri').textContent=RURI;
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function connect(){const id=$('#cid').value.trim();if(!id)return toast('Enter your Spotify Client ID first');localStorage.ah_cid=id;
 const v=b64(crypto.getRandomValues(new Uint8Array(48)));sessionStorage.ah_v=v;const ch=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 location=`https://accounts.spotify.com/authorize?`+new URLSearchParams({client_id:id,response_type:'code',redirect_uri:RURI,code_challenge_method:'S256',code_challenge:ch,scope:'user-read-currently-playing user-read-playback-state user-modify-playback-state'})}
async function token(body){const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:localStorage.ah_cid,...body})});
 if(!r.ok)throw new Error('auth failed');const j=await r.json();S.tok=j.access_token;sessionStorage.ah_t=j.access_token;if(j.refresh_token)sessionStorage.ah_r=j.refresh_token}
let pollT;const stopPoll=()=>clearTimeout(pollT);
async function poll(){if(S.mode!=='spotify')return;let wait=3000;
 try{const r=await fetch('https://api.spotify.com/v1/me/player/currently-playing',{headers:{Authorization:'Bearer '+S.tok}});
  if(r.status===401){await token({grant_type:'refresh_token',refresh_token:sessionStorage.ah_r});return poll()}
  if(r.status===429)wait=(+r.headers.get('Retry-After')||5)*1000;
  else if(r.status===204){setPlay(false,S.base);$('#status').textContent='Nothing playing'}
  else if(r.ok){const j=await r.json(),it=j.item;if(it&&it.type==='track'){$('#status').textContent='Spotify';
   if(!S.track||S.track.id!==it.id){setTrack({id:it.id,title:it.name,artist:it.artists.map(a=>a.name).join(', '),album:it.album.name,dur:it.duration_ms},it.album.images[0]?.url,it.external_urls.spotify)}
   const drift=Math.abs(pos()-j.progress_ms);if(drift>1200||S.playing!==j.is_playing)setPlay(j.is_playing,j.progress_ms)}}}
 catch(e){$('#status').textContent='Reconnecting…'}
 pollT=setTimeout(poll,wait)}
function startSpotify(){S.mode='spotify';clearInterval(S.loop);$('#status').textContent='Spotify';$('#conn').textContent='Connected ✓';setTrack(null);setLines([],false,'play something on Spotify');setPlay(false,0);poll()}
async function boot(){const CFG=window.AFTERHOURS_CONFIG||{};$('#cid').value=localStorage.ah_cid||CFG.spotifyClientId||'';const p=new URLSearchParams(location.search);
 if(p.get('code')){try{await token({grant_type:'authorization_code',code:p.get('code'),redirect_uri:RURI,code_verifier:sessionStorage.ah_v});history.replaceState(null,'',location.pathname);return startSpotify()}catch(e){toast('Spotify authorization failed')}}
 else if(sessionStorage.ah_t){S.tok=sessionStorage.ah_t;return startSpotify()}
 demo()}

/* ---------- UI ---------- */
const P=$('#sheet'),tog=()=>openSheet('source');
const amb=()=>document.body.classList.toggle('ambient'),fs=()=>document.fullscreenElement?document.exitFullscreen():root.requestFullscreen?.(),inf=()=>document.body.classList.toggle('hide-info'),th=()=>nextTheme();
$('#bAmb').onclick=amb;$('#bFs').onclick=fs;$('#bInfo').onclick=inf;$('#bDemo').onclick=()=>{demo();P.classList.remove('open')};
$('#conn').onclick=connect;$('#disc').onclick=()=>{sessionStorage.clear();$('#conn').textContent='Connect Spotify';demo()};
$('#q').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim()){search(e.target.value);P.classList.remove('open')}};
$('#lrcb').onclick=()=>$('#lrcf').click();
$('#lrcf').onchange=async e=>{const f=e.target.files[0];if(!f)return;const l=parseLRC(await f.text());if(!l.length)return toast('No timestamps found in that file');
 S.mode='manual';stopPoll();clearInterval(S.loop);$('#status').textContent='LRC file';const t={title:f.name.replace(/\.\w+$/,''),artist:'your file',album:'',dur:l[l.length-1].timestamp+8000};S.track=t;$('#t').textContent=t.title;$('#a').textContent='your file';$('#tot').textContent=fmt(t.dur);setLines(l,true,'');setPlay(true,0);P.classList.remove('open')};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.metaKey||e.ctrlKey)return;const k=e.key.toLowerCase();
 if(k==='a')amb();else if(k==='f')fs();else if(k==='i')inf();else if(k==='t')th();else if(k==='d')demo();else if(k==='s')tog();else if(k==='escape')P.classList.remove('open')});
let mt;addEventListener('mousemove',()=>{document.body.classList.add('show-ui');clearTimeout(mt);mt=setTimeout(()=>document.body.classList.remove('show-ui'),2500)});
$('#bg').addEventListener('dblclick',amb);$('#stage').addEventListener('dblclick',amb);
/* ===== v2 additions: paste in app.js right ABOVE the final line  boot();requestAnimationFrame(tick); ===== */
function setText(el,t){el.textContent='';t.split(/\s+/).filter(Boolean).forEach((w,i)=>{const s=document.createElement('span');s.textContent=w;s.style.animationDelay=i*70+'ms';el.append(s,' ')})}

/* themes + layouts */
const BASE={ui:'rgba(240,237,230,.55)',mute:'#8d8880'};
const TH={
 midnight:{...BASE,bg:'#08090b',bg2:'#121316',ink:'#f0ede6',glow:'#c79a5b',c1:'#3a2a18',c2:'#1c2230'},
 ember:{...BASE,bg:'#0d0706',bg2:'#1a0e0a',ink:'#ffe9d6',glow:'#ff8a3d',c1:'#5a2410',c2:'#2a0f1a'},
 ocean:{...BASE,bg:'#050a10',bg2:'#0a1622',ink:'#e3f1f7',glow:'#4cc3e0',c1:'#0f3a52',c2:'#101a3a'},
 forest:{...BASE,bg:'#070b08',bg2:'#0e1711',ink:'#e8efe2',glow:'#9acb6a',c1:'#1b3a22',c2:'#2a2f14'},
 rose:{...BASE,bg:'#0e070a',bg2:'#1a0c12',ink:'#fbe6ec',glow:'#ff7aa2',c1:'#4a1428',c2:'#2a1038'},
 mono:{...BASE,bg:'#080808',bg2:'#141414',ink:'#f2f2f2',glow:'#ffffff',c1:'#2a2a2a',c2:'#1a1a1a'},
 paper:{light:1,ui:'rgba(23,20,15,.6)',mute:'#6f6a60',bg:'#ece8df',bg2:'#ddd8cc',ink:'#17140f',glow:'#b5762a',c1:'#d9c3a0',c2:'#c8d3d6'}};
const UI=Object.assign({theme:'midnight',layout:'center',art:true,ink:'',glow:''},JSON.parse(localStorage.ah_ui||'{}'));
function applyUI(){const t=TH[UI.theme]||TH.midnight,s=root.style;
 root.dataset.theme=t.light?'light':'dark';
 s.setProperty('--bg',t.bg);s.setProperty('--bg2',t.bg2);s.setProperty('--ui',t.ui);s.setProperty('--mute',t.mute);
 s.setProperty('--ink',UI.ink||t.ink);s.setProperty('--amber',UI.glow||t.glow);
 if(UI.art){s.removeProperty('--t1');s.removeProperty('--t2')}else{s.setProperty('--t1',t.c1);s.setProperty('--t2',t.c2)}
 document.body.classList.remove('layout-center','layout-split','layout-mini');document.body.classList.add('layout-'+UI.layout);
 $('#cInk').value=UI.ink||t.ink;$('#cGlow').value=UI.glow||t.glow;$('#bArt').textContent='Album colours: '+(UI.art?'on':'off');
 document.querySelectorAll('.sw').forEach(b=>b.classList.toggle('on',b.dataset.th===UI.theme));
 localStorage.ah_ui=JSON.stringify(UI)}
Object.entries(TH).forEach(([n,t])=>{const b=document.createElement('button');b.className='sw';b.dataset.th=n;b.title=n;b.style.background=`linear-gradient(135deg,${t.bg} 45%,${t.glow})`;
 b.onclick=()=>{UI.theme=n;UI.ink=UI.glow='';applyUI()};$('#themes').append(b)});
function nextTheme(){const k=Object.keys(TH);UI.theme=k[(k.indexOf(UI.theme)+1)%k.length];UI.ink=UI.glow='';applyUI()}
$('#cInk').oninput=e=>{UI.ink=e.target.value;applyUI()};$('#cGlow').oninput=e=>{UI.glow=e.target.value;applyUI()};
$('#bArt').onclick=()=>{UI.art=!UI.art;applyUI()};
document.querySelectorAll('[data-lay]').forEach(b=>b.onclick=()=>{UI.layout=b.dataset.lay;applyUI()});
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.metaKey||e.ctrlKey)return;if(e.key.toLowerCase()==='l'){const L=['center','split','mini'];UI.layout=L[(L.indexOf(UI.layout)+1)%3];applyUI()}});
applyUI();

/* beat lights */
const B={on:false,an:null,buf:null,avg:0,pulse:0,last:0,st:null};
async function startBeat(kind){stopBeat();
 try{const st=kind==='system'?await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}):await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  st.getVideoTracks().forEach(t=>t.stop());
  if(!st.getAudioTracks().length){st.getTracks().forEach(t=>t.stop());return toast('No audio was shared — tick "Share tab audio" / "Share system audio" in the picker')}
  const ac=new AudioContext(),src=ac.createMediaStreamSource(new MediaStream(st.getAudioTracks()));
  B.an=ac.createAnalyser();B.an.fftSize=512;B.an.smoothingTimeConstant=.6;src.connect(B.an);B.buf=new Uint8Array(B.an.frequencyBinCount);B.st=st;B.on=true;
  st.getAudioTracks()[0].onended=()=>{B.on=false};toast('Beat lights on')}
 catch(e){toast('Beat lights unavailable: '+e.message)}}
function stopBeat(){B.on=false;B.st&&B.st.getTracks().forEach(t=>t.stop());B.st=null}
function beatTick(now){
 if(B.on){B.an.getByteFrequencyData(B.buf);let e=0;for(let i=1;i<9;i++)e+=B.buf[i];e/=8*255;B.avg=B.avg*.96+e*.04;
  if(e>B.avg*1.25&&e>.25&&now-B.last>220){B.pulse=Math.min(1,.55+(e-B.avg)*2);B.last=now;
   root.style.setProperty('--bx',(15+Math.random()*70)+'%');root.style.setProperty('--by',(20+Math.random()*60)+'%')}}
 B.pulse*=.9;root.style.setProperty('--pulse',B.pulse.toFixed(3));requestAnimationFrame(beatTick)}
$('#bMic').onclick=()=>startBeat('mic');$('#bSys').onclick=()=>startBeat('system');$('#bOff').onclick=stopBeat;
requestAnimationFrame(beatTick);

/* ===== v3 additions ===== */
function setText(el,t){el.textContent='';const g=el.id==='l1'?(S.gap||300):110;t.split(/\s+/).filter(Boolean).forEach((w,i)=>{const s=document.createElement('span');s.textContent=w;s.style.animationDelay=(i*g)+'ms';el.append(s,' ')})}
function gapFor(i){const L=S.lines,a=L[i];if(!a)return 300;const n=Math.max(1,a.text.split(/\s+/).length);
 const dur=S.synced?((L[i+1]?L[i+1].timestamp:a.timestamp+5000)-a.timestamp):((S.track?S.track.dur:60000)/L.length);
 return Math.max(160,Math.min(650,dur*.6/n))*(UI.pace||1)}
TH.violet={...BASE,bg:'#0a0710',bg2:'#150f22',ink:'#efe8ff',glow:'#a78bfa',c1:'#2d1b5e',c2:'#14203f'};
TH.gold={...BASE,bg:'#0a0805',bg2:'#17120a',ink:'#fff3d6',glow:'#e8b84a',c1:'#4a3510',c2:'#2a1c0a'};
$('#themes').innerHTML='';
Object.entries(TH).forEach(([n,t])=>{const b=document.createElement('button');b.className='sw';b.dataset.th=n;
 b.innerHTML=`<i style="background:radial-gradient(circle at 32% 28%,${t.glow},${t.c1} 48%,${t.bg} 82%)"></i>${n}`;
 b.onclick=()=>{UI.theme=n;UI.ink=UI.glow='';applyUI()};$('#themes').append(b)});
const _ap=applyUI;applyUI=function(){_ap();
 document.querySelectorAll('[data-lay]').forEach(b=>b.classList.toggle('on',b.dataset.lay===UI.layout));
 document.querySelectorAll('[data-pace]').forEach(b=>b.classList.toggle('on',+b.dataset.pace===(UI.pace||1)))};
document.querySelectorAll('[data-pace]').forEach(b=>b.onclick=()=>{UI.pace=+b.dataset.pace;applyUI()});
/* dock + sheets */
function openSheet(n){if(P.classList.contains('open')&&P.dataset.open===n)return P.classList.remove('open');P.dataset.open=n;P.classList.add('open')}
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=e=>{e.stopPropagation();openSheet(b.dataset.s)});
addEventListener('click',e=>{if(!e.target.closest('#sheet,#dock'))P.classList.remove('open')});
addEventListener('pointerdown',()=>{document.body.classList.add('show-ui');clearTimeout(mt);mt=setTimeout(()=>document.body.classList.remove('show-ui'),3500)});
/* guide */
const GS=[['Welcome','Afterhours','Your music, written on the dark. A one-minute tour.'],
['Step 1','Bring a song','Open Source in the dock. Link Last.fm once (the Source panel shows how), or try Demo. Then play anything.'],
['Step 2','Make it yours','Move your mouse to wake the dock. Theme sets the mood, Layout moves the cover and sets how slowly words appear.'],
['Step 3','Let the room breathe','Lights makes the glow follow the bass. Use the microphone, or share a browser tab playing music.'],
['Shortcuts','Keep it quiet','A ambient · F fullscreen · L layout · T theme · H this guide · Space pause · N / P next / previous · [ ] nudge lyrics']];
let gi=0;function guide(i){const G=$('#guide');if(i>=GS.length){G.classList.remove('on');localStorage.ah_seen=1;return}gi=i;const g=GS[i];
 $('.g-k').textContent=g[0];setText($('.g-t'),g[1]);$('.g-p').textContent=g[2];$('#gNext').textContent=i===GS.length-1?'Begin':'Next';G.classList.add('on')}
$('#gNext').onclick=()=>guide(gi+1);$('#gSkip').onclick=()=>guide(99);$('#bHelp').onclick=()=>{P.classList.remove('open');guide(0)};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();if(k==='h')guide(0);if(k==='escape')guide(99)});
window.afterIntro=()=>{if(!localStorage.ah_seen)setTimeout(()=>guide(0),500)};
applyUI();

/* ===== v4 additions ===== */
/* adaptive word reveal: slow poetry stays dreamy, fast rap shows the whole line quickly */
function gapFor(i){const L=S.lines,a=L[i];if(!a)return 300;const n=Math.max(1,a.text.split(/\s+/).length);
 const dur=S.synced?((L[i+1]?L[i+1].timestamp:a.timestamp+5000)-a.timestamp):((S.track?S.track.dur:60000)/L.length);
 S.fast=dur<3400||n/(dur/1000)>3;document.body.classList.toggle('fast',S.fast);
 S.wd=S.fast?650:Math.max(500,Math.min(1900,dur*.55));
 const budget=dur*(S.fast?.3:.6);
 return Math.max(20,Math.min(650,budget/n))*(S.fast?1:(UI.pace||1))}
function setText(el,t){el.textContent='';const id=el.id,one=id==='l1',g=one?(S.gap||300):(S.fast?20:70);
 el.style.setProperty('--wd',(one?(S.wd||1900):id==='l2'?700:1400)+'ms');
 if(one||id==='l2')el.style.setProperty(one?'--sc1':'--sc2',Math.max(.5,Math.min(1,56/Math.max(t.length,1))));
 t.split(/\s+/).filter(Boolean).forEach((w,i)=>{const s=document.createElement('span');s.textContent=w;s.style.animationDelay=(i*g)+'ms';el.append(s,' ')})}
/* Spotify transport + search-and-play */
async function spapi(path,method='GET',body){const go=()=>fetch('https://api.spotify.com/v1/'+path,{method,headers:{Authorization:'Bearer '+S.tok,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 let r=await go();if(r.status===401){await token({grant_type:'refresh_token',refresh_token:sessionStorage.ah_r});r=await go()}return r}
async function sp(cmd,body){const m={pause:['PUT','me/player/pause'],play:['PUT','me/player/play'],next:['POST','me/player/next'],previous:['POST','me/player/previous']}[cmd];
 try{const r=await spapi(m[1],m[0],body);
  if(r.status===403)return toast('Spotify blocked it. Controls need Premium and one reconnect after this update (Source → Disconnect → Connect).');
  if(r.status===404)return toast('No active Spotify device. Press play in the Spotify app once.');
  if(r.status>=300)return toast('Spotify said '+r.status);
  if(cmd==='pause')setPlay(false,pos());else if(cmd==='play'&&!body)setPlay(true,S.base);
  clearTimeout(pollT);pollT=setTimeout(poll,700)}catch(e){toast('Could not reach Spotify')}}
const toggle=()=>S.mode==='spotify'?sp(S.playing?'pause':'play'):setPlay(!S.playing,pos());
const skip=d=>S.mode==='spotify'?sp(d>0?'next':'previous'):toast('Change songs in your music app');
$('#cPrev').onclick=()=>skip(-1);$('#cPlay').onclick=toggle;$('#cNext').onclick=()=>skip(1);
addEventListener('keydown',e=>{const T=e.target.tagName;if(T==='INPUT'||e.metaKey||e.ctrlKey)return;
 if(e.code==='Space'&&T!=='BUTTON'){e.preventDefault();toggle()}else if(e.key.toLowerCase()==='n')skip(1);else if(e.key.toLowerCase()==='p')skip(-1)});
async function spSearch(q){try{const r=await spapi('search?'+new URLSearchParams({q,type:'track',limit:6})),j=await r.json(),box=$('#res');box.innerHTML='';
 const items=(j.tracks&&j.tracks.items)||[];if(!items.length)return box.textContent='Nothing found';
 items.forEach(t=>{const b=document.createElement('button');b.className='res';b.textContent=t.name+' — '+t.artists.map(a=>a.name).join(', ');
  b.onclick=()=>{sp('play',{uris:[t.uri]});box.innerHTML='';P.classList.remove('open')};box.append(b)})}catch(e){toast('Search failed')}}
$('#q').onkeydown=e=>{if(e.key!=='Enter'||!e.target.value.trim())return;
 if(S.mode==='spotify')spSearch(e.target.value.trim());else{search(e.target.value);P.classList.remove('open')}};

/* ===== v5 additions ===== */
/* colour modes: preset / solid / song colours + liquid glass cover */
function modeStyles(){const s=root.style,b=document.body,m=UI.mode||'preset',hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 b.classList.toggle('solid',m==='solid');b.classList.toggle('glass',UI.glass!==false);
 document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('on',x.dataset.mode===m));
 $('#bGlass').classList.toggle('on',UI.glass!==false);$('#cSolid').value=UI.solid||'#101114';
 if(m==='solid'){const c=UI.solid||'#101114',[r,g,k]=hex(c),light=(.299*r+.587*g+.114*k)>150;
  s.setProperty('--bg',c);s.setProperty('--bg2',c);s.removeProperty('--t1');s.removeProperty('--t2');
  if(!UI.ink)s.setProperty('--ink',light?'#17140f':'#f0ede6');
  s.setProperty('--ui','color-mix(in srgb,var(--ink) 58%,transparent)');s.setProperty('--mute','color-mix(in srgb,var(--ink) 50%,transparent)');
  root.dataset.theme=light?'light':'dark'}
 else if(m==='song'&&S.art){const lift=c=>{const k=Math.max(...c)||1;return c.map(v=>v/k*235)},[a,c]=S.art,A=lift(a);
  s.removeProperty('--t1');s.removeProperty('--t2');
  s.setProperty('--bg','rgb('+a.map(x=>x*.1|0)+')');s.setProperty('--bg2','rgb('+c.map(x=>x*.2|0)+')');
  if(!UI.glow)s.setProperty('--amber','rgb('+A.map(x=>x|0)+')');
  if(!UI.ink)s.setProperty('--ink','rgb('+A.map(x=>x*.22+199|0)+')');root.dataset.theme='dark'}}
const _ap3=applyUI;applyUI=function(){_ap3();modeStyles()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{UI.mode=b.dataset.mode;if(UI.mode!=='solid'&&!UI.keepInk){}applyUI()});
$('#cSolid').oninput=e=>{UI.solid=e.target.value;UI.mode='solid';UI.ink='';applyUI()};
$('#bGlass').onclick=()=>{UI.glass=UI.glass===false;applyUI()};
/* 3D entrance */
const I=$('#intro'),big=$('.big');
'AFTERHOURS'.split('').forEach((ch,i)=>{const b=document.createElement('b');b.textContent=ch;b.style.setProperty('--i',i);big.append(b)});
function enter(){if(I.classList.contains('go'))return;I.classList.add('go');setTimeout(()=>{I.classList.add('gone');afterIntro()},1500)}
$('#enter').onclick=enter;
addEventListener('keydown',e=>{if(I.classList.contains('gone'))return;e.stopImmediatePropagation();if(e.key==='Enter'||e.code==='Space'){e.preventDefault();enter()}},true);
addEventListener('pointermove',e=>{const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5,s=root.style;
 s.setProperty('--rx',(x*16).toFixed(2)+'deg');s.setProperty('--ry',(-y*12).toFixed(2)+'deg');s.setProperty('--mx',e.clientX+'px');s.setProperty('--my',e.clientY+'px');
 if(!I.classList.contains('gone'))document.querySelectorAll('.big b').forEach(l=>{const r=l.getBoundingClientRect();l.style.setProperty('--z',Math.max(0,170-Math.hypot(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)*.35)+'px')});
 const t=$('#thumb').getBoundingClientRect();s.setProperty('--gx',((e.clientX-t.left)/t.width*100).toFixed(0)+'%');s.setProperty('--gy',((e.clientY-t.top)/t.height*100).toFixed(0)+'%')});
applyUI();

/* ===== v6: Last.fm mode + sync tools ===== */
const LF=()=>(window.AFTERHOURS_CONFIG||{}).lastfmApiKey,PX=()=>(window.AFTERHOURS_CONFIG||{}).lastfmProxy;let lfT;
const lfq=o=>PX()?PX()+'?'+new URLSearchParams({format:'json',...o}):'https://ws.audioscrobbler.com/2.0/?'+new URLSearchParams({api_key:LF(),format:'json',...o});
async function lfPoll(){if(S.mode!=='lastfm')return;let wait=document.hidden?30000:6000;
 try{const r=await fetch(lfq({method:'user.getrecenttracks',user:localStorage.ah_lf,limit:1}));if(r.status===429)wait=15000;
  const j=await r.json();if(j.error){toast('Last.fm: '+j.message);S.mode='demo';$('#status').textContent='Last.fm error';return}
  const t=[].concat(j.recenttracks.track||[])[0];
  if(t&&t['@attr']&&t['@attr'].nowplaying==='true'){const title=t.name,artist=t.artist['#text']||t.artist.name,key=artist+'|'+title;
   if(S.lfKey!==key){S.lfKey=key;await lfNew({title,artist,album:t.album&&t.album['#text'],art:((t.image||[]).slice(-1)[0]||{})['#text']||''})}
   $('#status').textContent='Last.fm'}
  else $('#status').textContent='Waiting for music'}
 catch(e){$('#status').textContent='Reconnecting…'}
 lfT=setTimeout(lfPoll,wait)}
async function lfNew(o){let dur=0;
 try{const j=await(await fetch(lfq({method:'track.getInfo',artist:o.artist,track:o.title,autocorrect:1}))).json();dur=+(j.track&&j.track.duration)||0}catch(e){}
 const art=o.art&&!/2a96cbd8b46e442fc41c2b86b821562f/.test(o.art)?o.art:'';
 S.off=0;$('#offs').textContent='';setTrack({title:o.title,artist:o.artist,album:o.album||'',dur,loose:true},art,'');setPlay(true,3000)}
function startLF(){if(!LF()&&!PX())return toast('Last.fm is not set up yet (see README)');
 const u=$('#lfUser').value.trim();if(!u)return toast('Type your Last.fm username');localStorage.ah_lf=u;
 stopPoll();clearInterval(S.loop);clearTimeout(lfT);S.mode='lastfm';S.lfKey='';$('#status').textContent='Last.fm';
 setTrack(null);setLines([],false,'play a song on Spotify, it shows up here a few seconds later');setPlay(false,0);P.classList.remove('open');lfPoll()}
$('#lfConn').onclick=startLF;$('#lfUser').onkeydown=e=>{if(e.key==='Enter')startLF()};
$('#lfDisc').onclick=()=>{clearTimeout(lfT);localStorage.removeItem('ah_lf');demo()};
const _boot=boot;boot=async function(){await _boot();if(S.mode==='demo'&&localStorage.ah_lf&&(LF()||PX())){$('#lfUser').value=localStorage.ah_lf;startLF()}};
/* sync tools */
function shift(ms){S.off=(S.off||0)+ms;$('#offs').textContent='Current shift: '+(S.off>0?'+':'')+(S.off/1000).toFixed(2)+'s'}
function nudge(ms){S.base=Math.max(0,S.base+ms);shift(ms);S.idx=-2;toast(ms>0?'Lyrics pushed forward '+Math.abs(ms/1000)+'s':'Lyrics pulled back '+Math.abs(ms/1000)+'s')}
function align(w){const L=S.lines[S.idx+(w==='next'?1:0)];if(!S.synced||!L)return toast('Needs timed lyrics showing on screen');
 const old=pos();setPlay(true,L.timestamp);shift(L.timestamp-old);S.idx=-2;toast('Synced')}
document.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>nudge(+b.dataset.nudge));
$('#aNow').onclick=()=>align('now');$('#aNext').onclick=()=>align('next');
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='[')nudge(-500);if(e.key===']')nudge(500)});

/* ===== v7: earbuds entrance + public mode ===== */
const CX=window.AFTERHOURS_CONFIG||{};if(!CX.enableSpotify)document.body.classList.add('no-sp');
['say it softer','2 a.m.','play it again','stay a little longer','hum it back to me','turn it up','last song, then sleep','the room is quiet now'].forEach((t,i)=>{const s=document.createElement('span');s.className='frag';s.textContent=t;
 s.style.cssText=`left:${[6,62,14,70,3,50,26,74][i]}%;top:${[14,10,72,62,42,84,90,36][i]}%;--zz:${[-260,120,200,-120,60,-300,160,-60][i]}px;--d:${7+i}s;animation-delay:${-i*1.3}s`;$('#scene').append(s)});
const buds=$('#buds');let AC;
function ripple(){const r=document.createElement('i');r.className='rip';buds.append(r);setTimeout(()=>r.remove(),2200)}
function chime(v=1){try{AC=AC||new AudioContext();const t=AC.currentTime;
 [[523.25,0],[659.25,.12],[783.99,.24],[1046.5,.38]].forEach(([f,d])=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.07*v,t+d+.03);g.gain.exponentialRampToValueAtTime(.0001,t+d+1.1);o.connect(g).connect(AC.destination);o.start(t+d);o.stop(t+d+1.2)})}catch(e){}}
buds.onclick=()=>{ripple();chime(.5)};
const _enter=enter;enter=function(){if(!I.classList.contains('go'))chime();_enter()};$('#enter').onclick=enter;

boot();requestAnimationFrame(tick);
