// Sincronización con Supabase. Si no está configurado, la app funciona solo en el dispositivo.
import { getState, aplicarRemoto, alCambiar } from './store.js';
import { migrar } from './modelo.js';

let cliente = null;
let usuario = null;
let estado = 'no-configurado'; // no-configurado | sin-sesion | sincronizando | listo | error | sin-red
let ultimoError = '';
let enCurso = false;
let pendiente = false;
let timer = null;
const subs = new Set();

export const infoSync = () => ({ estado, usuario, ultimoError, configurado: !!cliente });
export function onSync(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function set(e, err = '') {
  estado = e;
  ultimoError = err;
  subs.forEach((f) => f(infoSync()));
}

function credenciales() {
  const c = window.APP_CONFIG || {};
  let url = c.supabaseUrl;
  let key = c.supabaseAnonKey;
  try {
    url = url || localStorage.getItem('finanzas:supabaseUrl');
    key = key || localStorage.getItem('finanzas:supabaseKey');
  } catch (e) {
    /* sin almacenamiento */
  }
  return { url, key };
}

export function guardarCredenciales(url, key) {
  try {
    localStorage.setItem('finanzas:supabaseUrl', url.trim());
    localStorage.setItem('finanzas:supabaseKey', key.trim());
  } catch (e) {
    /* sin almacenamiento */
  }
  iniciarSync();
}

export async function iniciarSync() {
  const { url, key } = credenciales();
  if (!url || !key || !window.supabase) {
    set('no-configurado');
    return;
  }
  try {
    cliente = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  } catch (e) {
    set('error', 'Datos de Supabase inválidos');
    return;
  }
  alCambiar(() => programar(1500));
  cliente.auth.onAuthStateChange((_ev, sesion) => {
    const antes = usuario && usuario.id;
    usuario = sesion ? sesion.user : null;
    if (!usuario) set('sin-sesion');
    else if (antes !== usuario.id) sincronizar();
  });
  const { data } = await cliente.auth.getSession();
  usuario = data.session ? data.session.user : null;
  if (usuario) sincronizar();
  else set('sin-sesion');
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar();
  });
  window.addEventListener('online', () => sincronizar());
  setInterval(() => sincronizar(), 60000);
}

function programar(ms) {
  clearTimeout(timer);
  timer = setTimeout(sincronizar, ms);
}

export async function entrar(email, password) {
  if (!cliente) throw new Error('La sincronización no está configurada');
  const { error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) throw new Error(traducir(error.message));
}

export async function registrarse(email, password) {
  if (!cliente) throw new Error('La sincronización no está configurada');
  const { data, error } = await cliente.auth.signUp({ email, password });
  if (error) throw new Error(traducir(error.message));
  return !data.session; // true = falta confirmar el correo
}

export async function salir() {
  if (cliente) await cliente.auth.signOut();
}

function traducir(msg) {
  if (/Invalid login/i.test(msg)) return 'Correo o contraseña incorrectos';
  if (/Email not confirmed/i.test(msg)) return 'Falta confirmar tu correo (revisa tu bandeja)';
  if (/already registered/i.test(msg)) return 'Ese correo ya tiene cuenta: usa "Entrar"';
  if (/Password should be/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres';
  return msg;
}

export async function sincronizar() {
  if (!cliente || !usuario || !getState()) return;
  if (enCurso) {
    pendiente = true;
    return;
  }
  if (!navigator.onLine) {
    set('sin-red');
    return;
  }
  enCurso = true;
  set('sincronizando');
  try {
    const st = getState();
    // 1) Subir movimientos modificados en este dispositivo
    const ids = [...st.sync.dirty];
    const filas = ids
      .map((id) => st.movimientos[id])
      .filter(Boolean)
      .map((m) => ({ id: m.id, user_id: usuario.id, data: m, updated_at: m.updatedAt, deleted: !!m.deleted }));
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await cliente.from('movimientos').upsert(filas.slice(i, i + 200));
      if (error) throw error;
    }
    const subidos = new Map(filas.map((f) => [f.id, f.updated_at]));

    // 2) Bajar cambios hechos en otros dispositivos
    const nuevos = [];
    let desde = st.sync.lastPull;
    for (;;) {
      let q = cliente.from('movimientos').select('id,data,updated_at,deleted,server_updated').order('server_updated', { ascending: true }).limit(500);
      if (desde) q = q.gte('server_updated', desde);
      const { data, error } = await q;
      if (error) throw error;
      const frescos = data.filter((r) => !nuevos.some((n) => n.id === r.id && n.server_updated === r.server_updated));
      nuevos.push(...frescos);
      if (data.length < 500 || !frescos.length) break;
      desde = data[data.length - 1].server_updated;
    }

    // 3) Configuración (gana la versión más reciente)
    const { data: filaCfg, error: errCfg } = await cliente.from('config').select('data,updated_at').maybeSingle();
    if (errCfg) throw errCfg;
    let cfgRemota = null;
    const cfgSubida = st.config.updatedAt;
    if (filaCfg && filaCfg.updated_at > (st.config.updatedAt || 0)) {
      cfgRemota = filaCfg.data;
    } else if (!st.config.vacia && (!filaCfg || st.sync.configDirty)) {
      const { error } = await cliente.from('config').upsert({ user_id: usuario.id, data: st.config, updated_at: st.config.updatedAt });
      if (error) throw error;
    }

    aplicarRemoto((s) => {
      s.sync.dirty = s.sync.dirty.filter((id) => !subidos.has(id) || (s.movimientos[id] && s.movimientos[id].updatedAt !== subidos.get(id)));
      for (const r of nuevos) {
        const local = s.movimientos[r.id];
        if (!local || r.updated_at > (local.updatedAt || 0)) s.movimientos[r.id] = { ...r.data, deleted: r.deleted, updatedAt: r.updated_at };
      }
      if (nuevos.length) s.sync.lastPull = nuevos[nuevos.length - 1].server_updated;
      if (cfgRemota && !(s.sync.configDirty && s.config.updatedAt !== cfgSubida)) {
        s.config = migrar(cfgRemota);
        s.sync.configDirty = false;
      } else if (s.config.updatedAt === cfgSubida) {
        s.sync.configDirty = false;
      }
      s.sync.ultima = Date.now();
    });
    set('listo');
  } catch (e) {
    set('error', e.message || String(e));
  } finally {
    enCurso = false;
    if (pendiente) {
      pendiente = false;
      programar(300);
    }
  }
}
