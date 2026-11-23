import { html, useState, useRef, useEffect, Tarjeta, Seg, Hoja, Num, toast } from '../ui.js';
import { proyectar, resumenAnual } from '../proyeccion.js';
import { detalleConsumo } from '../calculos.js';
import { editarConfig } from '../store.js';
import { dinero, dineroCorto, nombreMes, parseYm, addMonths } from '../fechas.js';

let mesElegido = null; // recuerda el mes abierto en "Mes por mes" al cambiar de pantalla
const mesLargo = (t) => nombreMes(t, true);
const soloMes = (t) => nombreMes(t, true).split(' ')[0];

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

// ---------- Una línea editable ----------
function Linea({ item, signo, onEditar, sub }) {
  const contenido = html`
    <span class="fila-txt"><span class="fila-tit">${item.icono ? item.icono + ' ' : ''}${item.nombre}</span>${sub && html`<span class="fila-sub">${sub}</span>`}</span>
    ${item.ajustado && html`<span class="pill" title=${'Plan: ' + dinero(item.plan)}>ajustado</span>`}
    <span class=${'fila-monto ' + (signo === '+' ? 'pos' : '')}>${signo}${dinero(item.monto)}</span>`;
  if (item.editable === false) return html`<li class="fila linea">${contenido}<span class="lapiz" aria-hidden="true"></span></li>`;
  return html`<li><button class="fila fila-btn linea" onClick=${() => onEditar(item)}>
    ${contenido}
    <span class="lapiz" aria-hidden="true">✎</span>
  </button></li>`;
}

function EditarLinea({ t, item, onCerrar }) {
  const [v, setV] = useState(Math.round(item.esPresupuesto ? item.presupuesto : item.monto));
  const guardar = () => {
    editarConfig((c) => {
      c.ajustes = c.ajustes || {};
      c.ajustes[t] = { ...(c.ajustes[t] || {}), [item.id]: Number(v) || 0 };
    });
    toast(`${item.nombre} de ${soloMes(t)}: ${dinero(v)}`);
    onCerrar();
  };
  const restablecer = () => {
    editarConfig((c) => {
      const a = { ...((c.ajustes || {})[t] || {}) };
      delete a[item.id];
      if (Object.keys(a).length) c.ajustes[t] = a;
      else delete c.ajustes[t];
    });
    toast('Regresó al monto del plan');
    onCerrar();
  };
  return html`<${Hoja} titulo=${`${item.nombre} · ${mesLargo(t)}`} onCerrar=${onCerrar}>
    <div class="form">
      <label class="campo"><span class="campo-etq">Monto para ${mesLargo(t)}</span>
        <${Num} valor=${v} onCambio=${setV} /></label>
      ${item.id === 'tarjetas' && html`<p class="nota-alerta">Si fijas el total a mano, los gastos que registres con tarjeta ya no lo moverán. Mejor ajusta la deuda de cada tarjeta en <strong>Tarjetas</strong>.</p>`}
      <p class="muted chico">Monto del plan: <strong>${dinero(item.plan)}</strong>. Este cambio aplica <strong>solo a ${mesLargo(t)}</strong>; los meses siguientes se recalculan solos. Para cambiarlo para siempre, ve a <strong>Más</strong>.</p>
      <div class="acciones">
        ${item.ajustado && html`<button class="btn" onClick=${restablecer}>Volver al plan</button>`}
        <button class="btn btn-primario" onClick=${guardar}>Guardar</button>
      </div>
    </div>
  <//>`;
}

// ---------- Mes por mes ----------
// Un renglón del resumen que se abre para mostrar (y editar) su detalle.
function Grupo({ etiqueta, signo, monto, abierto, onToggle, children, clase }) {
  return html`<li class=${'grupo ' + (clase || '')}>
    <button class="fila fila-btn grupo-cab" aria-expanded=${abierto} onClick=${onToggle}>
      <span class="fila-txt">${etiqueta}</span>
      <span class="fila-monto">${signo}${dinero(monto)}</span>
      <span class=${'chev-g' + (abierto ? ' abierto' : '')} aria-hidden="true"></span>
    </button>
    ${abierto && html`<ul class="detalle">${children}</ul>`}
  </li>`;
}

function MesPorMes({ config, ir }) {
  const proy = proyectar(config);
  const meses = proy.meses;
  const [t, setT] = useState(mesElegido && meses.some((m) => m.t === mesElegido) ? mesElegido : meses[0] && meses[0].t);
  const [edit, setEdit] = useState(null);
  const [abiertos, setAbiertos] = useState({ cargos: true });
  const tira = useRef();
  useEffect(() => {
    mesElegido = t;
    const el = tira.current && tira.current.querySelector('.activo');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [t]);
  if (!meses.length) return html`<p class="vacio">No hay meses por proyectar.</p>`;
  const i = Math.max(0, meses.findIndex((m) => m.t === t));
  const m = meses[i];
  const ant = addMonths(m.t, -1);
  const sigM = addMonths(m.t, 1);
  const nAjustes = Object.keys((config.ajustes || {})[m.t] || {}).length;
  const toggle = (k) => setAbiertos({ ...abiertos, [k]: !abiertos[k] });
  const esPrimero = i === 0;

  return html`
    <div class="tira" ref=${tira}>
      ${meses.map((x) => html`<button class=${'tira-mes' + (x.t === m.t ? ' activo' : '') + (x.general < 0 ? ' neg' : '')} onClick=${() => setT(x.t)}>
        <span>${nombreMes(x.t)}</span><strong>${dineroCorto(x.general)}</strong>
      </button>`)}
    </div>
    <div class="nav-mes">
      <button class="icono-btn" aria-label="Mes anterior" disabled=${i === 0} onClick=${() => setT(meses[i - 1].t)}>‹</button>
      <h2>${mesLargo(m.t)}</h2>
      <button class="icono-btn" aria-label="Mes siguiente" disabled=${i === meses.length - 1} onClick=${() => setT(meses[i + 1].t)}>›</button>
    </div>

    <section class="tarjeta resumen-mes">
      <ul class="lista">
        <li class="fila"><span class="fila-txt">Arrancas con<span class="fila-sub">${esPrimero ? `Tus cuentas menos lo pendiente de ${soloMes(ant)}` : `Lo que te quedó de ${soloMes(ant)}`}</span></span><span class=${'fila-monto ' + (m.saldoInicial < 0 ? 'neg' : '')}>${dinero(m.saldoInicial)}</span><span class="chev-vacio"></span></li>
        <${Grupo} etiqueta="Entra" signo="+" monto=${m.ingresos} abierto=${abiertos.entra} onToggle=${() => toggle('entra')} clase="pos">
          <${Linea} item=${m.sueldo} signo="+" onEditar=${setEdit} />
          ${m.bonos.map((b) => html`<${Linea} item=${b} signo="+" onEditar=${setEdit} />`)}
        <//>
        <${Grupo} etiqueta="Sale de tu cuenta" signo="−" monto=${m.salidasDebito} abierto=${abiertos.cuenta} onToggle=${() => toggle('cuenta')}>
          ${m.consumo.debito.filter((x) => x.monto > 0 || x.editable).map((x) => html`<${Linea} item=${x} signo="−" onEditar=${setEdit} sub=${detalleConsumo(x)} />`)}
        <//>
        <${Grupo} etiqueta="Pagas de tarjetas" signo="−" monto=${m.tarjetas.monto} abierto=${abiertos.tarjetas} onToggle=${() => toggle('tarjetas')}>
          ${m.tarjetas.porTarjeta.map((g) => html`<li class="sub-grupo">
            <div class="fila"><span class="fila-txt"><strong>💳 ${g.nombre}</strong>${g.dia ? html`<span class="fila-sub">día ${g.dia}</span>` : ''}</span><span class="fila-monto">${dinero(g.total)}</span></div>
            ${g.deudas.length + g.consumo.length > 1 && g.deudas.map((d) => html`<div class="fila fila-sub"><span class="fila-txt">${d.concepto}</span><span>${dinero(d.monto)}</span></div>`)}
            ${g.deudas.length + g.consumo.length > 1 && g.consumo.map((c) => html`<div class="fila fila-sub"><span class="fila-txt">${c.nombre} (de ${soloMes(ant)})</span><span>${dinero(c.monto)}</span></div>`)}
            ${g.deudas.length + g.consumo.length === 1 && html`<div class="fila fila-sub"><span class="fila-txt">${g.deudas[0] ? g.deudas[0].concepto : `${g.consumo[0].nombre} (de ${soloMes(ant)})`}</span></div>`}
          </li>`)}
          <${Linea} item=${{ ...m.tarjetas, nombre: 'Total a pagar' }} signo="−" onEditar=${setEdit} sub=${m.tarjetas.ajustado ? `Calculado: ${dinero(m.tarjetas.plan)}` : 'Toca para ajustarlo a tus estados de cuenta'} />
        <//>
        <li class="fila fila-total"><span class="fila-txt">Te queda</span><span class=${'fila-monto grande ' + (m.saldoInicial + m.queda < 0 ? 'neg' : '')}>${dinero(m.saldoInicial + m.queda)}</span><span class="chev-vacio"></span></li>
        <${Linea} item=${m.retiro} signo="−" onEditar=${setEdit} sub=${config.ahorro.retiroPct + '% del sueldo, a tu cuenta de retiro'} />
        <li class="fila"><span class="fila-txt fila-sub">Rendimientos estimados (${proy.esc.rendimiento}% anual)</span><span class="fila-monto fila-sub">+${dinero(m.rendimiento)}</span><span class="chev-vacio"></span></li>
        <li class="fila fila-total"><span class="fila-txt">Ahorro al cierre</span><span class=${'fila-monto grande ' + (m.general < 0 ? 'neg' : 'pos')}>${dinero(m.general)}</span><span class="chev-vacio"></span></li>
      </ul>
      ${m.general < 0 && html`<p class="nota-alerta">⚠️ Terminas ${soloMes(m.t)} en negativo. Prueba bajar el ocio o el retiro de este mes, o mover un pago a un mes con bono.</p>`}
      ${nAjustes > 0 && html`<p class="muted chico">${nAjustes} ${nAjustes === 1 ? 'monto ajustado' : 'montos ajustados'} a mano este mes.</p>`}
    </section>

    <section class="tarjeta">
      <ul class="lista">
        <${Grupo} etiqueta=${html`Cargas a tarjeta en ${soloMes(m.t)}<span class="fila-sub">Lo pagas en ${soloMes(sigM)}</span>`} signo="" monto=${m.consumoTarjeta} abierto=${abiertos.cargos} onToggle=${() => toggle('cargos')}>
          ${m.consumo.tarjeta.map((x) => {
            const tj = config.tarjetas.find((k) => k.id === x.tarjeta);
            return html`<${Linea} item=${x} signo="" onEditar=${setEdit} sub=${[tj ? tj.nombre : 'Tarjeta sin elegir', detalleConsumo(x)].filter(Boolean).join(' · ')} />`;
          })}
        <//>
      </ul>
    </section>
    <p class="muted chico">Toca un monto con ✎ para cambiarlo solo en ${mesLargo(m.t)}; los meses siguientes se recalculan solos.</p>

    ${edit && html`<${EditarLinea} t=${m.t} item=${edit} onCerrar=${() => setEdit(null)} />`}
  `;
}

// ---------- Siete años ----------
function SieteAnios({ config, ir }) {
  const [abierto, setAbierto] = useState(null);
  const proy = proyectar(config);
  const anual = resumenAnual(proy.meses);
  const fin = proy.meses[proy.meses.length - 1];
  const esc = proy.esc;
  const comp = Object.entries(config.escenarios).map(([k, e]) => {
    const p = proyectar(config, e);
    const u = p.meses[p.meses.length - 1];
    return { k, nombre: e.nombre, enganche: p.hitos.enganche, final: u ? u.general : 0 };
  });

  return html`
    <${Seg} etiqueta="Escenario" valor=${config.escenario} onCambio=${(v) => editarConfig((c) => { c.escenario = v; })}
      opciones=${Object.entries(config.escenarios).map(([k, e]) => ({ valor: k, texto: e.nombre }))} />
    <p class="supuestos">Sueldo +${esc.aumento}% al año · inflación ${esc.inflacion}% · rendimiento ${esc.rendimiento}% · doctorado +${esc.doctorado}% al año</p>
    <label class="interruptor">
      <input type="checkbox" checked=${config.incluirInciertos} onChange=${(e) => editarConfig((c) => { c.incluirInciertos = e.target.checked; })} />
      <span>Incluir ingresos no seguros (bono de marzo)</span>
    </label>

    <div class="hitos">
      <div class="hito"><span class="hito-ico">🛟</span><span class="muted">Fondo de emergencia</span><strong>${proy.hitos.fondo ? mesLargo(proy.hitos.fondo) : 'No se alcanza'}</strong></div>
      <div class="hito"><span class="hito-ico">🏡</span><span class="muted">Enganche de ${dineroCorto(config.metas.enganche)}</span><strong>${proy.hitos.enganche ? mesLargo(proy.hitos.enganche) : 'No se alcanza'}</strong></div>
      <div class="hito"><span class="hito-ico">💰</span><span class="muted">Ahorro en ${config.horizonte.slice(0, 4)}</span><strong>${dinero(fin ? fin.general : 0)}</strong></div>
      <div class="hito"><span class="hito-ico">🧓</span><span class="muted">Retiro en ${config.horizonte.slice(0, 4)}</span><strong>${dinero(fin ? fin.retiroSaldo : 0)}</strong></div>
    </div>

    ${proy.hitos.negativos.length > 0 &&
    html`<div class="aviso aviso-critico">
      <span>⚠️ <strong>Saldo negativo en ${proy.hitos.negativos.length} ${proy.hitos.negativos.length === 1 ? 'mes' : 'meses'}</strong>, el primero ${mesLargo(proy.hitos.negativos[0])}. Lo más bajo: ${dinero(proy.hitos.minimo.saldo)} en ${mesLargo(proy.hitos.minimo.t)}.</span>
      <button class="btn btn-chico" onClick=${() => { mesElegido = proy.hitos.negativos[0]; ir('meses'); }}>Ver</button>
    </div>`}

    <${Tarjeta} titulo="Ahorro proyectado">
      <${Grafica} meses=${proy.meses} config=${config} />
      <p class="muted chico">Toca la gráfica para ver cada mes. Los puntos son tus cierres reales.</p>
    <//>

    <${Tarjeta} titulo="Comparar escenarios">
      <table class="tabla">
        <thead><tr><th>Escenario</th><th>Enganche listo</th><th>Ahorro ${config.horizonte.slice(0, 4)}</th></tr></thead>
        <tbody>${comp.map((c) => html`<tr class=${c.k === config.escenario ? 'sel' : ''}><td>${c.nombre}</td><td>${c.enganche ? mesLargo(c.enganche) : '—'}</td><td class="num">${dineroCorto(c.final)}</td></tr>`)}</tbody>
      </table>
    <//>

    <${Tarjeta} titulo="Año por año">
      <p class="muted chico">Toca un año para ver sus meses, y un mes para abrirlo en “Mes por mes”.</p>
      <div class="tabla-scroll">
        <table class="tabla">
          <thead><tr><th>Año</th><th>Entra</th><th>Sale</th><th>Ahorro neto</th><th>Saldo</th></tr></thead>
          <tbody>
            ${anual.map((a) => html`
              <tr class="clic" onClick=${() => setAbierto(abierto === a.anio ? null : a.anio)}>
                <td><strong>${abierto === a.anio ? '▾' : '▸'} ${a.anio}</strong></td>
                <td class="num">${dineroCorto(a.ingresos)}</td>
                <td class="num">${dineroCorto(a.salidas)}</td>
                <td class=${'num ' + (a.flujo < 0 ? 'neg' : '')}>${dineroCorto(a.flujo)}</td>
                <td class=${'num ' + (a.general < 0 ? 'neg' : '')}>${dineroCorto(a.general)}</td>
              </tr>
              ${abierto === a.anio && proy.meses.filter((m) => m.t.startsWith(a.anio)).map((m) => html`<tr class="sub-fila clic" onClick=${() => { mesElegido = m.t; ir('meses'); }}>
                <td>${nombreMes(m.t)}</td>
                <td class="num">${dineroCorto(m.ingresos)}${m.totBonos ? ' 🎁' : ''}</td>
                <td class="num">${dineroCorto(m.salidasDebito + m.tarjetas.monto)}</td>
                <td class=${'num ' + (m.flujo < 0 ? 'neg' : '')}>${dineroCorto(m.flujo)}</td>
                <td class=${'num ' + (m.general < 0 ? 'neg' : '')}>${dineroCorto(m.general)}</td>
              </tr>`)}
            `)}
          </tbody>
        </table>
      </div>
      <p class="muted chico">🎁 mes con bono. El ahorro neto ya descuenta tu aportación al retiro.</p>
    <//>
  `;
}

export function Plan({ config, ir, ruta }) {
  const modo = ruta === 'meses' ? 'meses' : 'plan';
  return html`<div class="pantalla">
    <h2 class="titulo-pant">Plan</h2>
    <${Seg} etiqueta="Vista" valor=${modo} onCambio=${(v) => ir(v)}
      opciones=${[{ valor: 'meses', texto: 'Mes por mes' }, { valor: 'plan', texto: `A ${config.horizonte.slice(0, 4)}` }]} />
    ${modo === 'meses' ? html`<${MesPorMes} config=${config} ir=${ir} />` : html`<${SieteAnios} config=${config} ir=${ir} />`}
  </div>`;
}
