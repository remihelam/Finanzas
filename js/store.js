// Estado de la app: se guarda en el dispositivo (localStorage) y se sincroniza con Supabase.
import { uid, hoyIso } from './fechas.js';

const KEY = 'finanzas:v1';
let state = null;
const subs = new Set();
let onCambio = null; // la sincronización se engancha aquí

export const getState = () => state;
export const hayDatos = () => !!(state && state.config);

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function alCambiar(fn) {
  onCambio = fn;
}

function guardar() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* almacenamiento no disponible (modo privado): la app sigue funcionando en memoria */
  }
}

function emitir({ local = true } = {}) {
  guardar();
  subs.forEach((f) => f(state));
  if (local && onCambio) onCambio();
}

export function cargar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    state = null;
  }
  if (state && !state.sync) state.sync = { configDirty: false, dirty: [], lastPull: null };
  return state;
}

function estadoNuevo(config, movimientos = []) {
  const s = {
    config: { ...config, updatedAt: config.updatedAt || Date.now() },
    movimientos: {},
    sync: { configDirty: true, dirty: [], lastPull: null },
    prefs: { ultimaCuenta: 'efectivo' },
  };
  for (const m of movimientos) {
    const id = m.id || uid();
    s.movimientos[id] = { ...m, id, updatedAt: m.updatedAt || Date.now() };
    s.sync.dirty.push(id);
  }
  return s;
}

export function iniciarCon(datos) {
  state = estadoNuevo(datos.config, datos.movimientos || []);
  emitir();
}

// Estado vacío para un dispositivo nuevo que bajará los datos de la nube.
export function iniciarVacio(configVacia) {
  state = estadoNuevo({ ...configVacia, updatedAt: 0 });
  state.sync.configDirty = false;
  emitir({ local: false });
}

export function movimientos() {
  return Object.values(state.movimientos)
    .filter((m) => !m.deleted)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.creado || 0) - (a.creado || 0)));
}

function marcar(id) {
  if (!state.sync.dirty.includes(id)) state.sync.dirty.push(id);
}

export function agregarMov(m) {
  const id = uid();
  const now = Date.now();
  state.movimientos[id] = { fecha: hoyIso(), ...m, id, creado: now, updatedAt: now };
  if (m.tipo === 'gasto' && m.cuenta) state.prefs = { ...(state.prefs || {}), ultimaCuenta: m.cuenta };
  marcar(id);
  emitir();
  return id;
}

export function editarMov(id, cambios) {
  const m = state.movimientos[id];
  if (!m) return;
  state.movimientos[id] = { ...m, ...cambios, updatedAt: Date.now() };
  marcar(id);
  emitir();
}

export function borrarMov(id) {
  editarMov(id, { deleted: true });
}

export function editarConfig(fn) {
  const c = structuredClone(state.config);
  fn(c);
  c.updatedAt = Date.now();
  state.config = c;
  state.sync.configDirty = true;
  emitir();
}

export function exportar() {
  return { tipo: 'finanzas-remi', version: 1, exportado: new Date().toISOString(), config: state.config, movimientos: movimientos() };
}

// ---- usado por la sincronización ----
export function aplicarRemoto(fn) {
  fn(state);
  emitir({ local: false });
}
