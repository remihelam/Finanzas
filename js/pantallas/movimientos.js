import { html, useState } from '../ui.js';
import { catalogo, nombreCuenta } from '../calculos.js';
import { dinero, nombreMes, ymActual, addMonths, fechaCorta } from '../fechas.js';

export function Movimientos({ config, movs, editar }) {
  const [t, setT] = useState(ymActual());
  const [filtro, setFiltro] = useState('todos');
  const cat = catalogo(config);
  const delMes = movs.filter((m) => m.fecha.startsWith(t) && (filtro === 'todos' || m.tipo === filtro));
  const gastos = delMes.filter((m) => m.tipo === 'gasto').reduce((a, m) => a + Number(m.monto), 0);
  const ingresos = delMes.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
  const pagos = delMes.filter((m) => m.tipo === 'pago').reduce((a, m) => a + Number(m.monto), 0);

  const porDia = new Map();
  for (const m of delMes) {
    if (!porDia.has(m.fecha)) porDia.set(m.fecha, []);
    porDia.get(m.fecha).push(m);
  }

  return html`<div class="pantalla">
    <div class="nav-mes">
      <button class="icono-btn" aria-label="Mes anterior" onClick=${() => setT(addMonths(t, -1))}>‹</button>
      <h2>${nombreMes(t, true)}</h2>
      <button class="icono-btn" aria-label="Mes siguiente" disabled=${t >= ymActual()} onClick=${() => setT(addMonths(t, 1))}>›</button>
    </div>
    <div class="totales">
      <div><span class="muted">Gastos</span><strong>${dinero(gastos)}</strong></div>
      <div><span class="muted">Ingresos extra</span><strong class="pos">${dinero(ingresos)}</strong></div>
      <div><span class="muted">Pagos a tarjetas</span><strong>${dinero(pagos)}</strong></div>
    </div>
    <div class="filtros">
      ${[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['pago', 'Pagos']].map(
        ([v, txt]) => html`<button class=${'chip' + (filtro === v ? ' activo' : '')} onClick=${() => setFiltro(v)}>${txt}</button>`
      )}
    </div>
    ${porDia.size === 0 && html`<p class="vacio">No hay movimientos en ${nombreMes(t, true)}.<br />Toca <strong>+</strong> para registrar uno.</p>`}
    ${[...porDia.entries()].map(([dia, lista]) => html`<section class="grupo-dia">
      <h3 class="dia-cab"><span>${fechaCorta(dia)}</span><span class="num">${dinero(lista.filter((m) => m.tipo === 'gasto').reduce((a, m) => a + Number(m.monto), 0))}</span></h3>
      <ul class="lista">
        ${lista.map((m) => {
          const c = m.tipo === 'pago' ? { icono: '💳', nombre: 'Pago de tarjeta' } : cat.get(m.categoria) || { icono: '❔', nombre: 'Sin categoría' };
          return html`<li><button class="fila fila-btn" onClick=${() => editar(m)}>
            <span class="ico-circ">${c.icono}</span>
            <span class="fila-txt"><span class="fila-tit">${c.nombre}</span><span class="fila-sub">${nombreCuenta(config, m.cuenta)}${m.nota ? ' · ' + m.nota : ''}</span></span>
            <span class=${'fila-monto ' + (m.tipo === 'ingreso' ? 'pos' : '')}>${m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : ''}${dinero(m.monto)}</span>
          </button></li>`;
        })}
      </ul>
    </section>`)}
  </div>`;
}
