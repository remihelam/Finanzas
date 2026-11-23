import { html, Tarjeta, Barra, toast } from '../ui.js';
import { resumenMes, catalogo, saldoTarjeta, proximaFecha, metasActuales, registroHoy, mesDeCierreSugerido } from '../calculos.js';
import { proyectar } from '../proyeccion.js';
import { editarConfig } from '../store.js';
import { dinero, nombreMes, ymActual, fechaCorta, addMonths } from '../fechas.js';

const mesCorto = (t) => nombreMes(t, true).split(' ')[0];

export function Inicio({ config, movs, abrirRegistro, ir }) {
  const t = ymActual();
  const r = resumenMes(config, movs, t);
  const cat = catalogo(config);
  const hora = new Date().getHours();
  const proy = proyectar(config);
  const arr = proy.arranque;
  const sig = proy.meses[0];
  const metas = metasActuales(config);
  const cierre = mesDeCierreSugerido();

  const principal = r.presupuestos.find((p) => p.pago === 'tarjeta') || r.presupuestos[0];
  const otros = r.presupuestos.filter((p) => p !== principal);
  const estadoDe = (p) => (p.gastado > p.monto ? 'critico' : p.gastado > p.monto * 0.85 ? 'alerta' : 'bien');
  const porDia = principal && r.diasRestantes > 0 ? principal.restante / r.diasRestantes : 0;

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

  const tarjetas = config.tarjetas.map((tj) => ({ ...tj, ...saldoTarjeta(config, movs, tj.id), prox: proximaFecha(tj.pago) })).filter((x) => x.saldo > 0);
  const totTarjetas = tarjetas.reduce((a, x) => a + x.saldo, 0);
  const proxNegativo = proy.hitos.negativos[0];

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
        Gastado ${dinero(principal.gastado)} de ${dinero(principal.monto)}
        ${r.diasRestantes > 0 && principal.restante > 0 ? html` · <strong>${dinero(porDia)}</strong> por día los próximos ${r.diasRestantes} días` : ''}
        ${principal.restante < 0 ? html` · <strong>Te pasaste ${dinero(-principal.restante)}</strong>` : ''}
      </p>
      <p class="hero-nota">${principal.pago === 'tarjeta' ? `Lo que gastes con tarjeta en ${mesCorto(t)} lo pagas en ${mesCorto(addMonths(t, 1))}.` : 'Sale de tu cuenta este mismo mes.'}</p>
      ${otros.map((p) => html`<div class="mini-presu">
        <div class="meta-top"><span>${p.nombre}</span><span class="num">${dinero(p.gastado)} / ${dinero(p.monto)}</span></div>
        <${Barra} valor=${p.gastado} max=${p.monto} estado=${estadoDe(p)} />
      </div>`)}
    </section>`}

    <${Tarjeta} titulo="Tu dinero" accion=${html`<button class="enlace" onClick=${() => ir('ahorro')}>Actualizar</button>`}>
      <ul class="lista lista-compacta">
        <li class="fila"><span class="fila-txt">En tus cuentas al cierre de ${nombreMes(config.ahorro.fechaCorte, true)}</span><span class="fila-monto">${dinero(arr.enCuentas)}</span></li>
        ${(config.ahorro.pendientes || []).map((p) => html`<li class="fila"><span class="fila-txt fila-sub">Falta pagar: ${p.nombre}</span><span class="fila-monto">−${dinero(p.monto)}</span></li>`)}
        <li class="fila fila-total"><span class="fila-txt">Arrancas ${nombreMes(addMonths(config.ahorro.fechaCorte, 1), true)} con</span><span class="fila-monto">${dinero(arr.general)}</span></li>
      </ul>
    <//>

    ${sig && html`<${Tarjeta} titulo=${'Así cierra ' + nombreMes(sig.t, true)} accion=${html`<button class="enlace" onClick=${() => ir('meses')}>Mes por mes</button>`}>
      <ul class="lista lista-compacta">
        <li class="fila"><span class="fila-txt">Arrancas con</span><span class="fila-monto">${dinero(sig.saldoInicial)}</span></li>
        <li class="fila"><span class="fila-txt">Entra (sueldo${sig.bonos.length ? ' y bonos' : ''})</span><span class="fila-monto pos">+${dinero(sig.ingresos)}</span></li>
        <li class="fila"><span class="fila-txt">Gastos del mes (renta, doctorado…)</span><span class="fila-monto">−${dinero(sig.salidasDebito)}</span></li>
        <li class="fila"><span class="fila-txt">Pago de tarjetas</span><span class="fila-monto">−${dinero(sig.tarjetas.monto)}</span></li>
        <li class="fila fila-total"><span class="fila-txt">Te queda</span><span class=${'fila-monto ' + (sig.saldoInicial + sig.ingresos - sig.salidasDebito - sig.tarjetas.monto < 0 ? 'neg' : '')}>${dinero(sig.saldoInicial + sig.ingresos - sig.salidasDebito - sig.tarjetas.monto)}</span></li>
        <li class="fila"><span class="fila-txt fila-sub">Apartas para retiro · rendimientos</span><span class="fila-monto fila-sub">−${dinero(sig.retiro.monto)} · +${dinero(sig.rendimiento)}</span></li>
        <li class="fila"><span class="fila-txt"><strong>Ahorro al cierre</strong></span><span class=${'fila-monto ' + (sig.general < 0 ? 'neg' : 'pos')}>${dinero(sig.general)}</span></li>
      </ul>
    <//>`}

    ${pendientes.length > 0 &&
    html`<${Tarjeta} titulo=${'Pendientes de ' + mesCorto(t)}>
      <ul class="lista">
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

    ${r.porCat.size > 0 &&
    html`<${Tarjeta} titulo="¿En qué se fue?" accion=${html`<button class="enlace" onClick=${() => ir('movs')}>Ver todo</button>`}>
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

    <${Tarjeta} titulo="Mis metas" accion=${html`<button class="enlace" onClick=${() => ir('plan')}>Plan</button>`}>
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
        <span class="meta-sub">Apartas el ${config.ahorro.retiroPct}% de tu sueldo cada mes</span>
      </div>
      ${proxNegativo &&
      html`<p class="nota-alerta">⚠️ En ${nombreMes(proxNegativo, true)} tu saldo queda en negativo (lo más bajo: ${dinero(proy.hitos.minimo.saldo)} en ${nombreMes(proy.hitos.minimo.t, true)}). <button class="enlace" onClick=${() => ir('meses')}>Revisar mes por mes</button></p>`}
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
