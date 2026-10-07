const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=s=>encodeURIComponent(s).replace(/'/g,'%27'),U=decodeURIComponent,today=()=>new Date().toISOString().slice(0,10);
const TYPES=['Theft','Robbery','Assault','Burglary','Harassment','Cyber Fraud'],COL={HIGH:'#d62728',MEDIUM:'#ff9f1c',LOW:'#2a9d8f'};
const COLORS={PUBLIC:'#0f766e',POLICE:'#0d2b5b',ADMIN:'#6d28d9'},LABEL={PUBLIC:'Citizen',POLICE:'Police Officer',ADMIN:'Administrator'};
const STC={Submitted:'#7b8794','Under Review':'#ff9f1c',Verified:'#2563eb',Resolved:'#2a9d8f',Rejected:'#d62728'};
const TIPS={Theft:'Keep phones and bags out of sight and stay alert in crowded markets.',Robbery:'Avoid isolated roads after dark and share your live location with family.',Assault:'Prefer well-lit, busy streets and avoid late-night confrontations.',Burglary:'Lock doors and windows and use timer lights when away from home.',Harassment:'Travel in groups late evening; the women helpline 181 is available 24x7.','Cyber Fraud':'Never share OTPs; verify links and report online fraud on 1930.'};
/* ---------- API layer (talks to the Node backend) ---------- */
let TOKEN=null,DB={crimes:[],complaints:[],patrols:{},audit:[],sos:[],users:[]};
async function api(m,u,b){const r=await fetch('/api'+u,{method:m,headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})},body:b?JSON.stringify(b):undefined});
 let d={};try{d=await r.json()}catch(e){}if(!r.ok)throw new Error(d.error||'Request failed');return d}
const refresh=async()=>{if(!TOKEN)return;try{DB=await api('GET','/state')}catch(e){if(/login again|no longer/i.test(e.message)){TOKEN=null;showLogin('Session expired. Please login again.')}}};
const safe=fn=>async(...a)=>{try{await fn(...a)}catch(e){alert(e.message)}};
let SES=null,MT='All',Z=12,AREA=null,QF='All',RS='';
const log=m=>{if(TOKEN)api('POST','/audit',{m}).catch(()=>{})};
const fh=h=>{h=((h%24)+24)%24;return(h%12||12)+(h<12?' AM':' PM')};
function hotspots(t){const cut=Date.now()-90*864e5,cells={};
 DB.crimes.filter(c=>!t||t=='All'||c.type==t).forEach(c=>{const k=Math.round(c.latitude*100)+':'+Math.round(c.longitude*100),w=c.severity*(new Date(c.occurredAt)>cut?2:1),v=cells[k]||(cells[k]={lat:0,lng:0,count:0,score:0,ar:{}});v.lat+=c.latitude;v.lng+=c.longitude;v.count++;v.score+=w;v.ar[c.area]=(v.ar[c.area]||0)+1});
 const a=Object.values(cells),mx=Math.max(1,...a.map(v=>v.score));
 return a.map(v=>{const r=v.score/mx;return{lat:v.lat/v.count,lng:v.lng/v.count,count:v.count,risk:Math.round(r*100)/100,level:r>.66?'HIGH':r>.33?'MEDIUM':'LOW',area:Object.entries(v.ar).sort((x,y)=>y[1]-x[1])[0][0]}}).sort((x,y)=>y.risk-x.risk)}
function areaStats(){const m={},cut=Date.now()-90*864e5;
 DB.crimes.forEach(c=>{const a=c.area||'Unknown',v=m[a]||(m[a]={area:a,count:0,score:0,types:{},hours:Array(24).fill(0),la:0,lo:0});v.count++;v.score+=c.severity*(new Date(c.occurredAt)>cut?2:1);v.types[c.type]=(v.types[c.type]||0)+1;if(c.hour!=null)v.hours[c.hour%24]++;v.la+=c.latitude;v.lo+=c.longitude});
 const a=Object.values(m),mx=Math.max(1,...a.map(v=>v.score));
 return a.map(v=>{const r=v.score/mx,h=v.hours;let b=0,bs=-1;for(let i=0;i<24;i++){const s=h[i]+h[(i+1)%24]+h[(i+2)%24];if(s>bs){bs=s;b=i}}
  return{...v,la:v.la/v.count,lo:v.lo/v.count,risk:r,level:r>.66?'HIGH':r>.33?'MEDIUM':'LOW',safety:Math.round(100-r*75),top:(Object.entries(v.types).sort((x,y)=>y[1]-x[1])[0]||['-'])[0],peak:bs>0?fh(b)+' – '+fh(b+3):'n/a'}}).sort((x,y)=>y.risk-x.risk)}
function trends(){const m={},t={};DB.crimes.forEach(c=>{const k=c.occurredAt.slice(0,7);m[k]=(m[k]||0)+1;t[c.type]=(t[c.type]||0)+1});
 const labels=Object.keys(m).sort(),values=labels.map(k=>m[k]),n=values.length;let f=n?values[n-1]:0;
 if(n>=2){let sx=0,sy=0,sxy=0,sxx=0;values.forEach((y,i)=>{sx+=i;sy+=y;sxy+=i*y;sxx+=i*i});const s=(n*sxy-sx*sy)/(n*sxx-sx*sx);f=Math.max(0,s*n+(sy-s*sx)/n)}
 let nm='next';if(n){const[y,mo]=labels[n-1].split('-').map(Number),d=new Date(y,mo,1);nm=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
 return{labels,values,nextMonth:nm,forecast:Math.round(f),byType:t}}
const last=n=>DB.crimes.filter(c=>new Date(c.occurredAt)>Date.now()-n*864e5).length;
const allHours=()=>{const a=Array(24).fill(0);DB.crimes.forEach(c=>{if(c.hour!=null)a[c.hour%24]++});return a};
/* ---------- sign in ---------- */
function showLogin(msg='',mode='login'){if(TOKEN){api('POST','/auth/logout').catch(()=>{});TOKEN=null}SES=null;document.documentElement.style.setProperty('--ac','#0d2b5b');const reg=mode=='register';
 $('#app').innerHTML=`<div class="auth"><div class="login"><h2 style="margin:0 0 4px">🛡 Crime Hotspot Portal</h2><p class="muted" style="margin:0 0 12px">Analysis, prediction and community safety</p>
 <div class="seg"><button id="tl" class="${reg?'':'on'}">Login</button><button id="tr" class="${reg?'on':''}">Register</button></div>
 <input id="u" name="pn" type="text" autocomplete="off" placeholder="${reg?'Full name (e.g. Varshitha Reddy)':'Name'}" style="width:100%">
 <input id="p" name="pp" type="password" autocomplete="${reg?'new-password':'off'}" placeholder="${reg?'Create password (min 6 characters)':'Password'}" style="width:100%">
 ${reg?'<input id="p2" name="pp2" type="password" autocomplete="new-password" placeholder="Confirm password" style="width:100%">':''}
 <label class="muted"><input type="checkbox" id="sp"> Show password</label><div><button id="go" style="width:100%">${reg?'Create account':'Login'}</button></div>
 <p id="lm" class="muted">${esc(msg)}</p>${reg?'':'<small>Demo admin: admin / admin123</small>'}</div></div>`;
 $('#tl').onclick=()=>showLogin('','login');$('#tr').onclick=()=>showLogin('','register');
 $('#sp').onchange=function(){$$('#p,#p2').forEach(i=>i.type=this.checked?'text':'password')};
 $('#go').onclick=()=>doAuth(reg?'register':'login');
 $$('#u,#p,#p2').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')doAuth(reg?'register':'login')}));$('#u').focus()}
async function doAuth(mode){const u=$('#u').value.trim().replace(/\s+/g,' '),pw=$('#p').value,lm=$('#lm');
 if(!u||!pw){lm.textContent='Enter name and password';return}
 if(mode=='register'){
  if(u.includes('@')){lm.textContent='Please enter your name, not an email address';return}
  if(!/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(u)){lm.textContent='Name should contain only letters and spaces (2-40 characters)';return}
  if(pw.length<6){lm.textContent='Password must be at least 6 characters';return}
  if(pw!==$('#p2').value){lm.textContent='Passwords do not match';return}}
 try{const r=await api('POST','/auth/'+mode,{username:u,password:pw});TOKEN=r.token;SES={username:r.username,role:r.role,view:null};
  await refresh();showAccess(mode=='register'?'Registration successful!':'')}catch(e){lm.textContent=e.message}}
const ME=()=>DB.users.find(x=>x.username==SES.username)||SES;
function showAccess(msg=''){SES.view=null;SES.role=ME().role;document.documentElement.style.setProperty('--ac','#0d2b5b');
 const R=[['PUBLIC','🧑','Citizen','See hotspot areas, check how safe an area is, file complaints, track them and reach emergency help.'],['POLICE','👮','Police Officer','Command dashboard, complaint handling, patrol planning, crime data upload and SOS alerts.'],['ADMIN','🛠','Administrator','Manage users and records, monitor system activity and export data.']];
 $('#app').innerHTML=`<div class="auth"><div class="wide"><h1 style="margin:0">Welcome, ${esc(SES.username)}</h1><p class="muted" style="font-size:15px">${esc(msg)} Who is accessing the portal today?</p>
 <div class="roles">${R.map(([k,i,t,d])=>`<div class="rc" style="--ac:${COLORS[k]}"><div class="ic">${i}</div><h3>${t}</h3><p class="muted">${d}</p><button onclick="pick('${k}')">Continue as ${t}</button></div>`).join('')}</div>
 <div id="gate"></div><p id="gm" class="muted"></p><button class="gh" onclick="showLogin()">Logout</button></div></div>`}
function pick(k){const g=$('#gate');g.innerHTML='';$('#gm').textContent='';
 if(k=='PUBLIC')return enter(k);
 if(k=='POLICE'){if(['POLICE','ADMIN'].includes(SES.role))return enter(k);
  g.innerHTML='<input id="oc" type="password" placeholder="Officer access code"><button onclick="chkCode()">Verify</button><br><small class="muted">Demo code: POL-2026 (or ask an administrator to grant police access)</small>';$('#oc').focus();return}
 if(SES.role=='ADMIN')return enter(k);$('#gm').textContent='Administrator access is limited to admin accounts (demo: admin / admin123).'}
async function chkCode(){try{await api('POST','/auth/police-code',{code:$('#oc').value});await enter('POLICE')}catch(e){$('#gm').textContent=e.message}}
async function enter(k){SES.view=k;log('Opened '+LABEL[k]+' dashboard');await refresh();showApp()}
/* ---------- layout ---------- */
const NAV={PUBLIC:[['home','🏠 Safety Dashboard'],['areas','📍 Area Safety'],['file','📝 File Complaint'],['mine','📂 My Complaints'],['sos','🚨 Emergency Help']],
 POLICE:[['cmd','📊 Command Center'],['queue','📥 Complaints'],['patrol','🚓 Patrol Planner'],['data','🗂 Crime Records']],
 ADMIN:[['ov','📊 Overview'],['users','👥 Users'],['rec','🗂 Records'],['sys','⚙ System']]};
function showApp(){const k=SES.view;document.documentElement.style.setProperty('--ac',COLORS[k]);
 $('#app').innerHTML=`<div class="top"><b>🛡 Crime Hotspot Analysis &amp; Prediction</b><span>${esc(SES.username)} <span class="badge">${LABEL[k]}</span> <button class="sm gh" onclick="showAccess()">Switch access</button><button class="sm red" onclick="showLogin()">Logout</button></span></div>
 <div class="lay"><div class="side">${NAV[k].map(n=>`<button id="n-${n[0]}" onclick="go('${n[0]}')">${n[1]}</button>`).join('')}</div><div class="main" id="main"></div></div>`;go(NAV[k][0][0])}
async function go(t){await refresh();$$('.side button').forEach(b=>b.classList.toggle('on',b.id=='n-'+t));$('#main').innerHTML=V[t]();if($('#map'))drawMap();window.scrollTo(0,0)}
/* ---------- widgets ---------- */
const kp=(v,l,c)=>`<div class="kpi"${c?` style="border-color:${c}"`:''}><b>${v}</b><span>${l}</span></div>`;
const lb=l=>`<span class="badge" style="background:${COL[l]};color:#fff">${l}</span>`,sb=s=>`<span class="badge" style="background:${STC[s]};color:#fff">${s}</span>`;
const mapCard=()=>`<div class="card"><h3>Hotspot Map <span style="float:right"><select class="sm" onchange="MT=this.value;drawMap()">${['All',...TYPES].map(t=>`<option${t==MT?' selected':''}>${t}</option>`).join('')}</select><button class="sm" onclick="zoom(-1)">−</button><button class="sm" onclick="zoom(1)">+</button></span></h3><div id="map"></div><p class="muted">Circle size and colour show risk: red high, orange medium, green low. Hover a circle for details. Map tiles load when online.</p></div>`;
const alertBox=()=>{const h=areaStats().filter(s=>s.level=='HIGH');return h.length?`<div class="card alert">⚠ <b>Alert:</b> ${h.length} high-risk area(s): <b>${h.map(s=>esc(s.area)).join(', ')}</b>. Peak risk window in ${esc(h[0].area)}: ${h[0].peak}.</div>`:''};
function zoom(d){Z=Math.min(15,Math.max(10,Z+d));drawMap()}
function drawMap(){const h=hotspots(MT),box=$('#map'),W=box.clientWidth,H=420;if(!W)return;
 const lat=h.length?h.reduce((a,s)=>a+s.lat,0)/h.length:17.41,lng=h.length?h.reduce((a,s)=>a+s.lng,0)/h.length:78.43,S=256*2**Z;
 const px=(la,lo)=>{const sn=Math.sin(la*Math.PI/180);return[(lo+180)/360*S,(.5-Math.log((1+sn)/(1-sn))/(4*Math.PI))*S]};
 const[cx,cy]=px(lat,lng),ox=cx-W/2,oy=cy-H/2;let s='';
 for(let x=Math.floor(ox/256);x<=Math.floor((ox+W)/256);x++)for(let y=Math.floor(oy/256);y<=Math.floor((oy+H)/256);y++)s+=`<img src="https://tile.openstreetmap.org/${Z}/${x}/${y}.png" style="left:${x*256-ox}px;top:${y*256-oy}px" onerror="this.remove()">`;
 s+=`<svg width="${W}" height="${H}">`+h.map(v=>{const[x,y]=px(v.lat,v.lng);return`<circle cx="${x-ox}" cy="${y-oy}" r="${8+v.risk*22}" fill="${COL[v.level]}" fill-opacity=".5" stroke="${COL[v.level]}" stroke-width="2"><title>${esc(v.area)}: ${v.level} risk (${v.risk}) - ${v.count} incidents</title></circle>`}).join('')+'</svg>';box.innerHTML=s}
addEventListener('resize',()=>{if($('#map'))drawMap()});
function line(t){if(!t.values.length)return'No data';const W=460,H=230,p=34,v=[...t.values,t.forecast],L=[...t.labels,t.nextMonth],n=v.length,mx=Math.max(1,...v);
 const X=i=>p+i*(W-2*p)/Math.max(1,n-1),Y=a=>H-p-a/mx*(H-2*p);let s=`<svg viewBox="0 0 ${W} ${H}" width="100%">`;
 for(let g=0;g<=4;g++){const a=mx*g/4;s+=`<line x1="${p}" x2="${W-10}" y1="${Y(a)}" y2="${Y(a)}" stroke="#e3e9f1"/><text x="${p-4}" y="${Y(a)+4}" font-size="10" text-anchor="end" fill="#667">${Math.round(a)}</text>`}
 s+=`<polyline fill="none" stroke="var(--ac)" stroke-width="2.5" points="${t.values.map((a,i)=>X(i)+','+Y(a)).join(' ')}"/>`;
 if(n>1)s+=`<line x1="${X(n-2)}" y1="${Y(v[n-2])}" x2="${X(n-1)}" y2="${Y(v[n-1])}" stroke="#d62728" stroke-width="2" stroke-dasharray="5 4"/>`;
 v.forEach((a,i)=>{s+=`<circle cx="${X(i)}" cy="${Y(a)}" r="3.5" fill="${i==n-1?'#d62728':'var(--ac)'}"/><text x="${X(i)}" y="${H-12}" font-size="9" text-anchor="middle" fill="#667">${L[i].slice(2)}${i==n-1?'*':''}</text>`});
 return s+'</svg><div class="muted">* red dashed = predicted next month</div>'}
const bars=o=>{const k=Object.keys(o),mx=Math.max(1,...Object.values(o));return k.map(x=>`<div style="display:flex;align-items:center;gap:8px;margin:7px 0"><span style="width:90px">${esc(x)}</span><div style="background:var(--ac);height:18px;border-radius:4px;width:${o[x]/mx*65}%"></div><b>${o[x]}</b></div>`).join('')||'No data'};
const hrs=a=>{const mx=Math.max(1,...a),H=140;return`<svg viewBox="0 0 490 ${H}" width="100%">`+a.map((v,i)=>{const h=v/mx*(H-34);return`<rect x="${i*20+4}" y="${H-20-h}" width="14" height="${h}" rx="3" fill="${v==mx&&v>0?'#d62728':'var(--ac)'}"><title>${fh(i)}: ${v} incidents</title></rect>${i%3==0?`<text x="${i*20+11}" y="${H-6}" font-size="9" text-anchor="middle" fill="#667">${fh(i)}</text>`:''}`}).join('')+'</svg><div class="muted">Incidents by hour of day (red = busiest hour)</div>'};
const tbl=(h,rows)=>`<div class="tw"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.join('')||`<tr><td colspan="${h.length}" class="muted">Nothing to show yet.</td></tr>`}</table></div>`;
const csv=()=>{const t='type,description,latitude,longitude,area,severity,date,hour\n'+DB.crimes.map(c=>[c.type,String(c.description).replace(/,/g,';'),c.latitude,c.longitude,String(c.area).replace(/,/g,' '),c.severity,c.occurredAt,c.hour??''].join(',')).join('\n');dl(t,'incidents.csv')};
const dl=(t,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=n;a.click()};
const sampleCsv=()=>dl('type,description,latitude,longitude,area,severity,date,hour\nTheft,Bike stolen,17.385,78.486,Charminar,2,2026-09-12,20\nRobbery,Chain snatching,17.386,78.487,Charminar,4,2026-09-20,22\nCyber Fraud,Fake KYC call,17.440,78.349,Gachibowli,3,2026-09-18,11\nBurglary,House break-in,17.450,78.380,Madhapur,4,2026-09-25,2\n','sample-crimes.csv');
/* ---------- screens ---------- */
const V={
home(){const A=areaStats(),mine=DB.complaints.filter(c=>c.by==SES.username&&!['Resolved','Rejected'].includes(c.status)).length,tt=trends().byType,top=Object.entries(tt).sort((a,b)=>b[1]-a[1]).slice(0,3);
 return`<h2 style="margin:0">Hello, ${esc(SES.username)} 👋</h2>${alertBox()}
 <div class="kpis">${kp(last(30),'Incidents in last 30 days')}${kp(A.filter(s=>s.level=='HIGH').length,'High-risk areas',COL.HIGH)}${kp(A.length?esc(A[A.length-1].area):'-','Safest area',COL.LOW)}${kp(mine,'My open complaints','#ff9f1c')}</div>${mapCard()}
 <div class="grid"><div class="card"><h3>Areas to be careful in</h3>${A.slice(0,4).map(s=>`<div class="hl"><span><b>${esc(s.area)}</b><br><span class="muted">Most common: ${esc(s.top)} · risky hours ${s.peak}</span></span>${lb(s.level)}</div>`).join('')}</div>
 <div class="card"><h3>Safety tips</h3>${top.map(([t])=>`<p><b>${esc(t)}:</b> ${esc(TIPS[t]||'Stay alert and report suspicious activity.')}</p>`).join('')}</div></div>`},
areas(){const A=areaStats();AREA=AREA||(A[0]||{}).area;const s=A.find(x=>x.area==AREA)||A[0];if(!s)return'<div class="card">No data yet.</div>';
 const c=COL[s.level];return`<div class="card"><h3>Check an area</h3><select onchange="AREA=this.value;go('areas')">${A.map(x=>`<option${x.area==s.area?' selected':''}>${esc(x.area)}</option>`).join('')}</select>
 <div class="grid"><div><div class="score" style="background:conic-gradient(${c} ${s.safety}%,#e3e9f1 0)"><b>${s.safety}</b></div><p style="text-align:center;margin:0"><b>Safety score</b> (higher is safer)<br>${lb(s.level)} risk · ${s.count} incidents recorded</p></div>
 <div><p><b>Most common crime:</b> ${esc(s.top)}</p><p><b>Riskiest hours:</b> ${s.peak}</p><p><b>Tip:</b> ${esc(TIPS[s.top]||'Stay alert and report suspicious activity.')}</p></div></div></div>
 <div class="card"><h3>When incidents happen in ${esc(s.area)}</h3>${hrs(s.hours)}</div>
 <div class="card"><h3>All areas compared</h3>${tbl(['Area','Safety','Risk','Incidents','Most common','Risky hours'],A.slice().reverse().map(x=>`<tr><td><b>${esc(x.area)}</b></td><td style="min-width:110px"><div class="bar"><i style="width:${x.safety}%;background:${COL[x.level]}"></i></div>${x.safety}</td><td>${lb(x.level)}</td><td>${x.count}</td><td>${esc(x.top)}</td><td>${x.peak}</td></tr>`))}</div>`},
file(){const A=areaStats();return`<div class="card"><h3>File a complaint</h3><p class="muted">Your complaint goes to the police queue. You will get a tracking ID to follow its progress.</p>
 <select id="ct">${TYPES.map(t=>`<option>${t}</option>`).join('')}</select><input id="ca" list="al" placeholder="Area / locality"><datalist id="al">${A.map(s=>`<option value="${esc(s.area)}">`).join('')}</datalist>
 <input id="cd" type="date" value="${today()}" max="${today()}"><select id="cu"><option>Low</option><option selected>Medium</option><option>High</option></select><br>
 <textarea id="cx" placeholder="Describe what happened (at least 10 characters)"></textarea>
 <input id="cla" placeholder="Latitude (optional)" style="width:150px"><input id="clo" placeholder="Longitude (optional)" style="width:150px"><button class="gh" onclick="loc()">📍 Use my location</button><br>
 <label class="muted"><input type="checkbox" id="can"> File anonymously (police will not see my name)</label><br><button onclick="submitC()">Submit complaint</button><p id="fm"></p></div>`},
mine(){const L=DB.complaints.filter(c=>c.by==SES.username).slice().reverse();return`<div class="card"><h3>My complaints</h3>${L.map(c=>`<div class="hl" style="display:block"><div style="display:flex;justify-content:space-between"><b>${c.id} · ${esc(c.type)} · ${esc(c.area)}</b>${sb(c.status)}</div><div class="muted">${c.date} · urgency ${c.urgency}</div><p style="margin:6px 0">${esc(c.description)}</p>${c.note?`<p class="muted"><b>Police note:</b> ${esc(c.note)}</p>`:''}${steps(c.status)}</div>`).join('')||'<p class="muted">You have not filed any complaints yet.</p>'}</div>`},
sos(){return`<div class="card alert"><h3>🚨 In danger?</h3><p>Press SOS to alert the police control room with your location (demo). For real emergencies, always call 112.</p><button class="red" style="font-size:18px;padding:14px 28px" onclick="sendSOS()">SEND SOS</button><p id="sm"></p></div>
 <div class="card"><h3>Helplines (India)</h3><div class="grid">${[['Police','100'],['National Emergency','112'],['Women Helpline','181'],['Cyber Crime','1930'],['Ambulance','108'],['Child Helpline','1098']].map(([n,c])=>`<div class="hl"><span>${n}</span><b style="font-size:20px">${c}</b></div>`).join('')}</div></div>`},
cmd(){const t=trends(),A=areaStats(),pend=DB.complaints.filter(c=>c.status=='Submitted').length,sos=DB.sos.filter(s=>s.status=='Open');
 return`${sos.length?`<div class="card alert"><h3>🚨 Open SOS alerts</h3>${sos.map(s=>`<div class="hl"><span><b>${esc(s.by)}</b> · ${s.t}${s.lat?` · ${(+s.lat).toFixed(4)}, ${(+s.lng).toFixed(4)}`:' · location unavailable'}</span><button class="sm" onclick="ackSOS(${s.id})">Acknowledge</button></div>`).join('')}</div>`:''}${alertBox()}
 <div class="kpis">${kp(DB.crimes.length,'Total incidents')}${kp(last(30),'Last 30 days')}${kp(A.filter(s=>s.level=='HIGH').length,'High-risk zones',COL.HIGH)}${kp(pend,'New complaints','#ff9f1c')}${kp(t.forecast,'Predicted next month','#2563eb')}</div>${mapCard()}
 <div class="grid"><div class="card"><h3>Monthly trend + prediction</h3>${line(t)}</div><div class="card"><h3>By crime type</h3>${bars(t.byType)}</div></div>
 <div class="card"><h3>Busiest hours (all areas)</h3>${hrs(allHours())}</div>`},
queue(){const L=DB.complaints.filter(c=>QF=='All'||c.status==QF).slice().reverse();
 return`<div class="card"><h3>Citizen complaints <select class="sm" onchange="QF=this.value;go('queue')">${['All',...Object.keys(STC)].map(s=>`<option${s==QF?' selected':''}>${s}</option>`).join('')}</select></h3>
 <p class="muted">Setting a complaint to <b>Verified</b> adds it to the crime records and the hotspot map.</p>${tbl(['Complaint','Details','Where / when','Urgency','From','Action'],L.map(c=>`<tr><td><b>${c.id}</b><br>${sb(c.status)}</td><td><b>${esc(c.type)}</b><br><span class="muted">${esc(c.description)}</span></td><td>${esc(c.area)}<br>${c.date}</td><td>${c.urgency}</td><td>${c.anon?'Anonymous':esc(c.by)}</td>
 <td><select class="sm" onchange="setSt('${c.id}',this.value)">${Object.keys(STC).map(s=>`<option${s==c.status?' selected':''}>${s}</option>`).join('')}</select><br><input placeholder="Officer note" value="${esc(c.note)}" onchange="setNote('${c.id}',this.value)" style="width:150px"></td></tr>`))}</div>`},
patrol(){const A=areaStats().slice(0,6),cov=A.filter(s=>DB.patrols[s.area]).length;
 return`<div class="kpis">${kp(A.length,'Priority zones')}${kp(cov+'/'+A.length,'Zones with patrol assigned',COL.LOW)}${kp(A.reduce((n,s)=>n+(DB.patrols[s.area]?(s.level=='HIGH'?3:s.level=='MEDIUM'?2:1):0),0),'Units deployed','#2563eb')}</div>
 <div class="card"><h3>Patrol planner</h3><p class="muted">Zones are ranked by predicted risk. The recommended window is the busiest 3-hour period for that zone.</p>${tbl(['Zone','Risk','Recommended window','Main threat','Units','Assigned'],A.map(s=>`<tr><td><b>${esc(s.area)}</b></td><td>${lb(s.level)}</td><td>${s.peak}</td><td>${esc(s.top)}</td><td>${s.level=='HIGH'?3:s.level=='MEDIUM'?2:1}</td><td><input type="checkbox" ${DB.patrols[s.area]?'checked':''} onchange="setPatrol(U('${q(s.area)}'),this.checked)"></td></tr>`))}</div>`},
data(){const L=DB.crimes.filter(c=>!RS||(c.area+c.type+c.description).toLowerCase().includes(RS.toLowerCase())).slice(-15).reverse();
 return`<div class="grid"><div class="card"><h3>Add an incident</h3><select id="rt">${TYPES.map(t=>`<option>${t}</option>`).join('')}</select><input id="ra" placeholder="Area"><input id="rd" placeholder="Description"><br>
 <input id="rla" type="number" step="0.001" value="17.385" style="width:110px"><input id="rlo" type="number" step="0.001" value="78.486" style="width:110px"><input id="rh" type="number" min="0" max="23" value="${new Date().getHours()}" style="width:70px" title="Hour (0-23)"><select id="rs">${[1,2,3,4,5].map(n=>`<option${n==2?' selected':''}>${n}</option>`).join('')}</select><button onclick="addInc()">Add</button><p id="dm" class="muted"></p></div>
 <div class="card"><h3>Upload crime data (CSV)</h3><input type="file" accept=".csv" onchange="doUpload(this)"><br><button class="sm gh" onclick="sampleCsv()">Download sample CSV</button><p class="muted">Columns: type, description, latitude, longitude, area, severity, date, hour. Bad and duplicate rows are skipped.</p></div></div>
 <div class="card"><h3>Crime records</h3><input placeholder="Search by area, type or text" value="${esc(RS)}" onchange="RS=this.value;go('data')" style="width:260px">${tbl(['ID','Type','Area','Date','Hour','Severity'],L.map(c=>`<tr><td>${c.id}</td><td>${esc(c.type)}</td><td>${esc(c.area)}</td><td>${c.occurredAt}</td><td>${c.hour!=null?fh(c.hour):'-'}</td><td>${c.severity}</td></tr>`))}</div>`},
ov(){const t=trends(),res=DB.complaints.filter(c=>c.status=='Resolved').length,pct=DB.complaints.length?Math.round(res/DB.complaints.length*100):0;
 return`<div class="kpis">${kp(DB.users.length,'Registered users')}${kp(DB.users.filter(u=>u.role=='POLICE').length,'Police accounts','#2563eb')}${kp(DB.crimes.length,'Incidents')}${kp(DB.complaints.length,'Complaints','#ff9f1c')}${kp(pct+'%','Complaints resolved',COL.LOW)}${kp(DB.sos.filter(s=>s.status=='Open').length,'Open SOS alerts',COL.HIGH)}</div>${alertBox()}${mapCard()}
 <div class="grid"><div class="card"><h3>Monthly trend + prediction</h3>${line(t)}</div><div class="card"><h3>By crime type</h3>${bars(t.byType)}</div></div>
 <div class="card"><h3>Recent activity</h3>${tbl(['Time','User','Action'],DB.audit.slice(0,6).map(a=>`<tr><td>${a.t}</td><td>${esc(a.u)}</td><td>${esc(a.m)}</td></tr>`))}</div>`},
users(){return`<div class="card"><h3>User management</h3><p class="muted">Grant <b>POLICE</b> to let an account open the police dashboard without an access code.</p>${tbl(['Name','Access level',''],DB.users.map(x=>`<tr><td><b>${esc(x.username)}</b></td><td><select ${x.username=='admin'?'disabled':''} onchange="setRole(U('${q(x.username)}'),this.value)">${['PUBLIC','POLICE','ADMIN'].map(r=>`<option${r==x.role?' selected':''}>${r}</option>`).join('')}</select></td><td>${x.username=='admin'?'':`<button class="sm red" onclick="delUser(U('${q(x.username)}'))">Remove</button>`}</td></tr>`))}</div>`},
rec(){return`<div class="card"><h3>Latest incidents</h3>${tbl(['ID','Type','Area','Date',''],DB.crimes.slice(-12).reverse().map(c=>`<tr><td>${c.id}</td><td>${esc(c.type)}</td><td>${esc(c.area)}</td><td>${c.occurredAt}</td><td><button class="sm red" onclick="delCrime(${c.id})">Delete</button></td></tr>`))}</div>
 <div class="card"><h3>Complaints</h3>${tbl(['ID','Type','Area','From','Status',''],DB.complaints.slice().reverse().map(c=>`<tr><td>${c.id}</td><td>${esc(c.type)}</td><td>${esc(c.area)}</td><td>${esc(c.by)}</td><td>${sb(c.status)}</td><td><button class="sm red" onclick="delComp('${c.id}')">Delete</button></td></tr>`))}</div>`},
sys(){return`<div class="card"><h3>System</h3><p>Users: <b>${DB.users.length}</b> · Incidents: <b>${DB.crimes.length}</b> · Complaints: <b>${DB.complaints.length}</b> · SOS alerts: <b>${DB.sos.length}</b></p><p class="muted">Data is stored on the server (backend/data/db.json).</p>
 <button onclick="csv()">⬇ Export incidents (CSV)</button><button class="red" onclick="resetDb()">Reset demo data</button></div>
 <div class="card"><h3>Activity log</h3>${tbl(['Time','User','Action'],DB.audit.map(a=>`<tr><td>${a.t}</td><td>${esc(a.u)}</td><td>${esc(a.m)}</td></tr>`))}</div>
 <div class="card"><h3>SOS alerts</h3>${tbl(['Time','From','Status'],DB.sos.slice().reverse().map(s=>`<tr><td>${s.t}</td><td>${esc(s.by)}</td><td>${s.status}</td></tr>`))}</div>`}};
function steps(s){const o=['Submitted','Under Review','Verified','Resolved'],i=o.indexOf(s);if(s=='Rejected')return'<div class="muted">Closed by police</div>';
 return`<div style="display:flex;gap:4px;margin-top:6px">${o.map((x,j)=>`<div style="flex:1;text-align:center;font-size:11px"><div class="bar"><i style="width:${j<=i?100:0}%;background:var(--ac)"></i></div>${x}</div>`).join('')}</div>`}
/* ---------- actions (all persisted through the backend) ---------- */
function loc(){if(!navigator.geolocation){$('#fm').textContent='Location is not available on this device';return}navigator.geolocation.getCurrentPosition(p=>{$('#cla').value=p.coords.latitude.toFixed(5);$('#clo').value=p.coords.longitude.toFixed(5)},()=>{$('#fm').textContent='Could not get your location'})}
const submitC=safe(async()=>{const a=$('#ca').value.trim(),d=$('#cx').value.trim(),fm=$('#fm');
 if(!a){fm.textContent='Please enter the area';return}if(d.length<10){fm.textContent='Please describe the incident (at least 10 characters)';return}
 const s=areaStats().find(x=>x.area.toLowerCase()==a.toLowerCase()),la=parseFloat($('#cla').value),lo=parseFloat($('#clo').value);
 try{const r=await api('POST','/complaints',{type:$('#ct').value,area:s?s.area:a,description:d,date:$('#cd').value||today(),urgency:$('#cu').value,anon:$('#can').checked,
  lat:isNaN(la)?(s?s.la:17.385):la,lng:isNaN(lo)?(s?s.lo:78.486):lo});
  fm.innerHTML=`✅ Complaint registered. Your tracking ID is <b>${r.id}</b>. Track it under “My Complaints”.`}catch(e){fm.textContent=e.message}});
function sendSOS(){const done=async(la,lo)=>{try{await api('POST','/sos',{lat:la,lng:lo});$('#sm').innerHTML='✅ SOS sent to the police control room. Stay calm and, if you can, call <b>112</b>.'}catch(e){$('#sm').textContent=e.message}};
 if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>done(p.coords.latitude,p.coords.longitude),()=>done(null,null),{timeout:4000});else done(null,null)}
const ackSOS=safe(async id=>{await api('PATCH','/sos/'+id);go('cmd')});
const setSt=safe(async(id,v)=>{await api('PATCH','/complaints/'+id,{status:v});go('queue')});
const setNote=safe(async(id,v)=>{await api('PATCH','/complaints/'+id,{note:v})});
const setPatrol=safe(async(a,v)=>{await api('PUT','/patrols',{area:a,assigned:v});go('patrol')});
const addInc=safe(async()=>{const a=$('#ra').value.trim();if(!a){$('#dm').textContent='Enter the area';return}
 try{await api('POST','/crimes',{type:$('#rt').value,area:a,description:$('#rd').value,latitude:+$('#rla').value,longitude:+$('#rlo').value,severity:+$('#rs').value,hour:+$('#rh').value})}catch(e){$('#dm').textContent=e.message;return}
 await go('data');$('#dm').textContent='Incident added'});
function doUpload(i){const f=i.files[0];if(!f)return;const rd=new FileReader();rd.onload=safe(async()=>{const r=await api('POST','/crimes/upload',{csv:rd.result});await go('data');$('#dm').textContent='Upload done: '+r.imported+' added, '+r.skipped+' skipped'});rd.readAsText(f)}
const setRole=safe(async(n,r)=>{await api('PATCH','/users/'+encodeURIComponent(n),{role:r});go('users')});
const delUser=safe(async n=>{if(!confirm('Remove '+n+'?'))return;await api('DELETE','/users/'+encodeURIComponent(n));go('users')});
const delCrime=safe(async id=>{await api('DELETE','/crimes/'+id);go('rec')});
const delComp=safe(async id=>{await api('DELETE','/complaints/'+id);go('rec')});
const resetDb=safe(async()=>{if(!confirm('Reset all data to the demo set? Registered users will be removed.'))return;await api('POST','/reset');go('sys')});
showLogin();
