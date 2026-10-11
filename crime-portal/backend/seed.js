// Demo data generator + password hashing helpers
const crypto = require('crypto');
const TYPES = ['Theft','Robbery','Assault','Burglary','Harassment','Cyber Fraud'];

function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') };
}
function checkPw(pw, u) {
  const h = crypto.scryptSync(pw, u.salt, 32);
  return crypto.timingSafeEqual(h, Buffer.from(u.hash, 'hex'));
}
function rnd(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const today = () => new Date().toISOString().slice(0, 10);

function seed() {
  const r = rnd(7),
    c = [[17.385,78.486],[17.44,78.349],[17.45,78.38],[17.42,78.45],[17.495,78.399],[17.348,78.552]],
    ar = ['Charminar','Gachibowli','Madhapur','Banjara Hills','Kukatpally','LB Nagar'], crimes = [];
  for (let i = 0; i < 120; i++) {
    const k = r() < .4 ? 0 : Math.floor(r() * 6), d = new Date(Date.now() - Math.floor(r() * 180) * 864e5);
    crimes.push({ id: i + 1, type: TYPES[Math.floor(r() * 6)], description: 'Reported incident', area: ar[k],
      latitude: c[k][0] + (r() - .5) * .006, longitude: c[k][1] + (r() - .5) * .006,
      severity: 1 + Math.floor(r() * 5), occurredAt: d.toISOString().slice(0, 10),
      hour: r() < .6 ? (18 + Math.floor(r() * 6)) % 24 : Math.floor(r() * 24) });
  }
  const cm = (id, by, type, area, description, urgency, status) =>
    ({ id, by, type, area, description, date: today(), urgency, anon: false, lat: 17.45, lng: 78.38, status, note: '' });
  return {
    users: [{ username: 'admin', ...hashPw('admin123'), role: 'ADMIN' }],
    crimes, patrols: {}, audit: [], sos: [], nextId: 121, nextC: 1004,
    complaints: [
      cm('CMP-1001','Anita Sharma','Theft','Madhapur','Mobile phone snatched near the metro station.','High','Submitted'),
      cm('CMP-1002','Ravi Kumar','Harassment','Gachibowli','Repeated harassment near the bus stop at night.','Medium','Under Review'),
      cm('CMP-1003','Sneha Rao','Cyber Fraud','Banjara Hills','Lost money to a fake KYC call.','High','Submitted')]
  };
}
module.exports = { seed, hashPw, checkPw, TYPES, today };
