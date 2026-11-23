import { html, Tarjeta, Barra, toast } from '../ui.js';
import { resumenMes, catalogo, metasActuales, registroHoy, mesDeCierreSugerido, flujoDelMes, mesDeTarjetas } from '../calculos.js';
import { proyectar } from '../proyeccion.js';
import { editarConfig } from '../store.js';
import { dinero, dineroCorto, nombreMes, ymActual, addMonths } from '../fechas.js';

const mesCorto = (t) => nombreMes(t, true).split(' ')[0];
const cifra = (n) => (Math.abs(n) >= 1e6 ? dineroCorto(n) : dinero(n));

export function Inicio({ config, movs, abrirRegistro, ir }) {
  const t = ymActual();
  const r = resumenMes(config, movs, t);
  const cat = catalogo(config);
  const hora = new Date().getHours();
  const proy = proyectar(config);
  const sig = proy.meses[0];
  const metas = metasActuales(config);
  const cierre = mesDeCierreSugerido();

  const principal = r.presupuestos.find((p) => p.pago === 'tarjeta') || r.presupuestos[0];
  const otros = r.presupuestos.filter((p) => p !== principal);
  const estadoDe = (p) => (p.gastado > p.monto ? 'critico' : p.gastado > p.monto * 0.85 ? 'alerta' : 'bien');
  const porDia = principal && r.diasRestantes > 0 ? principal.restante / r.diasRestantes : 0;
  const tjPrincipal = principal && config.tarjetas.find((x) => x.id === principal.tarjeta);

  // En el mes del cierre mandan los pendientes que anotaste; después, los del plan.
  const enCorte = t <= config.ahorro.fechaCorte;
  const pendientes = enCorte
    ? (config.ahorro.pendientes || []).map((p, i) => ({ tipo: 'corte', i, ...p }))
    : [
        ...r.fijos.filter((f) => f.pago !== 'tarjeta' && !f.pagado && f.monto > 0).map((f) => ({ tipo: 'fijo', ...f })),
        ...config.deudas.filter((d) => d.mes === t && !d.pagada).map((d) => ({ tipo: 'deuda', ...d, nombre: `${(config.tarjetas.find((x) => x.id === d.tarjeta) || {}).nombre || 'Tarjeta'}: ${d.concepto}` })),
      ].sort((a, b) => (a.dia || 99) - (b.dia || 99));

  // Pagar un pendiente del cierre: sale de tu cuenta de nómina, así el arranque no cambia.
  const pagarPendiente = (p) => {
    const antes = structuredClone(config.ahorro);
    editarConfig((c) => {
      c.ahorro.pendientes = c.ahorro.pendientes.filter((_, j) => j !== p.i);
      const generales = c.ahorro.cuentas.filter((x) => x.destino !== 'retiro');
      const cuenta = generales.sort((a, b) => (a.tasa || 0) - (b.tasa || 0))[0];
      if (cuenta) cuenta.saldo = (cuenta.saldo || 0) - p.monto;
    });
    toast(`${p.nombre}: pagado. Cuando puedas, actualiza tus saldos reales.`, { texto: 'Deshacer', fn: () => editarConfig((c) => { c.ahorro = antes; }) });
  };

  // Pagos de tarjeta del mes en curso (o del primero después del cierre)
  const mt = mesDeTarjetas(config);
  const fT = flujoDelMes(config, mt, proy);
  const pagosTj = fT.tarjetas.porTarjeta;

  // Meses en negativo en los próximos 12
  const negativos = proy.meses.slice(0, 12).filter((m) => m.general < 0);
  const peor = negativos.reduce((a, m) => (!a || m.general < a.general ? m : a), null);

  return html`<div class="pantalla">
    ${hora >= 19 && !registroHoy(movs) &&
    html`<div class="aviso aviso-info"><span>📝 Hoy no has registrado gastos.</span><button class="btn btn-chico" onClick=${() => abrirRegistro()}>Registrar</button></div>`}
    ${config.ahorro.fechaCorte < cierre &&
    html`<div class="aviso aviso-info"><span>📅 Actualiza tus saldos al cierre de ${nombreMes(cierre, true)}.</span><button class="btn btn-chico" onClick=${() => ir('ahorro')}>Actualizar</button></div>`}

    ${principal && html`<section class="hero">
      <p class="hero-etq">Te quedan para ${principal.nombre.toLowerCase()} en ${mesCorto(t)}</p>
      <p class=${'hero-num ' + (principal.restante < 0 ? 'negativo' : '')}>${dinero(principal.restante)}</p>
      <${Barra} valor=${principal.gastado} max=${principal.monto} estado=${estadoDe(principal)} />
      <p class="hero-sub">
        ${r.diasRestantes > 0 && principal.restante > 0 ? html`<strong>${dinero(porDia)}</strong> por día · ${r.diasRestantes} días · ` : ''}
        llevas ${dinero(principal.gastado)} de ${dinero(principal.monto)}
        ${principal.restante < 0 ? html` · <strong class="neg">te pasaste ${dinero(-principal.restante)}</strong>` : ''}
      </p>
      ${principal.pago === 'tarjeta' && html`<p class="hero-nota">💳 Se carga a ${tjPrincipal ? tjPrincipal.nombre : 'tarjeta'} y lo pagas en ${mesCorto(addMonths(t, 1))}.</p>`}
      ${otros.map((p) => html`<div class="mini-presu">
        <div class="meta-top"><span>${p.nombre}</span><span class="num">${dinero(p.restante)} disponibles</span></div>
        <${Barra} valor=${p.gastado} max=${p.monto} estado=${estadoDe(p)} />
      </div>`)}
    </section>`}

    ${negativos.length > 0 && html`<div class="aviso aviso-critico">
      <span>⚠️ ${negativos.length === 1 ? `${mesCorto(negativos[0].t)} cierra` : `${negativos.length} meses cierran`} en negativo; lo más bajo, ${dinero(peor.general)} en ${mesCorto(peor.t)}.</span>
      <button class="btn btn-chico" onClick=${() => ir('meses')}>Revisar</button>
    </div>`}

    ${sig && html`<section class="kpis-caja">
      <h3 class="kpis-cab">${nombreMes(sig.t, true)} de un vistazo</h3>
      <div class="kpis">
        <button class="kpi" onClick=${() => ir('ahorro')}><span class="kpi-etq">Arrancas con</span><strong>${cifra(sig.saldoInicial)}</strong></button>
        <button class="kpi" onClick=${() => ir('tarjetas')}><span class="kpi-etq">Pagas de tarjetas</span><strong>${cifra(sig.tarjetas.monto)}</strong></button>
        <button class="kpi" onClick=${() => ir('meses')}><span class="kpi-etq">Cierras con</span><strong class=${sig.general < 0 ? 'neg' : 'pos'}>${cifra(sig.general)}</strong></button>
      </div>
    </section>`}

    ${pendientes.length > 0 &&
    html`<${Tarjeta} titulo=${'Por pagar en ' + mesCorto(t)}>
      <ul class="lista lista-pend">
        ${pendientes.map(
          (p) => html`<li class="fila">
            <div class="fila-txt">
              <span class="fila-tit">${p.tipo === 'fijo' ? (cat.get(p.id) || {}).icono + ' ' : p.tipo === 'corte' ? '📌 ' : '💳 '}${p.nombre}</span>
              <span class="fila-sub">${p.tipo === 'corte' ? 'Anotado en tu cierre' : p.dia ? `Día ${p.dia}` : p.tipo === 'deuda' ? 'Pago de tarjeta' : 'Este mes'}</span>
            </div>
            <span class="fila-monto">${dinero(p.monto)}</span>
            ${p.tipo === 'corte'
              ? html`<button class="btn btn-chico" onClick=${() => pagarPendiente(p)}>Ya lo pagué</button>`
              : p.tipo === 'fijo'
              ? html`<button class="btn btn-chico" onClick=${() => abrirRegistro({ categoria: p.id, monto: p.monto })}>Pagar</button>`
              : html`<button class="btn btn-chico" onClick=${() => {
                  editarConfig((c) => { const d = c.deudas.find((x) => x.id === p.id); if (d) d.pagada = true; });
                  toast('Pago marcado', { texto: 'Deshacer', fn: () => editarConfig((c) => { const d = c.deudas.find((x) => x.id === p.id); if (d) d.pagada = false; }) });
                }}>Pagada</button>`}
          </li>`
        )}
      </ul>
    <//>`}

    ${pagosTj.length > 0 && html`<${Tarjeta} titulo=${'Tarjetas de ' + mesCorto(mt)} accion=${html`<button class="enlace" onClick=${() => ir('tarjetas')}>Detalle</button>`}>
      <ul class="lista lista-compacta">
        ${pagosTj.slice(0, 5).map((g) => html`<li class="fila"><span class="fila-txt">💳 ${g.nombre}${g.dia ? html`<span class="fila-sub">día ${g.dia}</span>` : ''}</span><span class="fila-monto">${dinero(g.total)}</span></li>`)}
        ${pagosTj.length > 5 && html`<li class="fila"><span class="fila-txt fila-sub">y ${pagosTj.length - 5} más</span><span class="fila-monto fila-sub">${dinero(pagosTj.slice(5).reduce((a, g) => a + g.total, 0))}</span></li>`}
        <li class="fila fila-total"><span class="fila-txt">Total</span><span class="fila-monto">${dinero(fT.tarjetas.monto)}</span></li>
      </ul>
    <//>`}

    <${Tarjeta} titulo="Mis metas" accion=${html`<button class="enlace" onClick=${() => ir('plan')}>Plan</button>`}>
      <div class="meta">
        <div class="meta-top"><span>🛟 Fondo de emergencia</span><span class="num">${dineroCorto(metas.fondo)} / ${dineroCorto(config.metas.fondo)}</span></div>
        <${Barra} valor=${metas.fondo} max=${config.metas.fondo} estado="bien" />
        <span class="meta-sub">${proy.hitos.fondo ? `Completo en ${nombreMes(proy.hitos.fondo, true)}` : 'No se completa en el plan'}</span>
      </div>
      <div class="meta">
        <div class="meta-top"><span>🏡 Enganche</span><span class="num">${dineroCorto(metas.enganche)} / ${dineroCorto(config.metas.enganche)}</span></div>
        <${Barra} valor=${metas.enganche} max=${config.metas.enganche} estado="bien" />
        <span class="meta-sub">${proy.hitos.enganche ? `Listo en ${nombreMes(proy.hitos.enganche, true)}` : 'No se alcanza antes de ' + nombreMes(config.horizonte, true)}</span>
      </div>
      <div class="meta">
        <div class="meta-top"><span>🧓 Retiro</span><span class="num">${dineroCorto(metas.retiro)}</span></div>
        <span class="meta-sub">${config.ahorro.retiroPct}% de tu sueldo cada mes</span>
      </div>
    <//>

    ${r.porCat.size > 0 &&
    html`<${Tarjeta} titulo=${'¿En qué se fue ' + mesCorto(t) + '?'} accion=${html`<button class="enlace" onClick=${() => ir('movs')}>Ver todo</button>`}>
      <ul class="lista lista-compacta">
        ${[...r.porCat.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => {
          const c = cat.get(id) || { nombre: 'Otros', icono: '📦' };
          const tot = [...r.porCat.values()].reduce((a, x) => a + x, 0);
          return html`<li class="fila-cat">
            <div class="fila-cat-top"><span>${c.icono} ${c.nombre}</span><span class="num">${dinero(v)}</span></div>
            <${Barra} valor=${v} max=${tot} />
          </li>`;
        })}
      </ul>
    <//>`}
  </div>`;
}
