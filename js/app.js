import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { Toasts, toast } from './ui.js';
import { cargar, hayDatos, getState, subscribe, movimientos, iniciarCon, iniciarVacio } from './store.js';
import { iniciarSync, infoSync, onSync, sincronizar } from './sync.js';
import { configVacia } from './defaults.js';
import { nombreMes, ymActual } from './fechas.js';
import { Inicio } from './pantallas/inicio.js';
import { Movimientos } from './pantallas/movimientos.js';
import { Plan } from './pantallas/plan.js';
import { Registrar, EditarMov } from './pantallas/registrar.js';
import { Mas, Tarjetas, Ahorro, Sueldo, Fijos, Ocio, Escenarios, Recordatorios, Cuenta, Respaldo, textoSync } from './pantallas/ajustes.js';

const leerRuta = () => (location.hash || '#inicio').slice(1);
const SECCION = { inicio: 'inicio', movs: 'movs', plan: 'plan', meses: 'plan' };

function Bienvenida() {
  const importar = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        const d = JSON.parse(t);
        if (!d.config) throw new Error();
        iniciarCon(d);
      } catch (err) {
        toast('Ese archivo no es válido');
      }
    });
  };
  return html`<div class="bienvenida">
    <div class="logo-grande">💸</div>
    <h1>Mis finanzas</h1>
    <p class="muted">Control diario de gastos y proyección a 7 años.</p>
    <label class="btn btn-primario btn-ancho">📂 Cargar mis datos iniciales<input type="file" accept=".json,application/json" hidden onChange=${importar} /></label>
    <button class="btn btn-ancho" onClick=${() => { iniciarVacio(configVacia()); location.hash = '#cuenta'; sincronizar(); }}>☁️ Ya la uso en otro dispositivo</button>
    <button class="btn btn-ancho btn-texto" onClick=${() => iniciarCon({ config: configVacia() })}>Empezar desde cero</button>
  </div>`;
}

function IndicadorSync() {
  const [s, setS] = useState(infoSync());
  useEffect(() => onSync(setS), []);
  const clase = { listo: 'ok', sincronizando: 'trabajando', error: 'mal', 'sin-red': 'mal', 'sin-sesion': 'apagado', 'no-configurado': 'apagado' }[s.estado];
  return html`<a href="#cuenta" class=${'sync ' + clase} title=${textoSync(s)} aria-label=${textoSync(s)}><i></i><span>${textoSync(s)}</span></a>`;
}

function App() {
  const [, setV] = useState(0);
  const [ruta, setRuta] = useState(leerRuta());
  const [registro, setRegistro] = useState(null);
  const [editando, setEditando] = useState(null);

  useEffect(() => subscribe(() => setV((v) => v + 1)), []);
  useEffect(() => {
    const f = () => {
      setRuta(leerRuta());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    const k = (e) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !/input|select|textarea/i.test(document.activeElement.tagName) && hayDatos()) setRegistro({});
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('hashchange', f);
      window.removeEventListener('keydown', k);
    };
  }, []);

  if (!hayDatos()) return html`<${Bienvenida} /><${Toasts} />`;

  const config = getState().config;
  const movs = movimientos();
  const ir = (r) => (location.hash = '#' + r);
  const abrirRegistro = (prellenado) => setRegistro(prellenado || {});
  const props = { config, movs, ir, ruta, abrirRegistro, editar: setEditando };
  const pantallas = { inicio: Inicio, movs: Movimientos, plan: Plan, meses: Plan, mas: Mas, tarjetas: Tarjetas, ahorro: Ahorro, sueldo: Sueldo, fijos: Fijos, ocio: Ocio, escenarios: Escenarios, recordatorios: Recordatorios, cuenta: Cuenta, respaldo: Respaldo };
  const P = pantallas[ruta] || Inicio;
  const seccion = SECCION[ruta] || (pantallas[ruta] ? 'mas' : 'inicio');

  const tab = (id, ico, txt) => html`<a href=${'#' + id} class=${'tab' + (seccion === (SECCION[id] || id) ? ' activo' : '')} aria-current=${seccion === (SECCION[id] || id) ? 'page' : undefined}><span class="tab-ico">${ico}</span><span>${txt}</span></a>`;

  return html`<div class="app">
    <header class="cabecera">
      <div><span class="marca">Mis finanzas</span><span class="cab-mes">${nombreMes(ymActual(), true)}</span></div>
      <${IndicadorSync} />
    </header>
    <main><${P} ...${props} /></main>
    <nav class="tabs" aria-label="Secciones">
      ${tab('inicio', '🏠', 'Inicio')}
      ${tab('movs', '🧾', 'Movimientos')}
      <button class="tab-mas" aria-label="Registrar movimiento" onClick=${() => abrirRegistro()}>+</button>
      ${tab('meses', '📈', 'Plan')}
      ${tab('mas', '⚙️', 'Más')}
    </nav>
    ${registro && html`<${Registrar} config=${config} prellenado=${registro.categoria ? registro : null} onCerrar=${() => setRegistro(null)} />`}
    ${editando && html`<${EditarMov} config=${config} mov=${editando} onCerrar=${() => setEditando(null)} />`}
    <${Toasts} />
  </div>`;
}

async function main() {
  cargar();
  if (!hayDatos()) {
    try {
      const r = await fetch('datos/mis-datos.json', { cache: 'no-store' });
      if (r.ok) iniciarCon(await r.json());
    } catch (e) {
      /* sin archivo de datos: se muestra la bienvenida */
    }
  }
  render(html`<${App} />`, document.getElementById('app'));
  iniciarSync();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main();
