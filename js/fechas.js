// Utilidades de fechas y formato. Un "ym" es un texto 'AAAA-MM'.

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

export function parseYm(s) {
  const [y, m] = s.split('-').map(Number);
  return { y, m };
}

export function addMonths(s, n) {
  const { y, m } = parseYm(s);
  const total = y * 12 + (m - 1) + n;
  return ym(Math.floor(total / 12), (total % 12) + 1);
}

export function cmpYm(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function rangoMeses(desde, hasta) {
  const out = [];
  for (let t = desde; t <= hasta; t = addMonths(t, 1)) out.push(t);
  return out;
}

// Cuántas veces ha ocurrido el mes `mesEvento` (1-12) después de `base` y hasta `t` inclusive.
export function vecesMes(base, t, mesEvento) {
  const b = parseYm(base);
  const x = parseYm(t);
  let n = x.y - b.y;
  if (x.m < mesEvento) n -= 1;
  if (b.m < mesEvento) n += 1;
  return Math.max(0, n);
}

export function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const ymDeFecha = (iso) => iso.slice(0, 7);
export const ymActual = () => ymDeFecha(hoyIso());

export function nombreMes(t, largo = false) {
  const { y, m } = parseYm(t);
  return largo ? `${MESES_LARGOS[m - 1]} ${y}` : `${MESES[m - 1]} ${String(y).slice(2)}`;
}

export function diasEnMes(t) {
  const { y, m } = parseYm(t);
  return new Date(y, m, 0).getDate();
}

export function fechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${dias[dt.getDay()]} ${d} ${MESES[m - 1]}`;
}

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
export const dinero = (n) => fmt.format(Math.round(n || 0)).replace('MX$', '$');

export function dineroCorto(n) {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return dinero(n);
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
