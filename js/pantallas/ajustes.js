import { html, useState, useEffect, Tarjeta, Campo, Num, toast, descargar } from '../ui.js';
import { editarConfig, exportar, iniciarCon, movimientos as listaMovs, getState } from '../store.js';
import { saldoTarjeta, proximaFecha, mesDeCierreSugerido, catalogo, nombreCuenta, pendientesSugeridos } from '../calculos.js';
import { saldosActuales } from '../proyeccion.js';
import { infoSync, onSync, entrar, registrarse, salir, sincronizar, guardarCredenciales } from '../sync.js';
import { dinero, nombreMes, MESES_LARGOS, uid, fechaCorta, hoyIso, addMonths } from '../fechas.js';
import { generarIcs } from '../recordatorios.js';

const MESES_OPC = MESES_LARGOS.map((m, i) => html`<option value=${i + 1}>${m}</option>`);
const n0 = (v) => (v == null ? 0 : v);

export function Mas({ ir }) {
  const [s, setS] = useState(infoSync());
  useEffect(() => onSync(setS), []);
  const items = [
    ['tarjetas', '💳', 'Tarjetas y deudas', 'Fechas de corte y pago, saldos'],
    ['ahorro', '🏦', 'Ahorros y metas', 'Saldos de tus cuentas y cierre de mes'],
    ['sueldo', '💼', 'Sueldo y bonos', 'Aumentos, PTU, aguinaldo, prima'],
    ['fijos', '🏠', 'Gastos fijos', 'Renta, doctorado, servicios, suscripciones'],
    ['ocio', '🍽️', 'Presupuestos', 'Ocio y gasolina: monto, forma de pago y categorías'],
    ['escenarios', '📈', 'Escenarios', 'Aumento, inflación, rendimientos'],
    ['recordatorios', '⏰', 'Recordatorios', 'Avisos en tu calendario'],
    ['cuenta', '☁️', 'Cuenta y sincronización', textoSync(s)],
    ['respaldo', '💾', 'Respaldo', 'Exportar o importar tus datos'],
  ];
  return html`<div class="pantalla">
    <h2 class="titulo-pant">Más</h2>
    <ul class="lista menu">
      ${items.map(([r, ico, t, sub]) => html`<li><button class="fila fila-btn" onClick=${() => ir(r)}>
        <span class="ico-circ">${ico}</span><span class="fila-txt"><span class="fila-tit">${t}</span><span class="fila-sub">${sub}</span></span><span class="chev">›</span>
      </button></li>`)}
    </ul>
  </div>`;
}

export function textoSync(s) {
  return {
    'no-configurado': 'Solo en este dispositivo',
    'sin-sesion': 'Inicia sesión para sincronizar',
    sincronizando: 'Sincronizando…',
    listo: 'Sincronizado',
    error: 'Error al sincronizar',
    'sin-red': 'Sin conexión (se sincroniza al volver)',
  }[s.estado];
}

function Sub({ titulo, ir, children }) {
  return html`<div class="pantalla">
    <button class="volver" onClick=${() => ir('mas')}>‹ Más</button>
    <h2 class="titulo-pant">${titulo}</h2>
    ${children}
  </div>`;
}

// ---------- Tarjetas ----------
export function Tarjetas({ config, movs, ir }) {
  const [nueva, setNueva] = useState('');
  return html`<${Sub} titulo="Tarjetas y deudas" ir=${ir}>
    <p class="muted">Meta: <strong>cero deudas y cero MSI desde enero 2027</strong>. Las compras con tarjeta cuentan como gasto el día que las haces. Cuando pagues la tarjeta, regístralo con <strong>+ → Pagar tarjeta</strong>.</p>
    ${config.tarjetas.map((tj) => {
      const s = saldoTarjeta(config, movs, tj.id);
      const prox = proximaFecha(tj.pago);
      const todas = config.deudas.filter((d) => d.tarjeta === tj.id);
      const upd = (fn) => editarConfig((c) => fn(c.tarjetas.find((x) => x.id === tj.id)));
      return html`<${Tarjeta} titulo=${'💳 ' + tj.nombre} accion=${html`<strong class=${s.saldo > 0 ? 'neg' : 'pos'}>${dinero(s.saldo)}</strong>`}>
        <div class="dos-col">
          <${Campo} etiqueta="Día de corte"><${Num} valor=${tj.corte} min="1" onCambio=${(v) => upd((x) => { x.corte = v; })} placeholder="—" /><//>
          <${Campo} etiqueta="Día límite de pago"><${Num} valor=${tj.pago} min="1" onCambio=${(v) => upd((x) => { x.pago = v; })} placeholder="—" /><//>
        </div>
        ${prox && s.saldo > 0 && html`<p class="muted chico">Próximo pago: ${fechaCorta(prox.iso)} (en ${prox.dias} días)</p>`}
        ${s.compras > 0 && html`<p class="muted chico">Compras registradas: ${dinero(s.compras)} · Pagos: ${dinero(s.pagos)}</p>`}
        ${todas.length > 0 && html`<h4 class="sub">Deudas a liquidar</h4>
          <ul class="lista lista-compacta">
            ${todas.map((d) => html`<li class="fila">
              <label class="check"><input type="checkbox" checked=${d.pagada} onChange=${(e) => editarConfig((c) => { c.deudas.find((x) => x.id === d.id).pagada = e.target.checked; })} />
                <span class=${'fila-txt ' + (d.pagada ? 'tachado' : '')}><span class="fila-tit">${d.concepto}</span><span class="fila-sub">${nombreMes(d.mes, true)}</span></span></label>
              <span class="fila-monto">${dinero(d.monto)}</span>
              <button class="icono-btn chico" aria-label="Quitar deuda" onClick=${() => editarConfig((c) => { c.deudas = c.deudas.filter((x) => x.id !== d.id); })}>✕</button>
            </li>`)}
          </ul>`}
        <${NuevaDeuda} tarjeta=${tj.id} />
        <button class="enlace peligro" onClick=${() => confirm(`¿Quitar la tarjeta ${tj.nombre}?`) && editarConfig((c) => { c.tarjetas = c.tarjetas.filter((x) => x.id !== tj.id); c.deudas = c.deudas.filter((x) => x.tarjeta !== tj.id); })}>Quitar tarjeta</button>
      <//>`;
    })}
    <${Tarjeta} titulo="Agregar tarjeta">
      <div class="fila-form">
        <input placeholder="Nombre (ej. Klar)" value=${nueva} onInput=${(e) => setNueva(e.target.value)} />
        <button class="btn" disabled=${!nueva.trim()} onClick=${() => { editarConfig((c) => c.tarjetas.push({ id: 't-' + uid().slice(0, 8), nombre: nueva.trim() })); setNueva(''); }}>Agregar</button>
      </div>
    <//>
  <//>`;
}

function NuevaDeuda({ tarjeta }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ mes: hoyIso().slice(0, 7), monto: null, concepto: '' });
  if (!abierto) return html`<button class="enlace" onClick=${() => setAbierto(true)}>+ Agregar deuda o MSI a liquidar</button>`;
  return html`<div class="form-mini">
    <div class="dos-col">
      <${Campo} etiqueta="Mes en que la pagas"><input type="month" value=${d.mes} onInput=${(e) => setD({ ...d, mes: e.target.value })} /><//>
      <${Campo} etiqueta="Monto"><${Num} valor=${d.monto} onCambio=${(v) => setD({ ...d, monto: v })} /><//>
    </div>
    <${Campo} etiqueta="Concepto"><input value=${d.concepto} placeholder="Ej. MSI pantalla" onInput=${(e) => setD({ ...d, concepto: e.target.value })} /><//>
    <div class="acciones">
      <button class="btn" onClick=${() => setAbierto(false)}>Cancelar</button>
      <button class="btn btn-primario" disabled=${!d.monto || !d.mes} onClick=${() => {
        editarConfig((c) => c.deudas.push({ id: 'd-' + uid().slice(0, 8), tarjeta, mes: d.mes, monto: d.monto, concepto: d.concepto || 'Pago' }));
        setAbierto(false);
        setD({ mes: d.mes, monto: null, concepto: '' });
      }}>Guardar</button>
    </div>
  </div>`;
}

// ---------- Ahorro y metas ----------
export function Ahorro({ config, movs, ir }) {
  const [mes, setMes] = useState(mesDeCierreSugerido());
  const [saldos, setSaldos] = useState(() => Object.fromEntries(config.ahorro.cuentas.map((c) => [c.id, c.saldo])));
  const mismoCorte = mes === config.ahorro.fechaCorte;
  const [pend, setPend] = useState(() => (mismoCorte ? config.ahorro.pendientes || [] : pendientesSugeridos(config, movs, mes)));
  const [porPagar, setPorPagar] = useState(() => (mismoCorte ? config.ahorro.tarjetasPorPagar || 0 : 0));
  useEffect(() => setSaldos(Object.fromEntries(config.ahorro.cuentas.map((c) => [c.id, c.saldo]))), [config.ahorro.cuentas.length]);
  const total = config.ahorro.cuentas.reduce((a, c) => a + (c.destino === 'retiro' ? 0 : n0(saldos[c.id])), 0);
  const totPend = pend.reduce((a, p) => a + n0(p.monto), 0);
  const hist = Object.entries(config.ahorro.historial || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const updC = (id, fn) => editarConfig((c) => fn(c.ahorro.cuentas.find((x) => x.id === id)));
  const cambiarMes = (v) => {
    setMes(v);
    const igual = v === config.ahorro.fechaCorte;
    setPend(igual ? config.ahorro.pendientes || [] : pendientesSugeridos(config, movs, v));
    setPorPagar(igual ? config.ahorro.tarjetasPorPagar || 0 : 0);
  };

  const guardarCierre = () => {
    editarConfig((c) => {
      for (const cu of c.ahorro.cuentas) cu.saldo = n0(saldos[cu.id]);
      c.ahorro.pendientes = pend.filter((p) => n0(p.monto) > 0).map((p) => ({ nombre: p.nombre || 'Pendiente', monto: n0(p.monto) }));
      c.ahorro.tarjetasPorPagar = n0(porPagar);
      c.ahorro.fechaCorte = mes;
      const s = saldosActuales(c);
      c.ahorro.historial = { ...(c.ahorro.historial || {}), [mes]: { general: s.general - totPend, retiro: s.retiro } };
    });
    toast(`Cierre de ${nombreMes(mes, true)} guardado`);
  };

  return html`<${Sub} titulo="Ahorros y metas" ir=${ir}>
    <${Tarjeta} titulo="Cierre de mes">
      <p class="muted chico">Anota cuánto tienes hoy en cada cuenta y lo que todavía te falta pagar este mes. La proyección arranca desde aquí.</p>
      <${Campo} etiqueta="Saldos al cierre de"><input type="month" value=${mes} onInput=${(e) => e.target.value && cambiarMes(e.target.value)} /><//>
      ${config.ahorro.cuentas.map((cu) => html`<div class="cuenta-fila">
        <span class="cuenta-nom">${cu.nombre}${cu.destino === 'retiro' ? html` <span class="etq">retiro</span>` : ''}</span>
        <${Num} valor=${saldos[cu.id]} onCambio=${(v) => setSaldos({ ...saldos, [cu.id]: v })} />
      </div>`)}
      <p class="total-linea">En tus cuentas: <strong>${dinero(total)}</strong></p>

      <h4 class="sub">Lo que todavía falta pagar en ${nombreMes(mes, true)}</h4>
      ${pend.map((p, i) => html`<div class="fila-form">
        <input value=${p.nombre} aria-label="Concepto" onInput=${(e) => setPend(pend.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
        <input class="monto-input" type="number" inputmode="decimal" value=${p.monto ?? ''} aria-label="Monto" onInput=${(e) => setPend(pend.map((x, j) => (j === i ? { ...x, monto: e.target.value === '' ? null : Number(e.target.value) } : x)))} />
        <button class="icono-btn chico" aria-label="Quitar" onClick=${() => setPend(pend.filter((_, j) => j !== i))}>✕</button>
      </div>`)}
      <button class="enlace" onClick=${() => setPend([...pend, { nombre: '', monto: null }])}>+ Agregar pendiente</button>

      <${Campo} etiqueta=${'Tarjetas: lo que pagarás en ' + nombreMes(addMonths(mes, 1), true) + ' por tus compras de ' + nombreMes(mes, true)}
        ayuda="Si las deudas del próximo mes ya incluyen tus compras, déjalo en 0.">
        <${Num} valor=${porPagar} onCambio=${setPorPagar} />
      <//>
      <p class="total-linea">Arrancas ${nombreMes(addMonths(mes, 1), true)} con: <strong>${dinero(total - totPend)}</strong></p>
      <button class="btn btn-primario btn-ancho" onClick=${guardarCierre}>Guardar cierre de ${nombreMes(mes, true)}</button>
    <//>

    <${Tarjeta} titulo="Metas">
      <div class="dos-col">
        <${Campo} etiqueta="Fondo de emergencia"><${Num} valor=${config.metas.fondo} onCambio=${(v) => editarConfig((c) => { c.metas.fondo = n0(v); })} /><//>
        <${Campo} etiqueta="Enganche de casa"><${Num} valor=${config.metas.enganche} onCambio=${(v) => editarConfig((c) => { c.metas.enganche = n0(v); })} /><//>
      </div>
      <${Campo} etiqueta="Porcentaje del sueldo para retiro" ayuda="Entre 5 y 10% es lo que planeaste"><${Num} valor=${config.ahorro.retiroPct} onCambio=${(v) => editarConfig((c) => { c.ahorro.retiroPct = n0(v); })} /><//>
      <p class="muted chico">El ahorro llena primero el fondo de emergencia y lo que sobra va al enganche.</p>
    <//>

    <${Tarjeta} titulo="Cuentas">
      ${config.ahorro.cuentas.map((cu) => html`<div class="form-mini">
        <div class="dos-col">
          <${Campo} etiqueta="Nombre"><input value=${cu.nombre} onChange=${(e) => updC(cu.id, (x) => { x.nombre = e.target.value; })} /><//>
          <${Campo} etiqueta="Rendimiento anual %"><${Num} valor=${cu.tasa} onCambio=${(v) => updC(cu.id, (x) => { x.tasa = n0(v); })} /><//>
        </div>
        <div class="fila-form">
          <select value=${cu.destino} onChange=${(e) => updC(cu.id, (x) => { x.destino = e.target.value; })}>
            <option value="general">Fondo / enganche</option>
            <option value="retiro">Retiro</option>
          </select>
          <button class="enlace peligro" onClick=${() => confirm(`¿Quitar ${cu.nombre}?`) && editarConfig((c) => { c.ahorro.cuentas = c.ahorro.cuentas.filter((x) => x.id !== cu.id); })}>Quitar</button>
        </div>
      </div>`)}
      <button class="enlace" onClick=${() => editarConfig((c) => c.ahorro.cuentas.push({ id: 'a-' + uid().slice(0, 8), nombre: 'Nueva cuenta', saldo: 0, tasa: 8, destino: 'general' }))}>+ Agregar cuenta</button>
    <//>

    ${hist.length > 0 && html`<${Tarjeta} titulo="Historial de cierres">
      <table class="tabla"><thead><tr><th>Mes</th><th>Ahorro</th><th>Retiro</th></tr></thead>
      <tbody>${hist.map(([k, v]) => html`<tr><td>${nombreMes(k, true)}</td><td class="num">${dinero(v.general)}</td><td class="num">${dinero(v.retiro)}</td></tr>`)}</tbody></table>
    <//>`}
  <//>`;
}

// ---------- Sueldo y bonos ----------
function textoExcepciones(obj) {
  return Object.entries(obj || {}).map(([k, v]) => `${k}=${v}`).join(', ');
}
function leerExcepciones(txt) {
  const out = {};
  for (const p of txt.split(',')) {
    const [k, v] = p.split('=').map((x) => (x || '').trim());
    if (k && v && !isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
}

export function Sueldo({ config, ir }) {
  const updB = (id, fn) => editarConfig((c) => fn(c.bonos.find((x) => x.id === id)));
  return html`<${Sub} titulo="Sueldo y bonos" ir=${ir}>
    <${Tarjeta} titulo="Sueldo">
      <div class="dos-col">
        <${Campo} etiqueta="Sueldo neto mensual"><${Num} valor=${config.sueldo.neto} onCambio=${(v) => editarConfig((c) => { c.sueldo.neto = n0(v); })} /><//>
        <${Campo} etiqueta="Mes del aumento"><select value=${config.sueldo.mesAumento} onChange=${(e) => editarConfig((c) => { c.sueldo.mesAumento = Number(e.target.value); })}>${MESES_OPC}</select><//>
      </div>
      <${Campo} etiqueta="Vigente desde" ayuda="Si te suben el sueldo (o te ascienden), cambia el monto y esta fecha"><input type="month" value=${config.sueldo.base} onChange=${(e) => editarConfig((c) => { c.sueldo.base = e.target.value; })} /><//>
      <p class="muted chico">Quincena: ${dinero(config.sueldo.neto / 2)}. El porcentaje de aumento anual depende del escenario (3% a 6%).</p>
    <//>
    ${config.bonos.map((b) => html`<${Tarjeta} titulo=${'🎁 ' + b.nombre}>
      <${Campo} etiqueta="Nombre"><input value=${b.nombre} onChange=${(e) => updB(b.id, (x) => { x.nombre = e.target.value; })} /><//>
      <div class="dos-col">
        <${Campo} etiqueta="Mes en que llega"><select value=${b.mes} onChange=${(e) => updB(b.id, (x) => { x.mes = Number(e.target.value); })}>${MESES_OPC}</select><//>
        <${Campo} etiqueta="Días de sueldo" ayuda="Si se calcula por días; si no, déjalo vacío"><${Num} valor=${b.dias} placeholder="—" onCambio=${(v) => updB(b.id, (x) => { x.dias = v || undefined; })} /><//>
      </div>
      ${!b.dias && html`<${Campo} etiqueta=${'Monto en ' + b.anioBase}><${Num} valor=${b.monto} onCambio=${(v) => updB(b.id, (x) => { x.monto = n0(v); })} /><//>`}
      ${b.dias && html`<p class="muted chico">Equivale a ${dinero((config.sueldo.neto / 30) * b.dias)} con tu sueldo actual, y sube con cada aumento.</p>`}
      <div class="dos-col">
        <${Campo} etiqueta="Año de referencia"><${Num} valor=${b.anioBase} onCambio=${(v) => updB(b.id, (x) => { x.anioBase = n0(v); })} /><//>
        <${Campo} etiqueta="Empieza en"><input type="month" value=${b.desde || ''} onChange=${(e) => updB(b.id, (x) => { x.desde = e.target.value; })} /><//>
      </div>
      <label class="interruptor"><input type="checkbox" checked=${b.crece} onChange=${(e) => updB(b.id, (x) => { x.crece = e.target.checked; })} /><span>Crece con el aumento de sueldo</span></label>
      <label class="interruptor"><input type="checkbox" checked=${b.seguro} onChange=${(e) => updB(b.id, (x) => { x.seguro = e.target.checked; })} /><span>Es seguro (si no, solo cuenta cuando activas "ingresos no seguros")</span></label>
      <${Campo} etiqueta="Montos específicos por año" ayuda="Formato: 2026=62500, 2028=180000"><input value=${textoExcepciones(b.montosPorAnio)} onChange=${(e) => updB(b.id, (x) => { x.montosPorAnio = leerExcepciones(e.target.value); })} /><//>
      ${b.nota && html`<p class="muted chico">📝 ${b.nota}</p>`}
      <button class="enlace peligro" onClick=${() => confirm(`¿Quitar ${b.nombre}?`) && editarConfig((c) => { c.bonos = c.bonos.filter((x) => x.id !== b.id); })}>Quitar bono</button>
    <//>`)}
    <button class="btn btn-ancho" onClick=${() => editarConfig((c) => c.bonos.push({ id: 'b-' + uid().slice(0, 8), nombre: 'Nuevo bono', mes: 6, monto: 0, anioBase: new Date().getFullYear() + 1, crece: false, seguro: true, desde: hoyIso().slice(0, 7) }))}>+ Agregar bono</button>
  <//>`;
}

// ---------- Gastos fijos ----------
const AJUSTES = [
  ['ninguno', 'Monto fijo'],
  ['inflacion', 'Sube con la inflación (cada enero)'],
  ['escalon', 'Sube una cantidad fija cada año'],
  ['porcentaje', 'Sube un % fijo cada año'],
  ['colegiatura', 'Colegiatura (% según escenario)'],
];

export function Fijos({ config, ir }) {
  const updF = (id, fn) => editarConfig((c) => fn(c.fijos.find((x) => x.id === id)));
  return html`<${Sub} titulo="Gastos fijos" ir=${ir}>
    <p class="muted">Si un mes pagas distinto (p. ej. la colegiatura subió), regístralo con el monto real: la app usa el mayor entre lo planeado y lo pagado. Para cambiar el plan de un mes específico usa “montos por mes”.</p>
    ${config.fijos.map((f) => {
      const a = f.ajuste || { tipo: 'ninguno' };
      return html`<${Tarjeta} titulo=${(f.icono || '📌') + ' ' + f.nombre}>
        <div class="dos-col">
          <${Campo} etiqueta="Nombre"><input value=${f.nombre} onChange=${(e) => updF(f.id, (x) => { x.nombre = e.target.value; })} /><//>
          <${Campo} etiqueta="Ícono"><input value=${f.icono || ''} maxlength="4" onChange=${(e) => updF(f.id, (x) => { x.icono = e.target.value; })} /><//>
        </div>
        <${Campo} etiqueta="¿Cómo se paga?"><select value=${f.pago || 'debito'} onChange=${(e) => updF(f.id, (x) => { x.pago = e.target.value; })}>
          <option value="debito">De mi cuenta (sale el mismo mes)</option>
          <option value="tarjeta">Con tarjeta (lo pago el mes siguiente)</option></select><//>
        <div class="dos-col">
          <${Campo} etiqueta="Monto"><${Num} valor=${f.monto} onCambio=${(v) => updF(f.id, (x) => { x.monto = n0(v); })} /><//>
          <${Campo} etiqueta="Frecuencia"><select value=${f.frecuencia} onChange=${(e) => updF(f.id, (x) => { x.frecuencia = e.target.value; if (!x.mes) x.mes = 1; })}>
            <option value="mensual">Mensual</option><option value="anual">Una vez al año</option></select><//>
        </div>
        <div class="dos-col">
          ${f.frecuencia === 'anual'
            ? html`<${Campo} etiqueta="Mes de pago"><select value=${f.mes} onChange=${(e) => updF(f.id, (x) => { x.mes = Number(e.target.value); })}>${MESES_OPC}</select><//>`
            : html`<${Campo} etiqueta="Día de pago"><${Num} valor=${f.dia} min="1" placeholder="—" onCambio=${(v) => updF(f.id, (x) => { x.dia = v; })} /><//>`}
          <${Campo} etiqueta="Termina en (opcional)"><input type="month" value=${f.hasta || ''} onChange=${(e) => updF(f.id, (x) => { x.hasta = e.target.value || undefined; })} /><//>
        </div>
        <${Campo} etiqueta="¿Cómo cambia con los años?"><select value=${a.tipo} onChange=${(e) => updF(f.id, (x) => { x.ajuste = { ...(x.ajuste || {}), tipo: e.target.value }; if (!x.base) x.base = hoyIso().slice(0, 7); })}>
          ${AJUSTES.map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select><//>
        ${(a.tipo === 'escalon' || a.tipo === 'porcentaje' || a.tipo === 'colegiatura') && html`<div class="dos-col">
          ${a.tipo !== 'colegiatura' && html`<${Campo} etiqueta=${a.tipo === 'escalon' ? 'Cuánto sube ($)' : 'Cuánto sube (%)'}><${Num} valor=${a.valor} onCambio=${(v) => updF(f.id, (x) => { x.ajuste.valor = n0(v); })} /><//>`}
          <${Campo} etiqueta="Mes en que sube"><select value=${a.mes || 1} onChange=${(e) => updF(f.id, (x) => { x.ajuste.mes = Number(e.target.value); })}>${MESES_OPC}</select><//>
        </div>`}
        <${Campo} etiqueta="Montos por mes (excepciones)" ayuda="Formato: 2026-12=8850, 2027-01=8950"><input value=${textoExcepciones(f.overrides)} onChange=${(e) => updF(f.id, (x) => { x.overrides = leerExcepciones(e.target.value); })} /><//>
        <button class="enlace peligro" onClick=${() => confirm(`¿Quitar ${f.nombre}?`) && editarConfig((c) => { c.fijos = c.fijos.filter((x) => x.id !== f.id); })}>Quitar gasto</button>
      <//>`;
    })}
    <button class="btn btn-ancho" onClick=${() => editarConfig((c) => c.fijos.push({ id: 'f-' + uid().slice(0, 8), nombre: 'Nuevo gasto', icono: '📌', monto: 0, frecuencia: 'mensual', base: hoyIso().slice(0, 7), desde: hoyIso().slice(0, 7), ajuste: { tipo: 'ninguno' } }))}>+ Agregar gasto fijo</button>
  <//>`;
}

// ---------- Presupuestos ----------
export function Ocio({ config, ir }) {
  const [nueva, setNueva] = useState({});
  const upd = (id, fn) => editarConfig((c) => fn(c.presupuestos.find((x) => x.id === id)));
  return html`<${Sub} titulo="Presupuestos" ir=${ir}>
    <p class="muted">Un presupuesto es lo que te das permiso de gastar cada mes en algo variable. Si lo pagas con tarjeta, la app lo cobra en tu flujo del mes siguiente.</p>
    ${config.presupuestos.map((p) => {
      const n = nueva[p.id] || { nombre: '', icono: '' };
      return html`<${Tarjeta} titulo=${p.nombre}>
        <div class="dos-col">
          <${Campo} etiqueta="Nombre"><input value=${p.nombre} onChange=${(e) => upd(p.id, (x) => { x.nombre = e.target.value; })} /><//>
          <${Campo} etiqueta="Monto mensual"><${Num} valor=${p.monto} onCambio=${(v) => upd(p.id, (x) => { x.monto = n0(v); x.base = hoyIso().slice(0, 7); })} /><//>
        </div>
        <${Campo} etiqueta="¿Cómo se paga?"><select value=${p.pago || 'debito'} onChange=${(e) => upd(p.id, (x) => { x.pago = e.target.value; })}>
          <option value="tarjeta">Con tarjeta (lo pago el mes siguiente)</option>
          <option value="debito">De mi cuenta (sale el mismo mes)</option></select><//>
        <label class="interruptor"><input type="checkbox" checked=${p.crece} onChange=${(e) => upd(p.id, (x) => { x.crece = e.target.checked; })} /><span>Ajustar con la inflación cada enero</span></label>
        <h4 class="sub">Categorías</h4>
        <ul class="lista lista-compacta">
          ${p.categorias.map((cat) => html`<li class="fila">
            <input class="ico-input" value=${cat.icono} maxlength="4" aria-label="Ícono" onChange=${(e) => upd(p.id, (x) => { x.categorias.find((k) => k.id === cat.id).icono = e.target.value; })} />
            <input class="fila-txt" value=${cat.nombre} aria-label="Nombre" onChange=${(e) => upd(p.id, (x) => { x.categorias.find((k) => k.id === cat.id).nombre = e.target.value; })} />
            <button class="icono-btn chico" aria-label="Quitar" onClick=${() => confirm(`¿Quitar ${cat.nombre}? Los gastos ya registrados se conservan.`) && upd(p.id, (x) => { x.categorias = x.categorias.filter((k) => k.id !== cat.id); })}>✕</button>
          </li>`)}
        </ul>
        <div class="fila-form">
          <input class="ico-input" placeholder="🙂" maxlength="4" value=${n.icono} onInput=${(e) => setNueva({ ...nueva, [p.id]: { ...n, icono: e.target.value } })} />
          <input placeholder="Nueva categoría" value=${n.nombre} onInput=${(e) => setNueva({ ...nueva, [p.id]: { ...n, nombre: e.target.value } })} />
          <button class="btn" disabled=${!n.nombre.trim()} onClick=${() => { upd(p.id, (x) => x.categorias.push({ id: 'c-' + uid().slice(0, 8), nombre: n.nombre.trim(), icono: n.icono || '🏷️' })); setNueva({ ...nueva, [p.id]: { nombre: '', icono: '' } }); }}>Agregar</button>
        </div>
        ${config.presupuestos.length > 1 && html`<button class="enlace peligro" onClick=${() => confirm(`¿Quitar el presupuesto ${p.nombre}?`) && editarConfig((c) => { c.presupuestos = c.presupuestos.filter((x) => x.id !== p.id); })}>Quitar presupuesto</button>`}
      <//>`;
    })}
    <button class="btn btn-ancho" onClick=${() => editarConfig((c) => c.presupuestos.push({ id: 'p-' + uid().slice(0, 8), nombre: 'Nuevo presupuesto', monto: 0, pago: 'debito', crece: true, base: hoyIso().slice(0, 7), categorias: [] }))}>+ Agregar presupuesto</button>
  <//>`;
}

// ---------- Escenarios ----------
export function Escenarios({ config, ir }) {
  const campos = [['aumento', 'Aumento de sueldo %'], ['inflacion', 'Inflación de gastos %'], ['rendimiento', 'Rendimiento de ahorros %'], ['doctorado', 'Aumento de colegiatura %']];
  return html`<${Sub} titulo="Escenarios" ir=${ir}>
    <${Tarjeta}>
      <${Campo} etiqueta="Proyectar hasta"><input type="month" value=${config.horizonte} onChange=${(e) => e.target.value && editarConfig((c) => { c.horizonte = e.target.value; })} /><//>
    <//>
    ${Object.entries(config.escenarios).map(([k, e]) => html`<${Tarjeta} titulo=${e.nombre + (k === config.escenario ? ' (activo)' : '')}>
      <div class="dos-col">
        ${campos.map(([campo, etq]) => html`<${Campo} etiqueta=${etq}><${Num} valor=${e[campo]} onCambio=${(v) => editarConfig((c) => { c.escenarios[k][campo] = n0(v); })} /><//>`)}
      </div>
    <//>`)}
  <//>`;
}

// ---------- Recordatorios ----------
export function Recordatorios({ config, ir }) {
  const r = config.recordatorio || { hora: '21:30' };
  return html`<${Sub} titulo="Recordatorios" ir=${ir}>
    <${Tarjeta}>
      <${Campo} etiqueta="Hora del recordatorio diario"><input type="time" value=${r.hora} onChange=${(e) => editarConfig((c) => { c.recordatorio = { ...(c.recordatorio || {}), hora: e.target.value }; })} /><//>
      <p class="muted chico">Se agregan a tu Calendario del iPhone:</p>
      <ul class="viñetas">
        <li>Todos los días a las ${r.hora}: “Registra tus gastos del día”.</li>
        <li>El día 1 de cada mes: “Cierre de mes: actualiza tus saldos”.</li>
        <li>Dos días antes de la fecha límite de cada tarjeta que tenga día de pago.</li>
        <li>Los gastos fijos que tengan día de pago (renta, colegiatura).</li>
      </ul>
      <button class="btn btn-primario btn-ancho" onClick=${() => { descargar('recordatorios-finanzas.ics', generarIcs(config), 'text/calendar'); toast('Abre el archivo y elige “Agregar todo”'); }}>Agregar a mi calendario</button>
      <p class="muted chico">En el iPhone hazlo desde Safari. Si cambias fechas de pago, vuelve a descargarlo; antes borra el calendario anterior.</p>
    <//>
    <${Tarjeta} titulo="Dentro de la app">
      <p class="muted chico">Después de las 7 pm, si no has registrado nada ese día, el inicio te lo recuerda. Los primeros días de cada mes te pide el cierre de saldos.</p>
    <//>
  <//>`;
}

// ---------- Cuenta ----------
export function Cuenta({ ir }) {
  const [s, setS] = useState(infoSync());
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => onSync(setS), []);
  const ultima = (getState().sync || {}).ultima;

  const accion = async (fn) => {
    setOcupado(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(e.message);
    }
    setOcupado(false);
  };

  return html`<${Sub} titulo="Cuenta y sincronización" ir=${ir}>
    ${s.estado === 'no-configurado' && html`<${Tarjeta} titulo="Conectar con Supabase">
      <p class="muted chico">Ahora tus datos solo están en este dispositivo. Para tenerlos en tu iPhone y en tu computadora, conecta tu proyecto de Supabase (la guía de instalación explica cómo).</p>
      <${Campo} etiqueta="Project URL"><input value=${url} placeholder="https://xxxx.supabase.co" onInput=${(e) => setUrl(e.target.value)} /><//>
      <${Campo} etiqueta="Clave pública (anon / publishable)"><input value=${key} onInput=${(e) => setKey(e.target.value)} /><//>
      <button class="btn btn-primario btn-ancho" disabled=${!url || !key} onClick=${() => guardarCredenciales(url, key)}>Conectar</button>
    <//>`}
    ${s.estado !== 'no-configurado' && !s.usuario && html`<${Tarjeta} titulo="Iniciar sesión">
      <${Campo} etiqueta="Correo"><input type="email" autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} /><//>
      <${Campo} etiqueta="Contraseña"><input type="password" autocomplete="current-password" value=${pass} onInput=${(e) => setPass(e.target.value)} /><//>
      ${msg && html`<p class="nota-alerta">${msg}</p>`}
      <div class="acciones">
        <button class="btn" disabled=${ocupado || !email || !pass} onClick=${() => accion(async () => { const falta = await registrarse(email, pass); if (falta) setMsg('Te enviamos un correo para confirmar la cuenta. Confírmalo y luego toca “Entrar”.'); })}>Crear cuenta</button>
        <button class="btn btn-primario" disabled=${ocupado || !email || !pass} onClick=${() => accion(() => entrar(email, pass))}>Entrar</button>
      </div>
      <p class="muted chico">Crea la cuenta una sola vez (en la computadora). En el iPhone solo toca “Entrar” con el mismo correo y contraseña.</p>
    <//>`}
    ${s.usuario && html`<${Tarjeta} titulo="Sesión activa">
      <p>☁️ ${s.usuario.email}</p>
      <p class="muted chico">Estado: ${textoSync(s)}${s.ultimoError ? ` (${s.ultimoError})` : ''}${ultima ? ` · última vez ${new Date(ultima).toLocaleString('es-MX')}` : ''}</p>
      <div class="acciones">
        <button class="btn" onClick=${() => salir()}>Cerrar sesión</button>
        <button class="btn btn-primario" onClick=${() => sincronizar()}>Sincronizar ahora</button>
      </div>
    <//>`}
  <//>`;
}

// ---------- Respaldo ----------
export function Respaldo({ config, ir }) {
  const importar = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        const d = JSON.parse(txt);
        if (!d.config) throw new Error('Archivo no válido');
        if (confirm('Esto reemplaza los datos de este dispositivo por los del archivo. ¿Continuar?')) {
          iniciarCon({ ...d, config: { ...d.config, updatedAt: Date.now() } });
          toast('Datos importados');
        }
      } catch (err) {
        toast('No se pudo leer el archivo');
      }
    });
    e.target.value = '';
  };
  const csv = () => {
    const cat = catalogo(config);
    const filas = [['fecha', 'tipo', 'monto', 'categoria', 'forma_de_pago', 'nota']];
    for (const m of listaMovs()) filas.push([m.fecha, m.tipo, m.monto, m.tipo === 'pago' ? 'Pago de tarjeta' : (cat.get(m.categoria) || {}).nombre || '', nombreCuenta(config, m.cuenta), m.nota || '']);
    descargar(`movimientos-${hoyIso()}.csv`, '﻿' + filas.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  };
  return html`<${Sub} titulo="Respaldo" ir=${ir}>
    <${Tarjeta}>
      <button class="btn btn-ancho" onClick=${() => descargar(`finanzas-respaldo-${hoyIso()}.json`, JSON.stringify(exportar(), null, 2), 'application/json')}>Descargar respaldo completo (.json)</button>
      <button class="btn btn-ancho" onClick=${csv}>Exportar movimientos a Excel (.csv)</button>
      <label class="btn btn-ancho">Importar respaldo o datos iniciales<input type="file" accept="application/json,.json" hidden onChange=${importar} /></label>
    <//>
  <//>`;
}
