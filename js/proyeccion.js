// Motor de proyección en FLUJO DE EFECTIVO, con tarjetas a mes vencido:
// lo que consumes con tarjeta en un mes sale de tu cuenta al mes siguiente.
// Es puro (no toca pantalla ni almacenamiento) para poder probarlo aparte.
import { addMonths, parseYm, vecesMes, rangoMeses } from './fechas.js';

export function escenarioActivo(config) {
  return config.escenarios[config.escenario] || config.escenarios.base;
}

const pct = (x) => (x || 0) / 100;
const suma = (xs) => xs.reduce((a, x) => a + (x.monto || 0), 0);

export function sueldoPlan(config, esc, t) {
  const s = config.sueldo;
  if (t < s.base) return s.neto;
  return s.neto * Math.pow(1 + pct(esc.aumento), vecesMes(s.base, t, s.mesAumento || 1));
}

function bonosPlan(config, esc, t) {
  const { y, m } = parseYm(t);
  const out = [];
  for (const b of config.bonos) {
    if (b.mes !== m) continue;
    if (b.desde && t < b.desde) continue;
    if (b.hasta && t > b.hasta) continue;
    if (!b.seguro && !config.incluirInciertos) continue;
    let monto;
    if (b.montosPorAnio && b.montosPorAnio[y] != null) monto = b.montosPorAnio[y];
    else if (b.dias) monto = (sueldoPlan(config, esc, t) / 30) * b.dias;
    else monto = b.monto * (b.crece ? Math.pow(1 + pct(esc.aumento), Math.max(0, y - b.anioBase)) : 1);
    out.push({ id: b.id, nombre: b.nombre, plan: monto, seguro: b.seguro });
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

function presupuestoPlan(p, t, esc) {
  if (!p.crece || !p.base || t < p.base) return p.monto;
  return p.monto * Math.pow(1 + pct(esc.inflacion), vecesMes(p.base, t, 1));
}

// Lo que consumes en el mes `t` (fijos + presupuestos), separado por cómo se paga.
function consumoMes(config, esc, t) {
  const aj = (config.ajustes || {})[t] || {};
  const val = (id, plan) => (aj[id] != null ? aj[id] : plan);
  const fijos = config.fijos
    .map((f) => {
      const plan = montoFijo(f, t, esc);
      return { id: f.id, nombre: f.nombre, icono: f.icono, dia: f.dia, pago: f.pago || 'debito', plan, monto: val(f.id, plan), ajustado: aj[f.id] != null };
    })
    .filter((x) => x.plan > 0 || x.ajustado);
  const presupuestos = config.presupuestos.map((p) => {
    const plan = presupuestoPlan(p, t, esc);
    return { id: p.id, nombre: p.nombre, pago: p.pago || 'debito', plan, monto: val(p.id, plan), ajustado: aj[p.id] != null, esPresupuesto: true };
  });
  const todos = [...fijos, ...presupuestos];
  return {
    fijos,
    presupuestos,
    debito: todos.filter((x) => x.pago !== 'tarjeta'),
    tarjeta: todos.filter((x) => x.pago === 'tarjeta'),
  };
}

// Flujo completo de un mes.
// `consumoPrevio`: lo consumido con tarjeta el mes anterior (se paga este mes).
export function flujoMes(config, t, { esc, consumoPrevio } = {}) {
  esc = esc || escenarioActivo(config);
  const aj = (config.ajustes || {})[t] || {};
  const val = (id, plan) => (aj[id] != null ? aj[id] : plan);

  const sPlan = sueldoPlan(config, esc, t);
  const sueldo = { id: 'sueldo', nombre: 'Sueldo', plan: sPlan, monto: val('sueldo', sPlan), ajustado: aj.sueldo != null };
  const bonos = bonosPlan(config, esc, t).map((b) => ({ ...b, monto: val(b.id, b.plan), ajustado: aj[b.id] != null }));
  const ingresos = sueldo.monto + suma(bonos);

  const consumo = consumoMes(config, esc, t);
  if (consumoPrevio == null) consumoPrevio = suma(consumoMes(config, esc, addMonths(t, -1)).tarjeta);
  const deudas = config.deudas.filter((d) => d.mes === t);
  const tPlan = suma(deudas) + consumoPrevio;
  const tarjetas = { id: 'tarjetas', nombre: 'Pago de tarjetas', plan: tPlan, monto: val('tarjetas', tPlan), ajustado: aj.tarjetas != null, deudas, consumoPrevio };

  const rPlan = sueldo.monto * pct(config.ahorro.retiroPct);
  const retiro = { id: 'retiro', nombre: 'Apartar para retiro', plan: rPlan, monto: val('retiro', rPlan), ajustado: aj.retiro != null };

  const salidasDebito = suma(consumo.debito);
  const flujo = ingresos - salidasDebito - tarjetas.monto - retiro.monto;
  return {
    t, sueldo, bonos, ingresos,
    consumo, salidasDebito, tarjetas, retiro,
    consumoTarjeta: suma(consumo.tarjeta), // se paga el mes siguiente
    totBonos: suma(bonos),
    flujo,
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

// Dinero con el que arranca el mes siguiente al corte: cuentas − lo que aún falta pagar ese mes.
export function arranque(config) {
  const s = saldosActuales(config);
  const pendientes = (config.ahorro.pendientes || []).reduce((a, p) => a + (p.monto || 0), 0);
  return { ...s, pendientes, general: s.general - pendientes, enCuentas: s.general };
}

export function reparto(general, metas) {
  const fondo = Math.min(Math.max(general, 0), metas.fondo);
  const enganche = Math.max(0, general - metas.fondo);
  return { fondo, enganche };
}

export function proyectar(config, escOverride) {
  const esc = escOverride || escenarioActivo(config);
  const inicio = addMonths(config.ahorro.fechaCorte, 1);
  const r = Math.pow(1 + pct(esc.rendimiento), 1 / 12) - 1;
  const a = arranque(config);
  let general = a.general;
  let retiro = a.retiro;
  let consumoPrevio = config.ahorro.tarjetasPorPagar || 0;
  const meses = [];
  const hitos = { fondo: null, enganche: null, minimo: { t: null, saldo: Infinity }, negativos: [] };
  const metaTotal = config.metas.fondo + config.metas.enganche;
  if (general >= config.metas.fondo) hitos.fondo = config.ahorro.fechaCorte;
  if (general >= metaTotal) hitos.enganche = config.ahorro.fechaCorte;

  for (const t of rangoMeses(inicio, config.horizonte)) {
    const f = flujoMes(config, t, { esc, consumoPrevio });
    const saldoInicial = general;
    const rendGeneral = general > 0 ? general * r : 0;
    const rendRetiro = retiro > 0 ? retiro * r : 0;
    general = general + rendGeneral + f.flujo;
    retiro = retiro + rendRetiro + f.retiro.monto;
    consumoPrevio = f.consumoTarjeta;
    meses.push({ ...f, saldoInicial, rendimiento: rendGeneral, rendRetiro, general, retiroSaldo: retiro, ...reparto(general, config.metas) });
    if (!hitos.fondo && general >= config.metas.fondo) hitos.fondo = t;
    if (!hitos.enganche && general >= metaTotal) hitos.enganche = t;
    if (general < hitos.minimo.saldo) hitos.minimo = { t, saldo: general };
    if (general < 0) hitos.negativos.push(t);
  }
  return { esc, inicio, meses, hitos, arranque: a };
}

export function resumenAnual(meses) {
  const porAnio = new Map();
  for (const m of meses) {
    const y = m.t.slice(0, 4);
    const a = porAnio.get(y) || { anio: y, ingresos: 0, salidas: 0, retiro: 0, flujo: 0, rendimiento: 0, general: 0, retiroSaldo: 0 };
    a.ingresos += m.ingresos;
    a.salidas += m.salidasDebito + m.tarjetas.monto;
    a.retiro += m.retiro.monto;
    a.flujo += m.flujo;
    a.rendimiento += m.rendimiento;
    a.general = m.general;
    a.retiroSaldo = m.retiroSaldo;
    porAnio.set(y, a);
  }
  return [...porAnio.values()];
}
