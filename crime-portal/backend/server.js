// Crime Hotspot Portal - backend (Node.js, no external dependencies)
// REST API + static hosting of ../frontend. Data persisted in backend/data/db.json
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { seed, hashPw, checkPw, TYPES, today } = require('./seed');

const PORT = process.env.PORT || 3000;
const POLICE_CODE = process.env.POLICE_CODE || 'POL-2026';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const WEB = path.join(__dirname, '..', 'frontend');
const STATUSES = ['Submitted','Under Review','Verified','Resolved','Rejected'];

/* ---------- storage ---------- */
let DB;
function load() { try { DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { DB = seed(); } ensureAdmin(); save(); }
function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(DB)); fs.renameSync(tmp, DB_FILE);
}
function ensureAdmin() {
  const a = DB.users.find(u => u.username.toLowerCase() === 'admin');
  if (!a) DB.users.unshift({ username: 'admin', ...hashPw('admin123'), role: 'ADMIN' });
}
const audit = (u, m) => { DB.audit.unshift({ t: new Date().toLocaleString(), u: u || '-', m }); DB.audit.length = Math.min(DB.audit.length, 40); save(); };

/* ---------- sessions ---------- */
const SESSIONS = new Map(); // token -> { username, police }
const err = (code, msg) => Object.assign(new Error(msg), { code });

function authed(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', ''), s = SESSIONS.get(t);
  if (!s) throw err(401, 'Please login again');
  const u = DB.users.find(x => x.username === s.username);
  if (!u) { SESSIONS.delete(t); throw err(401, 'Account no longer exists'); }
  return { token: t, username: u.username, role: u.role, police: s.police || u.role !== 'PUBLIC' };
}
const needPolice = s => { if (!s.police) throw err(403, 'Police access required'); };
const needAdmin = s => { if (s.role !== 'ADMIN') throw err(403, 'Administrator access required'); };

/* ---------- state exposed to the frontend (filtered by role) ---------- */
function stateFor(s) {
  const adm = s.role === 'ADMIN', pol = s.police;
  return {
    crimes: DB.crimes, patrols: DB.patrols,
    users: adm ? DB.users.map(u => ({ username: u.username, role: u.role })) : [{ username: s.username, role: s.role }],
    complaints: (pol ? DB.complaints : DB.complaints.filter(c => c.by === s.username))
      .map(c => (!adm && c.anon && c.by !== s.username) ? { ...c, by: 'Anonymous' } : c),
    sos: pol ? DB.sos : [],
    audit: adm ? DB.audit : []
  };
}

/* ---------- routes ---------- */
const R = [];
const route = (m, p, h) => R.push([m, new RegExp('^' + p.replace(/:\w+/g, '([^/]+)') + '$'), h]);
const num = (v, lo, hi, name) => { v = Number(v); if (!isFinite(v) || v < lo || v > hi) throw err(400, 'Invalid ' + name); return v; };

route('POST', '/api/auth/register', (req, b) => {
  const u = String(b.username || '').trim().replace(/\s+/g, ' '), pw = String(b.password || '');
  if (!/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(u)) throw err(400, 'Name should contain only letters and spaces (2-40 characters)');
  if (pw.length < 6) throw err(400, 'Password must be at least 6 characters');
  if (DB.users.some(x => x.username.toLowerCase() === u.toLowerCase())) throw err(409, 'This name is already registered. Please login or use a different name');
  DB.users.push({ username: u, ...hashPw(pw), role: 'PUBLIC' }); save();
  return login(u, pw, 'Registered and signed in');
});
route('POST', '/api/auth/login', (req, b) => login(String(b.username || '').trim(), String(b.password || ''), 'Signed in'));
function login(name, pw, msg) {
  const u = DB.users.find(x => x.username.toLowerCase() === name.toLowerCase());
  if (!u || !checkPw(pw, u)) throw err(401, 'Invalid name or password');
  const token = crypto.randomBytes(24).toString('hex'); SESSIONS.set(token, { username: u.username, police: false });
  audit(u.username, msg); return { token, username: u.username, role: u.role };
}
route('POST', '/api/auth/logout', req => { SESSIONS.delete(authed(req).token); return { ok: true }; });
route('POST', '/api/auth/police-code', (req, b) => {
  const s = authed(req);
  if (String(b.code || '').trim().toUpperCase() !== POLICE_CODE.toUpperCase()) throw err(403, 'Incorrect access code');
  SESSIONS.get(s.token).police = true; audit(s.username, 'Verified police access code'); return { ok: true };
});
route('POST', '/api/audit', (req, b) => { const s = authed(req); audit(s.username, String(b.m || '').slice(0, 200)); return { ok: true }; });
route('GET', '/api/state', req => stateFor(authed(req)));

route('POST', '/api/complaints', (req, b) => {
  const s = authed(req), area = String(b.area || '').trim(), d = String(b.description || '').trim();
  if (!area) throw err(400, 'Please enter the area');
  if (d.length < 10) throw err(400, 'Please describe the incident (at least 10 characters)');
  if (!TYPES.includes(b.type)) throw err(400, 'Invalid crime type');
  if (!['Low','Medium','High'].includes(b.urgency)) throw err(400, 'Invalid urgency');
  const c = { id: 'CMP-' + DB.nextC++, by: s.username, type: b.type, area, description: d,
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today(), urgency: b.urgency, anon: !!b.anon,
    lat: isFinite(+b.lat) ? +b.lat : 17.385, lng: isFinite(+b.lng) ? +b.lng : 78.486, status: 'Submitted', note: '' };
  DB.complaints.push(c); audit(s.username, 'Filed complaint ' + c.id); return { id: c.id };
});
route('PATCH', '/api/complaints/:id', (req, b, id) => {
  const s = authed(req); needPolice(s);
  const c = DB.complaints.find(x => x.id === id); if (!c) throw err(404, 'Complaint not found');
  if (b.note !== undefined) c.note = String(b.note).slice(0, 500);
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw err(400, 'Invalid status');
    c.status = b.status;
    if (b.status === 'Verified' && !c.crimeId) {   // verified complaints feed the hotspot data
      c.crimeId = DB.nextId;
      DB.crimes.push({ id: DB.nextId++, type: c.type, description: c.description, area: c.area, latitude: c.lat,
        longitude: c.lng, severity: { Low: 1, Medium: 3, High: 5 }[c.urgency], occurredAt: c.date, hour: new Date().getHours() });
    }
    audit(s.username, c.id + ' marked ' + b.status);
  } else save();
  return { ok: true };
});
route('DELETE', '/api/complaints/:id', (req, b, id) => {
  const s = authed(req); needAdmin(s);
  DB.complaints = DB.complaints.filter(c => c.id !== id); audit(s.username, 'Deleted complaint ' + id); return { ok: true };
});

route('POST', '/api/crimes', (req, b) => {
  const s = authed(req); needPolice(s);
  const area = String(b.area || '').trim(); if (!area) throw err(400, 'Enter the area');
  if (!TYPES.includes(b.type)) throw err(400, 'Invalid crime type');
  DB.crimes.push({ id: DB.nextId++, type: b.type, area, description: String(b.description || '').trim() || 'Reported incident',
    latitude: num(b.latitude, -90, 90, 'latitude'), longitude: num(b.longitude, -180, 180, 'longitude'),
    severity: Math.round(num(b.severity, 1, 5, 'severity')), occurredAt: today(), hour: Math.round(num(b.hour, 0, 23, 'hour')) });
  audit(s.username, 'Added incident in ' + area); return { ok: true };
});
route('POST', '/api/crimes/upload', (req, b) => {
  const s = authed(req); needPolice(s);
  let ok = 0, sk = 0; const seen = new Set();
  String(b.csv || '').split(/\r?\n/).slice(1).forEach(l => {
    if (!l.trim()) return; const p = l.split(',');
    if (p.length < 7 || seen.has(l.trim())) { sk++; return; } seen.add(l.trim());
    const lat = parseFloat(p[2]), lng = parseFloat(p[3]), sv = parseInt(p[5]), d = p[6].trim(), hr = parseInt(p[7]);
    if (isNaN(lat) || isNaN(lng) || isNaN(sv) || !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d))) { sk++; return; }
    DB.crimes.push({ id: DB.nextId++, type: p[0].trim(), description: p[1].trim(), area: p[4].trim(), latitude: lat,
      longitude: lng, severity: sv, occurredAt: d, hour: isNaN(hr) ? 12 : hr % 24 }); ok++;
  });
  audit(s.username, 'Uploaded crime data: ' + ok + ' added, ' + sk + ' skipped'); return { imported: ok, skipped: sk };
});
route('DELETE', '/api/crimes/:id', (req, b, id) => {
  const s = authed(req); needAdmin(s);
  DB.crimes = DB.crimes.filter(c => String(c.id) !== id); audit(s.username, 'Deleted incident ' + id); return { ok: true };
});

route('POST', '/api/sos', (req, b) => {
  const s = authed(req), ok = v => v !== null && v !== undefined && isFinite(+v);
  DB.sos.push({ id: Date.now(), by: s.username, t: new Date().toLocaleString(),
    lat: ok(b.lat) ? +b.lat : null, lng: ok(b.lng) ? +b.lng : null, status: 'Open' });
  audit(s.username, 'Sent SOS alert'); return { ok: true };
});
route('PATCH', '/api/sos/:id', (req, b, id) => {
  const s = authed(req); needPolice(s);
  const x = DB.sos.find(v => String(v.id) === id); if (!x) throw err(404, 'Alert not found');
  x.status = 'Acknowledged'; audit(s.username, 'Acknowledged SOS from ' + x.by); return { ok: true };
});

route('PUT', '/api/patrols', (req, b) => {
  const s = authed(req); needPolice(s);
  DB.patrols[String(b.area)] = !!b.assigned; audit(s.username, (b.assigned ? 'Assigned' : 'Removed') + ' patrol: ' + b.area); return { ok: true };
});

route('PATCH', '/api/users/:name', (req, b, name) => {
  const s = authed(req); needAdmin(s); name = decodeURIComponent(name);
  const u = DB.users.find(x => x.username === name); if (!u) throw err(404, 'User not found');
  if (u.username === 'admin') throw err(400, 'The admin account cannot be changed');
  if (!['PUBLIC','POLICE','ADMIN'].includes(b.role)) throw err(400, 'Invalid role');
  u.role = b.role; audit(s.username, 'Set ' + name + ' to ' + b.role); return { ok: true };
});
route('DELETE', '/api/users/:name', (req, b, name) => {
  const s = authed(req); needAdmin(s); name = decodeURIComponent(name);
  if (name === 'admin') throw err(400, 'The admin account cannot be removed');
  DB.users = DB.users.filter(x => x.username !== name);
  for (const [t, v] of SESSIONS) if (v.username === name) SESSIONS.delete(t);
  audit(s.username, 'Removed user ' + name); return { ok: true };
});
route('POST', '/api/reset', req => {
  const s = authed(req); needAdmin(s); DB = seed(); ensureAdmin();
  for (const [t, v] of SESSIONS) if (v.username !== 'admin') SESSIONS.delete(t);
  audit(s.username, 'Reset demo data'); return { ok: true };
});

/* ---------- http plumbing ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/')) {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 5e6) req.destroy(); });
    return req.on('end', () => {
      try {
        const r = R.find(([m, re]) => m === req.method && re.test(url));
        if (!r) return send(res, 404, { error: 'Not found' });
        const body = raw ? JSON.parse(raw) : {}, args = url.match(r[1]).slice(1);
        send(res, 200, r[2](req, body, ...args));
      } catch (e) { send(res, e.code || (e instanceof SyntaxError ? 400 : 500), { error: e.code ? e.message : 'Server error' }); if (!e.code) console.error(e); }
    });
  }
  const f = path.normalize(path.join(WEB, url === '/' ? 'index.html' : url));
  if (!f.startsWith(WEB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d);
  });
}).listen(PORT, () => { load(); console.log(`Crime Hotspot Portal running at http://localhost:${PORT}  (admin / admin123, police code ${POLICE_CODE})`); });
