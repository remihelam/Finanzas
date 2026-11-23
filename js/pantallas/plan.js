import { html, useState, useRef, useEffect, Tarjeta, Seg } from '../ui.js';
import { proyectar, resumenAnual } from '../proyeccion.js';
import { editarConfig } from '../store.js';
import { dinero, dineroCorto, nombreMes, parseYm } from '../fechas.js';

function Grafica({ meses, config }) {
  const [hover, setHover] = useState(null);
  const [W, setW] = useState(340);
  const ref = useRef();
  const caja = useRef();
  useEffect(() => {
    const medir = () => caja.current && setW(Math.max(280, caja.current.clientWidth));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? 230 : 300, pl = 46, pr = 8, pt = 16, pb = 24;
  const serieA = meses.map((m) => m.general);
  const serieB = meses.map((m) => m.retiroSaldo);
  const metaTotal = config.metas.fondo + config.metas.enganche;
  const ymax = Math.max(...serieA, ...serieB, metaTotal) * 1.05;
  const ymin = Math.min(0, ...serieA);
  const x = (i) => pl + (i / Math.max(1, meses.length - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - ymin) / (ymax - ymin)) * (H - pt - pb);
  const linea = (s) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const paso = ymax > 2e6 ? 1e6 : ymax > 8e5 ? 5e5 : 1e5;
  const ticks = [];
  for (let v = Math.ceil(ymin / paso) * paso; v <= ymax; v += paso) ticks.push(v);
  const cadaAnios = W < 500 ? 2 : 1;
  const anios = meses.map((m, i) => ({ i, ...parseYm(m.t) })).filter((m) => m.m === 1 && m.y % cadaAnios === 0);

  // Puntos reales capturados en cada cierre de mes
  const hist = config.ahorro.historial || {};
  const reales = meses.map((m, i) => (hist[m.t] ? { i, v: hist[m.t].general } : null)).filter(Boolean);

  const mover = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pl) / (W - pl - pr)) * (meses.length - 1));
    setHover(Math.max(0, Math.min(meses.length - 1, i)));
  };
  const h = hover != null ? meses[hover] : null;

  return html`<div class="viz">
    <div class="leyenda">
      <span><i class="lg lg-a"></i>Ahorro (fondo + enganche)</span>
      <span><i class="lg lg-b"></i>Retiro</span>
      <span><i class="lg lg-meta"></i>Metas</span>
    </div>
    <div class="viz-caja" ref=${caja}>
      <svg ref=${ref} viewBox="0 0 ${W} ${H}" width=${W} height=${H} role="img" aria-label="Proyección de ahorro mes a mes"
        onPointerMove=${mover} onPointerDown=${mover} onPointerLeave=${() => setHover(null)}>
        ${ticks.map((v) => html`<g>
          <line x1=${pl} x2=${W - pr} y1=${y(v)} y2=${y(v)} class=${v === 0 ? 'eje' : 'rejilla-l'} />
          <text x=${pl - 6} y=${y(v) + 4} class="eje-txt" text-anchor="end">${dineroCorto(v)}</text>
        </g>`)}
        ${anios.map((a) => html`<text x=${x(a.i)} y=${H - 6} class="eje-txt" text-anchor="middle">${a.y}</text>`)}
        <line x1=${pl} x2=${W - pr} y1=${y(config.metas.fondo)} y2=${y(config.metas.fondo)} class="meta-l" />
        <text x=${W - pr} y=${y(config.metas.fondo) - 5} class="eje-txt" text-anchor="end">Fondo de emergencia</text>
        <line x1=${pl} x2=${W - pr} y1=${y(metaTotal)} y2=${y(metaTotal)} class="meta-l" />
        <text x=${pl + 4} y=${y(metaTotal) - 5} class="eje-txt">Fondo + enganche</text>
        <path d=${linea(serieB)} class="serie serie-b" />
        <path d=${linea(serieA)} class="serie serie-a" />
        ${reales.map((p) => html`<circle cx=${x(p.i)} cy=${y(p.v)} r="4.5" class="punto-real" />`)}
        ${h && html`<g>
          <line x1=${x(hover)} x2=${x(hover)} y1=${pt} y2=${H - pb} class="cruz" />
          <circle cx=${x(hover)} cy=${y(h.general)} r="4.5" class="punto-a" />
          <circle cx=${x(hover)} cy=${y(h.retiroSaldo)} r="4.5" class="punto-b" />
        </g>`}
      </svg>
      ${h && html`<div class="tooltip" style=${`left:${Math.min(Math.max(x(hover), 90), W - 90)}px`}>
        <strong>${nombreMes(h.t, true)}</strong>
        <span><i class="lg lg-a"></i>Ahorro ${dinero(h.general)}</span>
        <span><i class="lg lg-b"></i>Retiro ${dinero(h.retiroSaldo)}</span>
        <span class="muted">Flujo del mes ${dinero(h.flujo)}</span>
      </div>`}
    </div>
  </div>`;
}

export function Plan({ config }) {
  const [abierto, setAbierto] = useState(null);
  const [mesAbierto, setMesAbierto] = useState(null);
  const proy = proyectar(config);
  const anual = resumenAnual(proy.meses);
  const fin = proy.meses[proy.meses.length - 1];
  const esc = proy.esc;

  // Comparación rápida entre escenarios
  const comp = Object.entries(config.escenarios).map(([k, e]) => {
    const p = proyectar(config, e);
    const u = p.meses[p.meses.length - 1];
    return { k, nombre: e.nombre, enganche: p.hitos.enganche, final: u ? u.general : 0 };
  });

  return html`<div class="pantalla">
    <h2 class="titulo-pant">Proyección a ${nombreMes(config.horizonte, true)}</h2>
    <${Seg} etiqueta="Escenario" valor=${config.escenario} onCambio=${(v) => editarConfig((c) => { c.escenario = v; })}
      opciones=${Object.entries(config.escenarios).map(([k, e]) => ({ valor: k, texto: e.nombre }))} />
    <p class="supuestos">Sueldo +${esc.aumento}% al año · inflación ${esc.inflacion}% · rendimiento ${esc.rendimiento}% · doctorado +${esc.doctorado}% al año</p>
    <label class="interruptor">
      <input type="checkbox" checked=${config.incluirInciertos} onChange=${(e) => editarConfig((c) => { c.incluirInciertos = e.target.checked; })} />
      <span>Incluir ingresos no seguros (bono de marzo)</span>
    </label>

    <div class="hitos">
      <div class="hito"><span class="hito-ico">🛟</span><span class="muted">Fondo de emergencia</span><strong>${proy.hitos.fondo ? nombreMes(proy.hitos.fondo, true) : 'No se alcanza'}</strong></div>
      <div class="hito"><span class="hito-ico">🏡</span><span class="muted">Enganche de ${dineroCorto(config.metas.enganche)}</span><strong>${proy.hitos.enganche ? nombreMes(proy.hitos.enganche, true) : 'No se alcanza'}</strong></div>
      <div class="hito"><span class="hito-ico">💰</span><span class="muted">Ahorro en ${config.horizonte.slice(0, 4)}</span><strong>${dinero(fin ? fin.general : 0)}</strong></div>
      <div class="hito"><span class="hito-ico">🧓</span><span class="muted">Retiro en ${config.horizonte.slice(0, 4)}</span><strong>${dinero(fin ? fin.retiroSaldo : 0)}</strong></div>
    </div>

    ${proy.hitos.negativos.length > 0 &&
    html`<div class="aviso aviso-critico">
      <span>⚠️ <strong>Saldo negativo de ${nombreMes(proy.hitos.negativos[0], true)} a ${nombreMes(proy.hitos.negativos[proy.hitos.negativos.length - 1], true)}.</strong>
      Lo más bajo: ${dinero(proy.hitos.minimo.saldo)} en ${nombreMes(proy.hitos.minimo.t, true)}. Para esos meses tendrías que recortar gastos o mover pagos de tarjeta a meses con bono.</span>
    </div>`}

    <${Tarjeta} titulo="Ahorro proyectado">
      <${Grafica} meses=${proy.meses} config=${config} />
      <p class="muted chico">Toca la gráfica para ver cada mes. Los puntos son tus cierres reales.</p>
    <//>

    <${Tarjeta} titulo="Comparar escenarios">
      <table class="tabla">
        <thead><tr><th>Escenario</th><th>Enganche listo</th><th>Ahorro ${config.horizonte.slice(0, 4)}</th></tr></thead>
        <tbody>${comp.map((c) => html`<tr class=${c.k === config.escenario ? 'sel' : ''}><td>${c.nombre}</td><td>${c.enganche ? nombreMes(c.enganche, true) : '—'}</td><td class="num">${dineroCorto(c.final)}</td></tr>`)}</tbody>
      </table>
    <//>

    <${Tarjeta} titulo="Año por año">
      <p class="muted chico">Toca un año para ver sus meses, y un mes para ver su desglose.</p>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Año</th><th>Ingresos</th><th>Gastos</th><th>Ahorro neto</th><th>Saldo</th></tr></thead>
          <tbody>
            ${anual.map((a) => html`
              <tr class="clic" onClick=${() => setAbierto(abierto === a.anio ? null : a.anio)}>
                <td><strong>${abierto === a.anio ? '▾' : '▸'} ${a.anio}</strong></td>
                <td class="num">${dineroCorto(a.ingresos)}</td>
                <td class="num">${dineroCorto(a.gastos + a.deudas)}</td>
                <td class=${'num ' + (a.flujo < 0 ? 'neg' : '')}>${dineroCorto(a.flujo)}</td>
                <td class=${'num ' + (a.general < 0 ? 'neg' : '')}>${dineroCorto(a.general)}</td>
              </tr>
              ${abierto === a.anio && proy.meses.filter((m) => m.t.startsWith(a.anio)).map((m) => html`<tr class="sub-fila clic" onClick=${() => setMesAbierto(mesAbierto === m.t ? null : m.t)}>
                <td>${nombreMes(m.t)}</td>
                <td class="num">${dineroCorto(m.ingresos)}${m.totBonos ? ' 🎁' : ''}</td>
                <td class="num">${dineroCorto(m.gastos + m.deudasPendientes)}${m.deudasPendientes ? ' 💳' : ''}</td>
                <td class=${'num ' + (m.flujo < 0 ? 'neg' : '')}>${dineroCorto(m.flujo)}</td>
                <td class=${'num ' + (m.general < 0 ? 'neg' : '')}>${dineroCorto(m.general)}</td>
              </tr>
              ${mesAbierto === m.t && html`<tr class="detalle-fila"><td colspan="5">${detalle(m).map((d) => html`<div class="det"><span>${d[0]}</span><span class="num">${d[1]}</span></div>`)}</td></tr>`}`)}
            `)}
          </tbody>
        </table>
      </div>
      <p class="muted chico">🎁 mes con bono · 💳 mes con pago de deudas. El ahorro neto ya descuenta tu aportación al retiro.</p>
    <//>
  </div>`;
}

function detalle(m) {
  const partes = [['Sueldo', dinero(m.sueldo)]];
  for (const b of m.bonos) partes.push([b.nombre, dinero(b.monto)]);
  for (const f of m.fijos) partes.push([f.nombre, '−' + dinero(f.monto)]);
  partes.push(['Ocio', '−' + dinero(m.variable)]);
  if (m.deudasPendientes) partes.push(['Liquidar tarjetas', '−' + dinero(m.deudasPendientes)]);
  partes.push(['Ahorro para retiro', '−' + dinero(m.retiro)]);
  if (m.rendimiento) partes.push(['Rendimientos', '+' + dinero(m.rendimiento)]);
  partes.push(['Saldo al cierre', dinero(m.general)]);
  return partes;
}
