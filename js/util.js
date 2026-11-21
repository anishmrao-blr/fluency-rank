export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const rnd = n => Math.floor(Math.random() * n);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
export const int = (v, d, lo, hi) => Math.round(num(v, d, lo, hi));
export const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pad = n => String(n).padStart(2, '0');
export const dstr = d => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const dayNum = s => { const p = s.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); };
export const numStr = n => { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
export const weekStartNum = n => n - ((n + 3) % 7); /* Monday start; day 0 (1970-01-01) was a Thursday */
export const fmt = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); };
