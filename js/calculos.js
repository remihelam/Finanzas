// Cálculos sobre lo real (movimientos registrados) comparado con el plan.
import { flujoMes, proyectar, saldosActuales, reparto, arranque, indexarGastos, escenarioActivo, montoFijo } from './proyeccion.js';
import { categoriasVariables, mesConsumo } from './modelo.js';
import { diasEnMes, hoyIso, ymActual, addMonths, nombreMes, dinero } from './fechas.js';

const suma = (xs) => xs.reduce((a, m) => a + (Number(m.monto) || 0), 0);

export function catalogo(config) {
  const cat = new Map();
  for (const c of categoriasVariables(config)) cat.set(c.id, { ...c, grupo: 'variable' });
  for (const f of config.fijos) cat.set(f.id, { id: f.id, nombre: f.nombre, icono: f.icono || '📌', grupo: 'fijo' });
  cat.set('i-sueldo', { id: 'i-sueldo', nombre: 'Quincena', icono: '💼', grupo: 'ingreso' });
  for (const b of config.bonos) cat.set(b.id, { id: b.id, nombre: b.nombre, icono: '🎁', grupo: 'ingreso' });
  cat.set('i-extra', { id: 'i-extra', nombre: 'Ingreso extra', icono: '➕', grupo: 'ingreso' });
  return cat;
}

export function cuentasPago(config) {
  return [{ id: 'efectivo', nombre: 'Débito / efectivo', icono: '💵' }, ...config.tarjetas.map((t) => ({ ...t, icono: '💳' }))];
}

export function nombreCuenta(config, id) {
  const c = cuentasPago(config).find((x) => x.id === id);
  return c ? c.nombre : id || '—';
}

// Flujo de un mes: si cae dentro de la proyección, trae su saldo inicial real.
export function flujoDelMes(config, t, proy) {
  if (t > config.ahorro.fechaCorte) {
    const p = proy || proyectar(config);
    const m = p.meses.find((x) => x.t === t);
    if (m) return m;
  }
  return flujoMes(config, t);
}

export function resumenMes(config, movs, t) {
  const idx = indexarGastos(movs);
  const f = flujoMes(config, t, { idx });
  const delMes = movs.filter((m) => m.fecha && (m.tipo === 'gasto' ? mesConsumo(m) === t : m.fecha.startsWith(t)));
  const gastos = delMes.filter((m) => m.tipo === 'gasto');
  const fijoIds = new Set(config.fijos.map((x) => x.id));

  // Un renglón por presupuesto (aunque lo hayas pagado con varias tarjetas).
  const presupuestos = config.presupuestos.map((p) => {
    const items = f.consumo.presupuestos.filter((x) => x.ref === p.id);
    const def = items.find((x) => x.editable) || items[0] || {};
    const monto = def.presupuesto || 0;
    const gastado = def.gastado || 0;
    const porCuenta = items.filter((x) => x.real > 0).sort((a, b) => a.fueraDeHabitual - b.fueraDeHabitual || b.real - a.real).map((x) => ({ nombre: x.fueraDeHabitual ? (x.pago === 'tarjeta' ? (config.tarjetas.find((k) => k.id === x.tarjeta) || {}).nombre || 'Tarjeta' : 'Débito') : x.habitual, monto: x.real }));
    return { id: p.id, nombre: p.nombre, pago: p.pago, tarjeta: p.tarjeta, monto, gastado, restante: monto - gastado, porCuenta };
  });

  const porCat = new Map();
  for (const m of gastos.filter((x) => !fijoIds.has(x.categoria))) porCat.set(m.categoria, (porCat.get(m.categoria) || 0) + Number(m.monto));

  // Un renglón por gasto fijo del mes: pagado si ya registraste su pago.
  const fijos = config.fijos
    .map((cf) => {
      const plan = flujoPlanFijo(f, cf.id, config, t);
      const real = suma(gastos.filter((m) => m.categoria === cf.id));
      if (!plan && !real) return null;
      return { id: cf.id, nombre: cf.nombre, icono: cf.icono, dia: cf.dia, pago: cf.pago || 'debito', tarjeta: cf.tarjeta, monto: plan || real, real, pagado: real > 0 };
    })
    .filter(Boolean);

  let diasRestantes = diasEnMes(t);
  if (t === ymActual()) diasRestantes = diasEnMes(t) - Number(hoyIso().slice(8, 10)) + 1;
  else if (t < ymActual()) diasRestantes = 0;

  return { t, flujo: f, movs: delMes, presupuestos, fijos, porCat, diasRestantes, totalGastos: suma(gastos) };
}

// Monto planeado de un fijo en el mes (aunque en el mes del cierre no cuente para la proyección).
function flujoPlanFijo(f, id, config, t) {
  const it = f.consumo.fijos.find((x) => x.ref === id);
  if (it) return it.plan;
  const cf = config.fijos.find((x) => x.id === id);
  const esc = escenarioActivo(config);
  const aj = ((config.ajustes || {})[t] || {})[id];
  return aj != null ? aj : montoFijo(cf, t, esc);
}

export function saldoTarjeta(config, movs, tarjetaId) {
  const deudas = config.deudas.filter((d) => d.tarjeta === tarjetaId && !d.pagada);
  const compras = suma(movs.filter((m) => m.tipo === 'gasto' && m.cuenta === tarjetaId));
  const pagos = suma(movs.filter((m) => m.tipo === 'pago' && m.cuenta === tarjetaId));
  return { deudas, deudaPlan: suma(deudas), compras, pagos, saldo: Math.max(0, suma(deudas) + compras - pagos) };
}

export function proximaFecha(dia) {
  if (!dia) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(dia, 28));
  if (d < hoy) d.setMonth(d.getMonth() + 1);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { iso, dias: Math.round((d - hoy) / 86400000) };
}

export function metasActuales(config) {
  const a = arranque(config);
  return { ...a, ...reparto(a.general, config.metas) };
}

export function registroHoy(movs) {
  const hoy = hoyIso();
  return movs.some((m) => m.fecha === hoy || (m.creado && new Date(m.creado).toISOString().slice(0, 10) === hoy));
}

// Mes cuyo cierre conviene capturar: el anterior durante los primeros 10 días, si no el actual.
export function mesDeCierreSugerido() {
  const t = ymActual();
  const dia = Number(hoyIso().slice(8, 10));
  return dia <= 10 ? addMonths(t, -1) : t;
}

// Pagos de débito y deudas de un mes que aún no se registran como pagados (sugerencia para el cierre).
export function pendientesSugeridos(config, movs, t) {
  const r = resumenMes(config, movs, t);
  const out = r.fijos.filter((x) => x.pago !== 'tarjeta' && !x.pagado && x.monto > 0).map((x) => ({ nombre: `${x.nombre} de ${nombreMes(t, true)}`, monto: Math.round(x.monto) }));
  for (const d of config.deudas.filter((x) => x.mes === t && !x.pagada)) {
    const tj = config.tarjetas.find((x) => x.id === d.tarjeta);
    out.push({ nombre: `${tj ? tj.nombre : 'Tarjeta'}: ${d.concepto}`, monto: d.monto });
  }
  return out;
}

// Mes cuyos pagos de tarjeta conviene mostrar: el actual, o el primero después del cierre.
export function mesDeTarjetas(config) {
  const t = ymActual();
  return t > config.ahorro.fechaCorte ? t : addMonths(config.ahorro.fechaCorte, 1);
}

// Forma de pago sugerida para una categoría: la tarjeta asignada a su presupuesto o gasto fijo.
export function pagoSugerido(config, catId) {
  const p = config.presupuestos.find((x) => x.categorias.some((c) => c.id === catId));
  const f = config.fijos.find((x) => x.id === catId);
  const item = p || f;
  if (!item) return null;
  if (item.pago === 'tarjeta') return item.tarjeta || null;
  return 'efectivo';
}

// Texto de apoyo para un concepto: registrado vs. por gastar, o "registrado" si ya lo pagaste.
export function detalleConsumo(x) {
  if (x.esPresupuesto && x.fueraDeHabitual) return `De tu presupuesto (lo usual es ${x.habitual})`;
  if (x.esPresupuesto && x.cerrado) {
    const partes = [`Mes cerrado: registrado ${dinero(x.real)}`];
    if (x.noGastado) partes.push(`no gastaste ${dinero(x.noGastado)} (se queda en tu ahorro)`);
    for (const o of x.otras || []) partes.push(`${dinero(o.monto)} pagado con ${o.nombre}`);
    return partes.join(' · ');
  }
  if (x.esPresupuesto) {
    const partes = [];
    if (x.real) partes.push(`registrado ${dinero(x.real)}`);
    if (x.real || x.otras.length) partes.push(`por gastar ${dinero(x.porGastar)}`);
    else partes.push(`presupuesto ${dinero(x.presupuesto)}`);
    for (const o of x.otras || []) partes.push(`${dinero(o.monto)} pagado con ${o.nombre}`);
    const txt = partes.join(' · ');
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }
  if (x.registrado) return 'Pago registrado';
  return null;
}


export { saldosActuales };
