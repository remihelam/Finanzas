// Motor de proyección: calcula, mes a mes, lo que debería entrar, salir y ahorrarse.
// Es puro (no toca la pantalla ni el almacenamiento) para poder probarlo aparte.
import { addMonths, parseYm, vecesMes, rangoMeses } from './fechas.js';

export function escenarioActivo(config) {
  return config.escenarios[config.escenario] || config.escenarios.base;
}

const pct = (x) => (x || 0) / 100;

export function sueldoMes(config, esc, t) {
  const s = config.sueldo;
  if (t < s.base) return s.neto;
  return s.neto * Math.pow(1 + pct(esc.aumento), vecesMes(s.base, t, s.mesAumento || 1));
}

export function bonosMes(config, esc, t) {
  const { y, m } = parseYm(t);
  const out = [];
  for (const b of config.bonos) {
    if (b.mes !== m) continue;
    if (b.desde && t < b.desde) continue;
    if (b.hasta && t > b.hasta) continue;
    if (!b.seguro && !config.incluirInciertos) continue;
    let monto;
    if (b.montosPorAnio && b.montosPorAnio[y] != null) monto = b.montosPorAnio[y];
    else if (b.dias) monto = (sueldoMes(config, esc, t) / 30) * b.dias;
    else monto = b.monto * (b.crece ? Math.pow(1 + pct(esc.aumento), Math.max(0, y - b.anioBase)) : 1);
    out.push({ id: b.id, nombre: b.nombre, monto, seguro: b.seguro });
  }
  return out;
}

export function montoFijo(f, t, esc) {
  if (f.desde && t < f.desde) return 0;
  if (f.hasta && t > f.hasta) return 0;
  const { m } = parseYm(t);
  if (f.frecuencia === 'anual' && f.mes !== m) return 0;
  if (f.overrides && f.overrides[t] != null) return f.overrides[t];
  const a = f.ajuste || { tipo: 'ninguno' };
  const base = f.base || t;
  switch (a.tipo) {
    case 'escalon':
      return f.monto + (a.valor || 0) * vecesMes(base, t, a.mes || 1);
    case 'porcentaje':
      return f.monto * Math.pow(1 + pct(a.valor), vecesMes(base, t, a.mes || 1));
    case 'inflacion':
      return f.monto * Math.pow(1 + pct(esc.inflacion), vecesMes(base, t, 1));
    case 'colegiatura':
      return f.monto * Math.pow(1 + pct(esc.doctorado), vecesMes(base, t, a.mes || 1));
    default:
      return f.monto;
  }
}

export function fijosMes(config, esc, t) {
  return config.fijos
    .map((f) => ({ id: f.id, nombre: f.nombre, dia: f.dia, monto: montoFijo(f, t, esc) }))
    .filter((x) => x.monto > 0);
}

export function variableMes(config, esc, t) {
  const v = config.variable;
  if (!v.crece || t < v.base) return v.monto;
  return v.monto * Math.pow(1 + pct(esc.inflacion), vecesMes(v.base, t, 1));
}

export function deudasMes(config, t, incluirPagadas = false) {
  return config.deudas.filter((d) => d.mes === t && (incluirPagadas || !d.pagada));
}

// Plan completo de un mes (lo que la app espera que pase).
export function planMes(config, t, escOverride) {
  const esc = escOverride || escenarioActivo(config);
  const sueldo = sueldoMes(config, esc, t);
  const bonos = bonosMes(config, esc, t);
  const fijos = fijosMes(config, esc, t);
  const variable = variableMes(config, esc, t);
  const deudas = deudasMes(config, t, true);
  const retiro = sueldo * pct(config.ahorro.retiroPct);
  const totBonos = bonos.reduce((a, b) => a + b.monto, 0);
  const totFijos = fijos.reduce((a, b) => a + b.monto, 0);
  const totDeudas = deudas.reduce((a, b) => a + b.monto, 0);
  const totDeudasPendientes = deudas.filter((d) => !d.pagada).reduce((a, b) => a + b.monto, 0);
  const ingresos = sueldo + totBonos;
  const gastos = totFijos + variable;
  return {
    t, sueldo, bonos, fijos, variable, deudas, retiro,
    totBonos, totFijos, totDeudas, totDeudasPendientes,
    ingresos, gastos,
    flujo: ingresos - gastos - totDeudas - retiro,
  };
}

export function saldosActuales(config) {
  let general = 0;
  let retiro = 0;
  for (const c of config.ahorro.cuentas) {
    if (c.destino === 'retiro') retiro += c.saldo || 0;
    else general += c.saldo || 0;
  }
  return { general, retiro };
}

export function tasaPromedio(config, destino) {
  const cs = config.ahorro.cuentas.filter((c) => (destino === 'retiro') === (c.destino === 'retiro'));
  const tot = cs.reduce((a, c) => a + (c.saldo || 0), 0);
  if (!tot) return null;
  return cs.reduce((a, c) => a + (c.saldo || 0) * (c.tasa || 0), 0) / tot;
}

export function reparto(general, metas) {
  const fondo = Math.min(Math.max(general, 0), metas.fondo);
  const enganche = Math.max(0, general - metas.fondo);
  return { fondo, enganche };
}

// Proyección desde el mes siguiente al corte de saldos hasta el horizonte.
export function proyectar(config, escOverride) {
  const esc = escOverride || escenarioActivo(config);
  const inicio = addMonths(config.ahorro.fechaCorte, 1);
  const r = Math.pow(1 + pct(esc.rendimiento), 1 / 12) - 1;
  let { general, retiro } = saldosActuales(config);
  const meses = [];
  const hitos = { fondo: null, enganche: null, minimo: { t: null, saldo: Infinity }, negativos: [] };
  const metaTotal = config.metas.fondo + config.metas.enganche;
  if (general >= config.metas.fondo) hitos.fondo = config.ahorro.fechaCorte;
  if (general >= metaTotal) hitos.enganche = config.ahorro.fechaCorte;

  for (const t of rangoMeses(inicio, config.horizonte)) {
    const p = planMes(config, t, esc);
    const pendientes = p.totDeudasPendientes;
    const flujo = p.ingresos - p.gastos - pendientes - p.retiro;
    const rendGeneral = general > 0 ? general * r : 0;
    const rendRetiro = retiro > 0 ? retiro * r : 0;
    general = general + rendGeneral + flujo;
    retiro = retiro + rendRetiro + p.retiro;
    const rep = reparto(general, config.metas);
    meses.push({ ...p, flujo, deudasPendientes: pendientes, rendimiento: rendGeneral + rendRetiro, general, retiroSaldo: retiro, ...rep });
    if (!hitos.fondo && general >= config.metas.fondo) hitos.fondo = t;
    if (!hitos.enganche && general >= metaTotal) hitos.enganche = t;
    if (general < hitos.minimo.saldo) hitos.minimo = { t, saldo: general };
    if (general < 0) hitos.negativos.push(t);
  }
  return { esc, inicio, meses, hitos };
}

// Resumen por año calendario.
export function resumenAnual(meses) {
  const porAnio = new Map();
  for (const m of meses) {
    const y = m.t.slice(0, 4);
    const a = porAnio.get(y) || { anio: y, ingresos: 0, gastos: 0, deudas: 0, retiro: 0, flujo: 0, rendimiento: 0, general: 0, retiroSaldo: 0 };
    a.ingresos += m.ingresos;
    a.gastos += m.gastos;
    a.deudas += m.deudasPendientes;
    a.retiro += m.retiro;
    a.flujo += m.flujo;
    a.rendimiento += m.rendimiento;
    a.general = m.general;
    a.retiroSaldo = m.retiroSaldo;
    porAnio.set(y, a);
  }
  return [...porAnio.values()];
}
