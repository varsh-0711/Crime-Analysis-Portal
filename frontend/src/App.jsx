import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Bar, Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js'; Chart.register(...registerables);

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8081/api').replace(/\/$/, '');
const color = { HIGH: '#d62728', MEDIUM: '#ff9f1c', LOW: '#2a9d8f' };

export default function App() {
  const [auth, setAuth] = useState(null);
  return auth ? <Dashboard auth={auth} logout={() => setAuth(null)} /> : <Login onAuth={setAuth} />;
}

function Login({ onAuth }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const call = async (path) => {
    if (!f.username || !f.password) return setMsg('Enter username and password');
    setBusy(true); setMsg(path === 'login' ? 'Logging in... (first request may take ~50s on free hosting)' : 'Registering...');
    try {
      const r = await fetch(`${API}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (!r.ok) setMsg((await r.text()) || `Error ${r.status}`);
      else if (path === 'login') onAuth(await r.json());
      else setMsg('Registered. Now click Login.');
    } catch (e) { setMsg(`Cannot reach backend at ${API}. Is it running / is VITE_API_URL correct?`); }
    setBusy(false);
  };
  return <div className="card login"><h2>Crime Hotspot Portal</h2>
    <input placeholder="Username" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} />
    <input type="password" placeholder="Password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })}
      onKeyDown={e => e.key === 'Enter' && call('login')} />
    <div><button disabled={busy} onClick={() => call('login')}>Login</button>
      <button disabled={busy} onClick={() => call('register')}>Register</button></div>
    <p>{msg}</p><small>Demo admin: admin / admin123</small></div>;
}

function Dashboard({ auth, logout }) {
  const H = { Authorization: `Bearer ${auth.token}` };
  const [spots, setSpots] = useState([]); const [tr, setTr] = useState(null); const [msg, setMsg] = useState('');
  const [rep, setRep] = useState({ type: 'Theft', description: '', area: '', latitude: 17.385, longitude: 78.486, severity: 2 });
  const get = async (p) => {
    const r = await fetch(`${API}${p}`, { headers: H });
    if (r.status === 401 || r.status === 403) { logout(); throw new Error('Session expired'); }
    return r.json();
  };
  const load = async () => {
    try { setSpots(await get('/analytics/hotspots')); setTr(await get('/analytics/trends')); }
    catch (e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);
  const upload = async (e) => {
    const fd = new FormData(); fd.append('file', e.target.files[0]);
    const r = await fetch(`${API}/crimes/upload`, { method: 'POST', headers: H, body: fd });
    setMsg(r.ok ? 'Upload done: ' + JSON.stringify(await r.json()) : 'Upload not allowed'); load();
  };
  const report = async () => {
    const r = await fetch(`${API}/crimes`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(rep) });
    setMsg(r.ok ? 'Incident reported' : 'Failed to report'); load();
  };
  const high = spots.filter(s => s.level === 'HIGH').length;
  const canUpload = ['POLICE', 'ADMIN'].includes(auth.role);
  return <>
    <header><b>🛡 Crime Hotspot Analysis & Prediction Portal</b><span>{auth.role} <button onClick={logout}>Logout</button></span></header>
    <div className="wrap">
      {high > 0 && <div className="card" style={{ borderLeft: '5px solid #d62728' }}>⚠ Alert: {high} high-risk area(s) detected.</div>}
      <div className="card"><h3>Hotspot Map</h3>
        <MapContainer center={[17.41, 78.43]} zoom={11} style={{ height: 380 }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {spots.map((s, i) => <CircleMarker key={i} center={[s.lat, s.lng]} radius={10 + s.risk * 20}
            pathOptions={{ color: color[s.level], fillOpacity: .5 }}>
            <Popup>{s.level} risk ({s.risk})<br />{s.count} incidents</Popup></CircleMarker>)}
        </MapContainer></div>
      {tr && <div className="grid">
        <div className="card"><h3>Monthly Trend</h3>
          <Line data={{ labels: [...tr.labels, tr.nextMonth + ' (forecast)'], datasets: [{ label: 'Crimes', data: [...tr.values, tr.forecast], borderColor: '#0d2b5b' }] }} />
          <p>Predicted next month: <b>{tr.forecast}</b> incidents</p></div>
        <div className="card"><h3>By Crime Type</h3>
          <Bar data={{ labels: Object.keys(tr.byType), datasets: [{ label: 'Count', data: Object.values(tr.byType), backgroundColor: '#3a6ea5' }] }} /></div>
      </div>}
      <div className="grid">
        <div className="card"><h3>Report Incident</h3>
          <select onChange={e => setRep({ ...rep, type: e.target.value })}>{['Theft', 'Robbery', 'Assault', 'Burglary'].map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Area" onChange={e => setRep({ ...rep, area: e.target.value })} />
          <input placeholder="Description" onChange={e => setRep({ ...rep, description: e.target.value })} />
          <input type="number" step="0.001" value={rep.latitude} onChange={e => setRep({ ...rep, latitude: +e.target.value })} />
          <input type="number" step="0.001" value={rep.longitude} onChange={e => setRep({ ...rep, longitude: +e.target.value })} />
          <button onClick={report}>Submit</button></div>
        {canUpload && <div className="card"><h3>Upload Crime Data (CSV)</h3><input type="file" accept=".csv" onChange={upload} /></div>}
      </div>
      <p>{msg}</p>
    </div></>;
}
