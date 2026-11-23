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

// Monto del presupuesto en `t`: el último "cambio programado" vigente (o el monto base),
// ajustado con la inflación cada enero si así se configuró.
function presupuestoPlan(p, t, esc) {
  let monto = p.monto;
  let base = p.base;
  for (const c of (p.cambios || []).slice().sort((a, b) => (a.desde < b.desde ? -1 : 1))) {
    if (c.desde <= t) {
      monto = c.monto;
      base = c.desde;
    }
  }
  if (!p.crece || !base || t < base) return monto;
  return monto * Math.pow(1 + pct(esc.inflacion), vecesMes(base, t, 1));
}

// ---- Movimientos registrados ----
// La app indica de dónde salen los movimientos; en pruebas no hay ninguno.
let proveedorMovs = () => [];
export function usarMovimientos(fn) {
  proveedorMovs = fn;
}
// Gastos registrados agrupados por mes ('AAAA-MM' → lista).
export function indexarGastos(movs) {
  const idx = new Map();
  for (const m of movs || []) {
    if (m.tipo !== 'gasto' || !m.fecha || m.deleted) continue;
    const t = m.fecha.slice(0, 7);
    if (!idx.has(t)) idx.set(t, []);
    idx.get(t).push(m);
  }
  return idx;
}
const idxPorDefecto = () => indexarGastos(proveedorMovs());

// Lo que consumes en el mes `t`, separado por cómo se paga.
// Lo registrado manda: cada gasto cuenta en la cuenta o tarjeta con que lo pagaste.
// Presupuestos: lo registrado + lo que falta por gastar (si te pasas, cuenta lo real).
// Fijos: si registraste el pago, cuenta el monto real; si no, el planeado.
// `esCorte`: en el mes del cierre los fijos planeados ya están en tus saldos o en las deudas del mes siguiente.
function consumoMes(config, esc, t, idx, esCorte = false) {
  idx = idx || idxPorDefecto();
  const aj = (config.ajustes || {})[t] || {};
  const val = (id, plan) => (aj[id] != null ? aj[id] : plan);
  const gastos = idx.get(t) || [];
  const tarjetaDe = (cuenta) => (cuenta && config.tarjetas.some((k) => k.id === cuenta) ? cuenta : null);
  const nombreDe = (cuenta) => {
    const k = config.tarjetas.find((x) => x.id === cuenta);
    return k ? k.nombre : 'débito';
  };
  const porCuenta = (lista) => {
    const m = new Map();
    for (const g of lista) {
      const k = tarjetaDe(g.cuenta) || 'efectivo';
      m.set(k, (m.get(k) || 0) + (Number(g.monto) || 0));
    }
    return m;
  };
  const pagoDe = (k) => (k === 'efectivo' ? { pago: 'debito', tarjeta: null } : { pago: 'tarjeta', tarjeta: k === '__tarjeta' ? null : k });

  const fijos = [];
  for (const f of config.fijos) {
    const plan = montoFijo(f, t, esc);
    const montoPlan = val(f.id, plan);
    const ajustado = aj[f.id] != null;
    const base = { ref: f.id, nombre: f.nombre, icono: f.icono, dia: f.dia, plan: montoPlan, ajustado };
    const reales = gastos.filter((g) => g.categoria === f.id);
    if (reales.length) {
      for (const [k, monto] of porCuenta(reales)) fijos.push({ ...base, id: f.id + '@' + k, ...pagoDe(k), monto, real: monto, registrado: true, editable: false });
    } else if (!esCorte && (plan > 0 || ajustado)) {
      fijos.push({ ...base, id: f.id, pago: f.pago || 'debito', tarjeta: f.pago === 'tarjeta' ? f.tarjeta || null : null, monto: montoPlan, editable: true });
    }
  }

  const deCategoria = new Map();
  for (const p of config.presupuestos) for (const c of p.categorias) deCategoria.set(c.id, p.id);
  const fijoIds = new Set(config.fijos.map((f) => f.id));
  const huerfanos = gastos.filter((g) => !fijoIds.has(g.categoria) && !deCategoria.has(g.categoria));
  const presupuestos = config.presupuestos.map((p, n) => {
    const montoP = val(p.id, presupuestoPlan(p, t, esc));
    const reales = gastos.filter((g) => deCategoria.get(g.categoria) === p.id || (n === 0 && huerfanos.includes(g)));
    const gastado = reales.reduce((a, g) => a + (Number(g.monto) || 0), 0);
    const porGastar = Math.max(0, montoP - gastado);
    const def = p.pago === 'tarjeta' ? p.tarjeta || '__tarjeta' : 'efectivo';
    const cuentas = porCuenta(reales);
    if (!cuentas.has(def)) cuentas.set(def, 0);
    const items = [...cuentas.entries()].map(([k, real]) => {
      const esDef = k === def;
      return {
        id: esDef ? p.id : p.id + '@' + k, ref: p.id, esPresupuesto: true, icono: p.icono,
        nombre: esDef ? p.nombre : `${p.nombre} (${nombreDe(k)})`,
        ...pagoDe(k),
        real, porGastar: esDef ? porGastar : 0, monto: real + (esDef ? porGastar : 0),
        plan: montoP, presupuesto: montoP, gastado, editable: esDef, ajustado: esDef && aj[p.id] != null,
      };
    });
    return items;
  }).flat();

  const todos = [...fijos, ...presupuestos];
  return {
    fijos,
    presupuestos,
    debito: todos.filter((x) => x.pago !== 'tarjeta'),
    tarjeta: todos.filter((x) => x.pago === 'tarjeta' && x.monto > 0),
  };
}

// Agrupa lo que se paga de tarjetas en un mes, tarjeta por tarjeta.
function agruparPorTarjeta(config, deudas, previo) {
  const grupos = new Map();
  const grupo = (id) => {
    if (!grupos.has(id)) {
      const tj = config.tarjetas.find((x) => x.id === id);
      grupos.set(id, { id, nombre: tj ? tj.nombre : 'Sin tarjeta asignada', dia: tj ? tj.pago : null, deudas: [], consumo: [], total: 0 });
    }
    return grupos.get(id);
  };
  for (const d of deudas) {
    const g = grupo(d.tarjeta || null);
    g.deudas.push(d);
    g.total += d.monto;
  }
  for (const c of previo) {
    if (!c.monto) continue;
    const g = grupo(c.tarjeta || null);
    g.consumo.push(c);
    g.total += c.monto;
  }
  return [...grupos.values()].sort((a, b) => (a.dia || 99) - (b.dia || 99));
}

// Flujo completo de un mes.
// `previo`: lo consumido con tarjeta el mes anterior (se paga este mes), como lista de conceptos.
export function flujoMes(config, t, { esc, previo, idx } = {}) {
  esc = esc || escenarioActivo(config);
  idx = idx || idxPorDefecto();
  const aj = (config.ajustes || {})[t] || {};
  const val = (id, plan) => (aj[id] != null ? aj[id] : plan);

  const sPlan = sueldoPlan(config, esc, t);
  const sueldo = { id: 'sueldo', nombre: 'Sueldo', icono: '💼', plan: sPlan, monto: val('sueldo', sPlan), ajustado: aj.sueldo != null };
  const bonos = bonosPlan(config, esc, t).map((b) => ({ ...b, icono: '🎁', monto: val(b.id, b.plan), ajustado: aj[b.id] != null }));
  const ingresos = sueldo.monto + suma(bonos);

  const consumo = consumoMes(config, esc, t, idx, t <= config.ahorro.fechaCorte);
  if (previo == null) {
    const ant = addMonths(t, -1);
    previo = consumoMes(config, esc, ant, idx, ant <= config.ahorro.fechaCorte).tarjeta;
  }
  const consumoPrevio = suma(previo);
  const deudas = config.deudas.filter((d) => d.mes === t);
  const tPlan = suma(deudas) + consumoPrevio;
  const porTarjeta = agruparPorTarjeta(config, deudas, previo);
  const tarjetas = { id: 'tarjetas', nombre: 'Pago de tarjetas', plan: tPlan, monto: val('tarjetas', tPlan), ajustado: aj.tarjetas != null, deudas, consumoPrevio, previo, porTarjeta };

  const rPlan = sueldo.monto * pct(config.ahorro.retiroPct);
  const retiro = { id: 'retiro', nombre: 'Apartar para retiro', icono: '🧓', plan: rPlan, monto: val('retiro', rPlan), ajustado: aj.retiro != null };

  const salidasDebito = suma(consumo.debito);
  const flujo = ingresos - salidasDebito - tarjetas.monto - retiro.monto;
  return {
    t, sueldo, bonos, ingresos,
    consumo, salidasDebito, tarjetas, retiro,
    consumoTarjeta: suma(consumo.tarjeta), // se paga el mes siguiente
    totBonos: suma(bonos),
    queda: ingresos - salidasDebito - tarjetas.monto, // antes de retiro y rendimientos
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

export function proyectar(config, escOverride, movs) {
  const esc = escOverride || escenarioActivo(config);
  const idx = movs ? indexarGastos(movs) : idxPorDefecto();
  const inicio = addMonths(config.ahorro.fechaCorte, 1);
  const r = Math.pow(1 + pct(esc.rendimiento), 1 / 12) - 1;
  const a = arranque(config);
  let general = a.general;
  let retiro = a.retiro;
  const porPagar = config.ahorro.tarjetasPorPagar || 0;
  // Lo cargado a tarjetas en el mes del cierre se paga el primer mes proyectado.
  let previo = consumoMes(config, esc, config.ahorro.fechaCorte, idx, true).tarjeta;
  if (porPagar) previo = [...previo, { id: 'cierre', nombre: 'Otros cargos del mes de cierre', tarjeta: null, monto: porPagar }];
  const meses = [];
  const hitos = { fondo: null, enganche: null, minimo: { t: null, saldo: Infinity }, negativos: [] };
  const metaTotal = config.metas.fondo + config.metas.enganche;
  if (general >= config.metas.fondo) hitos.fondo = config.ahorro.fechaCorte;
  if (general >= metaTotal) hitos.enganche = config.ahorro.fechaCorte;

  for (const t of rangoMeses(inicio, config.horizonte)) {
    const f = flujoMes(config, t, { esc, previo, idx });
    const saldoInicial = general;
    const rendGeneral = general > 0 ? general * r : 0;
    const rendRetiro = retiro > 0 ? retiro * r : 0;
    general = general + rendGeneral + f.flujo;
    retiro = retiro + rendRetiro + f.retiro.monto;
    previo = f.consumo.tarjeta;
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
