// Registro rápido: monto → categoría → forma de pago (se guarda solo).
import { html, useState, Hoja, Seg, Campo, toast } from '../ui.js';
import { agregarMov, editarMov, borrarMov, getState, movimientos } from '../store.js';
import { catalogo, cuentasPago, pagoSugerido, resumenMes } from '../calculos.js';
import { mesConsumo, mesDePagoAuto } from '../modelo.js';
import { dinero, hoyIso, fechaCorta, nombreMes, addMonths } from '../fechas.js';

const soloMes = (t) => nombreMes(t, true).split(' ')[0];

function ayer() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Registrar({ config, onCerrar, tipoInicial = 'gasto', prellenado }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [monto, setMonto] = useState(prellenado && prellenado.monto ? String(Math.round(prellenado.monto)) : '');
  const [paso, setPaso] = useState(prellenado && prellenado.categoria ? 3 : 1);
  const [categoria, setCategoria] = useState(prellenado ? prellenado.categoria : null);
  const [fecha, setFecha] = useState(hoyIso());
  const [nota, setNota] = useState('');
  const [pago, setPago] = useState('auto'); // 'auto' | 'AAAA-MM' (mes en que se paga la compra con tarjeta)
  const [otroMes, setOtroMes] = useState(false);
  const ultima = (getState().prefs || {}).ultimaCuenta;
  const sugerida = (categoria && pagoSugerido(config, categoria)) || ultima;

  const n = Number(monto) || 0;
  const tecla = (k) => {
    if (k === '⌫') return setMonto((m) => m.slice(0, -1));
    if (k === '.' && monto.includes('.')) return;
    if (monto.replace('.', '').length >= 8) return;
    setMonto((m) => (m === '0' && k !== '.' ? k : m + k));
  };

  // Mes en que se paga: el elegido, o el automático según el día de corte de la tarjeta.
  const mesPago = (cuenta) => (pago === 'auto' ? mesDePagoAuto(config, cuenta, fecha) : pago);

  const guardar = (cuenta) => {
    const tj = config.tarjetas.find((x) => x.id === cuenta);
    const pm = tipo === 'gasto' && tj ? mesPago(cuenta) : null;
    const normal = addMonths(fecha.slice(0, 7), 1);
    const mov = { tipo, monto: n, categoria: tipo === 'pago' ? null : categoria, cuenta, fecha, nota: nota.trim() || undefined };
    if (pm && pm !== normal) mov.pagoMes = pm;
    const id = agregarMov(mov);
    const cat = catalogo(config).get(categoria);
    let texto = tipo === 'pago' ? `Pago de ${dinero(n)} registrado` : `${dinero(n)} · ${cat ? cat.nombre : ''}`;
    if (tipo === 'gasto') {
      const t = mesConsumo(mov);
      const r = resumenMes(config, movimientos(), t);
      const pres = r.presupuestos.find((x) => config.presupuestos.find((p) => p.id === x.id && p.categorias.some((c) => c.id === categoria)));
      if (tj) texto += ` · se paga con ${tj.nombre} en ${soloMes(pm || normal)}`;
      if (pres) texto += ` · te quedan ${dinero(pres.restante)} para ${soloMes(t)}`;
    }
    toast(texto, { texto: 'Deshacer', fn: () => borrarMov(id) });
    onCerrar();
  };

  const cat = catalogo(config);
  const variables = config.presupuestos.flatMap((p) => p.categorias);
  const fijos = config.fijos;
  const ingresos = [...cat.values()].filter((c) => c.grupo === 'ingreso');

  const titulo = { gasto: 'Nuevo gasto', ingreso: 'Nuevo ingreso', pago: 'Pago de tarjeta' }[tipo];

  return html`<${Hoja} titulo=${titulo} onCerrar=${onCerrar} completa>
    ${paso === 1 &&
    html`<div class="registro">
      <${Seg} etiqueta="Tipo de movimiento" valor=${tipo} onCambio=${setTipo}
        opciones=${[{ valor: 'gasto', texto: 'Gasto' }, { valor: 'ingreso', texto: 'Ingreso' }, { valor: 'pago', texto: 'Pagar tarjeta' }]} />
      <div class="monto-grande" aria-live="polite"><span class="moneda">$</span>${monto ? Number(monto).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + (monto.endsWith('.') ? '.' : '') : '0'}</div>
      <div class="teclado">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(
          (k) => html`<button class="tecla" aria-label=${k === '⌫' ? 'Borrar' : k} onClick=${() => tecla(k)}>${k}</button>`
        )}
      </div>
      <button class="btn btn-primario btn-grande" disabled=${!n} onClick=${() => setPaso(tipo === 'pago' ? 3 : 2)}>Continuar</button>
    </div>`}

    ${paso === 2 &&
    html`<div class="registro">
      <button class="volver" onClick=${() => setPaso(1)}>‹ ${dinero(n)}</button>
      <h3 class="paso-titulo">¿En qué?</h3>
      ${tipo === 'gasto'
        ? html`
          <div class="rejilla">
            ${variables.map((c) => html`<button class="opcion" onClick=${() => { setCategoria(c.id); setPaso(3); }}><span class="op-ico">${c.icono}</span>${c.nombre}</button>`)}
          </div>
          <h4 class="sub">Gastos fijos</h4>
          <div class="rejilla">
            ${fijos.map((c) => html`<button class="opcion opcion-sec" onClick=${() => { setCategoria(c.id); setPaso(3); }}><span class="op-ico">${c.icono || '📌'}</span>${c.nombre}</button>`)}
          </div>`
        : html`<div class="rejilla">
            ${ingresos.map((c) => html`<button class="opcion" onClick=${() => { setCategoria(c.id); setPaso(3); }}><span class="op-ico">${c.icono}</span>${c.nombre}</button>`)}
          </div>`}
    </div>`}

    ${paso === 3 &&
    html`<div class="registro">
      <button class="volver" onClick=${() => setPaso(tipo === 'pago' ? 1 : 2)}>‹ ${dinero(n)}${categoria && cat.get(categoria) ? ' · ' + cat.get(categoria).nombre : ''}</button>
      <div class="fila-fecha">
        <button class=${'chip' + (fecha === hoyIso() ? ' activo' : '')} onClick=${() => setFecha(hoyIso())}>Hoy</button>
        <button class=${'chip' + (fecha === ayer() ? ' activo' : '')} onClick=${() => setFecha(ayer())}>Ayer</button>
        <input class="chip-fecha" type="date" value=${fecha} aria-label="Otra fecha" onInput=${(e) => e.target.value && setFecha(e.target.value)} />
      </div>
      ${tipo === 'gasto' && html`<div class="fila-fecha" role="group" aria-label="Si pagas con tarjeta, se paga en">
        <span class="etq-fila">Con tarjeta se paga en</span>
        <button class=${'chip' + (pago === 'auto' ? ' activo' : '')} onClick=${() => { setPago('auto'); setOtroMes(false); }}>Automático</button>
        <button class=${'chip' + (pago === addMonths(fecha.slice(0, 7), 2) ? ' activo' : '')} onClick=${() => { setPago(addMonths(fecha.slice(0, 7), 2)); setOtroMes(false); }}>${soloMes(addMonths(fecha.slice(0, 7), 2))}</button>
        ${otroMes
          ? html`<input class="chip-fecha" type="month" value=${pago === 'auto' ? addMonths(fecha.slice(0, 7), 1) : pago} aria-label="Mes de pago" onInput=${(e) => e.target.value && setPago(e.target.value)} />`
          : html`<button class="chip" onClick=${() => setOtroMes(true)}>Otro mes</button>`}
      </div>`}
      ${tipo === 'gasto' && pago === 'auto' && html`<p class="muted chico">Automático: ${soloMes(addMonths(fecha.slice(0, 7), 1))}, o ${soloMes(addMonths(fecha.slice(0, 7), 2))} si compraste después del corte de la tarjeta.</p>`}
      <input class="nota" placeholder="Nota (opcional)" value=${nota} onInput=${(e) => setNota(e.target.value)} />
      <h3 class="paso-titulo">${tipo === 'pago' ? '¿Qué tarjeta pagaste?' : tipo === 'ingreso' ? '¿A dónde llegó?' : '¿Cómo pagaste?'}</h3>
      <div class="rejilla">
        ${(tipo === 'pago' ? config.tarjetas.map((t) => ({ ...t, icono: '💳' })) : cuentasPago(config)).map(
          (c) => html`<button class=${'opcion' + (tipo === 'gasto' && c.id === sugerida ? ' sugerida' : '')} onClick=${() => guardar(c.id)}><span class="op-ico">${c.icono}</span>${c.nombre}${tipo === 'gasto' && c.id === sugerida ? html`<span class="op-usual">usual</span>` : ''}</button>`
        )}
      </div>
    </div>`}
  <//>`;
}

export function EditarMov({ config, mov, onCerrar }) {
  const [m, setM] = useState({ ...mov });
  const cat = catalogo(config);
  const opcionesCat = [...cat.values()].filter((c) => (m.tipo === 'ingreso' ? c.grupo === 'ingreso' : c.grupo !== 'ingreso'));
  const cuentas = m.tipo === 'pago' ? config.tarjetas : cuentasPago(config);
  const guardar = () => {
    const esTarjeta = config.tarjetas.some((x) => x.id === m.cuenta);
    const normal = addMonths((m.fecha || hoyIso()).slice(0, 7), 1);
    const pagoMes = m.tipo === 'gasto' && esTarjeta && m.pagoMes && m.pagoMes !== normal ? m.pagoMes : undefined;
    editarMov(mov.id, { monto: Number(m.monto) || 0, categoria: m.categoria, cuenta: m.cuenta, fecha: m.fecha, nota: m.nota, pagoMes });
    toast('Cambios guardados');
    onCerrar();
  };
  const eliminar = () => {
    borrarMov(mov.id);
    toast('Movimiento eliminado', { texto: 'Deshacer', fn: () => editarMov(mov.id, { deleted: false }) });
    onCerrar();
  };
  return html`<${Hoja} titulo="Editar movimiento" onCerrar=${onCerrar}>
    <div class="form">
      <${Campo} etiqueta="Monto"><input type="number" inputmode="decimal" value=${m.monto} onInput=${(e) => setM({ ...m, monto: e.target.value })} /><//>
      ${m.tipo !== 'pago' &&
      html`<${Campo} etiqueta="Categoría">
        <select value=${m.categoria} onChange=${(e) => setM({ ...m, categoria: e.target.value })}>
          ${opcionesCat.map((c) => html`<option value=${c.id}>${c.icono} ${c.nombre}</option>`)}
        </select>
      <//>`}
      <${Campo} etiqueta=${m.tipo === 'pago' ? 'Tarjeta' : 'Forma de pago'}>
        <select value=${m.cuenta} onChange=${(e) => setM({ ...m, cuenta: e.target.value })}>
          ${cuentas.map((c) => html`<option value=${c.id}>${c.nombre}</option>`)}
        </select>
      <//>
      <${Campo} etiqueta="Fecha de la compra"><input type="date" value=${m.fecha} onInput=${(e) => setM({ ...m, fecha: e.target.value })} /><//>
      ${m.tipo === 'gasto' && config.tarjetas.some((x) => x.id === m.cuenta) && html`<${Campo} etiqueta="Se paga en" ayuda=${`Normalmente ${soloMes(addMonths(m.fecha.slice(0, 7), 1))}. Cámbialo si compraste después del corte de la tarjeta.`}>
        <input type="month" value=${m.pagoMes || addMonths(m.fecha.slice(0, 7), 1)} onInput=${(e) => e.target.value && setM({ ...m, pagoMes: e.target.value })} />
      <//>`}
      <${Campo} etiqueta="Nota"><input value=${m.nota || ''} onInput=${(e) => setM({ ...m, nota: e.target.value })} /><//>
      <p class="muted">Registrado: ${fechaCorta(mov.fecha)}</p>
      <div class="acciones">
        <button class="btn btn-peligro" onClick=${eliminar}>Eliminar</button>
        <button class="btn btn-primario" onClick=${guardar}>Guardar</button>
      </div>
    </div>
  <//>`;
}
