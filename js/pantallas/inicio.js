import { html, Tarjeta, Barra, toast } from '../ui.js';
import { resumenMes, catalogo, saldoTarjeta, proximaFecha, metasActuales, registroHoy, mesDeCierreSugerido } from '../calculos.js';
import { proyectar } from '../proyeccion.js';
import { editarConfig } from '../store.js';
import { dinero, nombreMes, ymActual, fechaCorta } from '../fechas.js';

export function Inicio({ config, movs, abrirRegistro, ir }) {
  const t = ymActual();
  const r = resumenMes(config, movs, t);
  const cat = catalogo(config);
  const hora = new Date().getHours();
  const proy = proyectar(config);
  const metas = metasActuales(config);
  const cierre = mesDeCierreSugerido();

  const usado = r.gastadoVar / (r.plan.variable || 1);
  const estado = usado > 1 ? 'critico' : usado > 0.85 ? 'alerta' : 'bien';

  const pendientes = [
    ...r.fijos.filter((f) => !f.pagado && f.monto > 0).map((f) => ({ tipo: 'fijo', ...f })),
    ...r.plan.deudas.filter((d) => !d.pagada).map((d) => ({ tipo: 'deuda', ...d, nombre: `${(config.tarjetas.find((x) => x.id === d.tarjeta) || {}).nombre || 'Tarjeta'}: ${d.concepto}` })),
  ].sort((a, b) => (a.dia || 99) - (b.dia || 99));

  const tarjetas = config.tarjetas.map((tj) => ({ ...tj, ...saldoTarjeta(config, movs, tj.id), prox: proximaFecha(tj.pago) })).filter((x) => x.saldo > 0);
  const totTarjetas = tarjetas.reduce((a, x) => a + x.saldo, 0);

  const proxNegativo = proy.hitos.negativos[0];

  return html`<div class="pantalla">
    ${hora >= 19 && !registroHoy(movs) &&
    html`<div class="aviso aviso-info"><span>📝 Hoy no has registrado gastos.</span><button class="btn btn-chico" onClick=${() => abrirRegistro()}>Registrar</button></div>`}
    ${config.ahorro.fechaCorte < cierre &&
    html`<div class="aviso aviso-info"><span>📅 Actualiza tus saldos al cierre de ${nombreMes(cierre, true)}.</span><button class="btn btn-chico" onClick=${() => ir('ahorro')}>Actualizar</button></div>`}

    <section class="hero">
      <p class="hero-etq">Te quedan para gastar en ${nombreMes(t, true).split(' ')[0]}</p>
      <p class=${'hero-num ' + (r.restanteVar < 0 ? 'negativo' : '')}>${dinero(r.restanteVar)}</p>
      <${Barra} valor=${r.gastadoVar} max=${r.plan.variable} estado=${estado} />
      <p class="hero-sub">
        Gastado ${dinero(r.gastadoVar)} de ${dinero(r.plan.variable)}
        ${r.diasRestantes > 0 && r.restanteVar > 0 ? html` · <strong>${dinero(r.porDia)}</strong> por día los próximos ${r.diasRestantes} días` : ''}
        ${r.restanteVar < 0 ? html` · <strong>Te pasaste ${dinero(-r.restanteVar)}</strong>` : ''}
      </p>
      <p class="hero-nota">Es tu presupuesto de ocio: comidas, novia, amigos, súper y gasolina.</p>
    </section>

    ${pendientes.length > 0 &&
    html`<${Tarjeta} titulo="Pendientes de este mes">
      <ul class="lista">
        ${pendientes.map(
          (p) => html`<li class="fila">
            <div class="fila-txt">
              <span class="fila-tit">${p.tipo === 'fijo' ? (cat.get(p.id) || {}).icono + ' ' : '💳 '}${p.nombre}</span>
              <span class="fila-sub">${p.dia ? `Día ${p.dia}` : p.tipo === 'deuda' ? 'Liquidar deuda' : 'Este mes'}</span>
            </div>
            <span class="fila-monto">${dinero(p.monto)}</span>
            ${p.tipo === 'fijo'
              ? html`<button class="btn btn-chico" onClick=${() => abrirRegistro({ categoria: p.id, monto: p.monto })}>Pagar</button>`
              : html`<button class="btn btn-chico" onClick=${() => {
                  editarConfig((c) => { const d = c.deudas.find((x) => x.id === p.id); if (d) d.pagada = true; });
                  toast('Deuda marcada como pagada', { texto: 'Deshacer', fn: () => editarConfig((c) => { const d = c.deudas.find((x) => x.id === p.id); if (d) d.pagada = false; }) });
                }}>Pagada</button>`}
          </li>`
        )}
      </ul>
    <//>`}

    <${Tarjeta} titulo="Balance del mes" accion=${html`<span class="muted">plan</span>`}>
      <ul class="lista lista-compacta">
        <li class="fila"><span class="fila-txt">Sueldo</span><span class="fila-monto pos">${dinero(r.plan.sueldo)}</span></li>
        ${r.plan.bonos.map((b) => html`<li class="fila"><span class="fila-txt">${b.nombre}</span><span class="fila-monto pos">${dinero(b.monto)}</span></li>`)}
        ${r.extras > 0 && html`<li class="fila"><span class="fila-txt">Ingresos extra</span><span class="fila-monto pos">${dinero(r.extras)}</span></li>`}
        <li class="fila"><span class="fila-txt">Gastos fijos</span><span class="fila-monto">−${dinero(r.compromisoFijos)}</span></li>
        <li class="fila"><span class="fila-txt">Ocio (presupuesto o lo gastado, lo mayor)</span><span class="fila-monto">−${dinero(Math.max(r.plan.variable, r.gastadoVar))}</span></li>
        ${r.plan.totDeudas > 0 && html`<li class="fila"><span class="fila-txt">Liquidar tarjetas</span><span class="fila-monto">−${dinero(r.plan.totDeudas)}</span></li>`}
        <li class="fila"><span class="fila-txt">Ahorro para retiro (${config.ahorro.retiroPct}%)</span><span class="fila-monto">−${dinero(r.plan.retiro)}</span></li>
        <li class="fila fila-total"><span class="fila-txt">${r.ahorroEsperado >= 0 ? 'Ahorro esperado al cierre' : 'Faltante del mes'}</span><span class=${'fila-monto ' + (r.ahorroEsperado >= 0 ? 'pos' : 'neg')}>${dinero(r.ahorroEsperado)}</span></li>
      </ul>
      ${r.ahorroEsperado < 0 && html`<p class="nota-alerta">⚠️ Este mes sale más de lo que entra. La diferencia se toma de tus ahorros.</p>`}
    <//>

    ${r.porCat.size > 0 &&
    html`<${Tarjeta} titulo="¿En qué se fue?" accion=${html`<button class="enlace" onClick=${() => ir('movs')}>Ver todo</button>`}>
      <ul class="lista lista-compacta">
        ${[...r.porCat.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => {
          const c = cat.get(id) || { nombre: 'Otros', icono: '📦' };
          return html`<li class="fila-cat">
            <div class="fila-cat-top"><span>${c.icono} ${c.nombre}</span><span class="num">${dinero(v)}</span></div>
            <${Barra} valor=${v} max=${r.gastadoVar} />
          </li>`;
        })}
      </ul>
    <//>`}

    <${Tarjeta} titulo="Mis metas" accion=${html`<button class="enlace" onClick=${() => ir('ahorro')}>Ahorros</button>`}>
      <div class="meta">
        <div class="meta-top"><span>🛟 Fondo de emergencia</span><span class="num">${dinero(metas.fondo)} / ${dinero(config.metas.fondo)}</span></div>
        <${Barra} valor=${metas.fondo} max=${config.metas.fondo} estado="bien" />
        <span class="meta-sub">${proy.hitos.fondo ? `Completo en ${nombreMes(proy.hitos.fondo, true)} según el plan` : 'No se completa en el horizonte del plan'}</span>
      </div>
      <div class="meta">
        <div class="meta-top"><span>🏡 Enganche de casa</span><span class="num">${dinero(metas.enganche)} / ${dinero(config.metas.enganche)}</span></div>
        <${Barra} valor=${metas.enganche} max=${config.metas.enganche} estado="bien" />
        <span class="meta-sub">${proy.hitos.enganche ? `Listo en ${nombreMes(proy.hitos.enganche, true)} según el plan` : 'No se alcanza antes de ' + nombreMes(config.horizonte, true)}</span>
      </div>
      <div class="meta">
        <div class="meta-top"><span>🧓 Retiro</span><span class="num">${dinero(metas.retiro)}</span></div>
        <span class="meta-sub">Aportas el ${config.ahorro.retiroPct}% de tu sueldo cada mes</span>
      </div>
      ${proxNegativo &&
      html`<p class="nota-alerta">⚠️ La proyección marca saldo negativo desde ${nombreMes(proxNegativo, true)} (lo más bajo: ${dinero(proy.hitos.minimo.saldo)} en ${nombreMes(proy.hitos.minimo.t, true)}). <button class="enlace" onClick=${() => ir('plan')}>Ver plan</button></p>`}
    <//>

    <${Tarjeta} titulo="Tarjetas" accion=${html`<button class="enlace" onClick=${() => ir('tarjetas')}>Ver</button>`}>
      ${totTarjetas > 0
        ? html`<p class="dato-grande">${dinero(totTarjetas)} <span class="muted">por pagar</span></p>
          <ul class="lista lista-compacta">
            ${tarjetas.map((x) => html`<li class="fila"><span class="fila-txt">💳 ${x.nombre}${x.prox ? html`<span class="fila-sub"> · paga el ${fechaCorta(x.prox.iso)}</span>` : ''}</span><span class="fila-monto">${dinero(x.saldo)}</span></li>`)}
          </ul>`
        : html`<p class="ok">✅ Sin deudas en tarjetas</p>`}
    <//>
  </div>`;
}
