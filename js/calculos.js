// Cálculos sobre lo real (movimientos registrados) comparado con el plan.
import { planMes, saldosActuales, reparto } from './proyeccion.js';
import { diasEnMes, hoyIso, ymActual, parseYm } from './fechas.js';

const suma = (xs) => xs.reduce((a, m) => a + (Number(m.monto) || 0), 0);

export function catalogo(config) {
  const cat = new Map();
  for (const c of config.variable.categorias) cat.set(c.id, { ...c, grupo: 'variable' });
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

export function resumenMes(config, movs, t) {
  const plan = planMes(config, t);
  const delMes = movs.filter((m) => m.fecha && m.fecha.startsWith(t));
  const fijoIds = new Set(config.fijos.map((f) => f.id));
  const gastos = delMes.filter((m) => m.tipo === 'gasto');
  const gastosVar = gastos.filter((m) => !fijoIds.has(m.categoria));
  const gastadoVar = suma(gastosVar);

  const porCat = new Map();
  for (const m of gastosVar) porCat.set(m.categoria, (porCat.get(m.categoria) || 0) + Number(m.monto));

  const fijos = plan.fijos.map((f) => {
    const real = suma(gastos.filter((m) => m.categoria === f.id));
    return { ...f, real, pagado: real > 0 };
  });
  // Fijos pagados este mes que el plan no esperaba (p. ej. un pago adelantado)
  for (const f of config.fijos) {
    if (fijos.some((x) => x.id === f.id)) continue;
    const real = suma(gastos.filter((m) => m.categoria === f.id));
    if (real > 0) fijos.push({ id: f.id, nombre: f.nombre, dia: f.dia, monto: 0, real, pagado: true });
  }

  const ingresosReg = delMes.filter((m) => m.tipo === 'ingreso');
  const extras = suma(ingresosReg.filter((m) => m.categoria === 'i-extra'));
  const ingresos = plan.ingresos + extras;
  const compromisoFijos = fijos.reduce((a, f) => a + Math.max(f.monto, f.real), 0);
  const restanteVar = plan.variable - gastadoVar;

  let diasRestantes = diasEnMes(t);
  if (t === ymActual()) diasRestantes = diasEnMes(t) - Number(hoyIso().slice(8, 10)) + 1;
  else if (t < ymActual()) diasRestantes = 0;

  const ahorroEsperado = ingresos - compromisoFijos - Math.max(plan.variable, gastadoVar) - plan.totDeudas - plan.retiro;

  return {
    t, plan, movs: delMes, gastadoVar, porCat, fijos, extras, ingresos, ingresosReg,
    compromisoFijos, restanteVar, diasRestantes,
    porDia: diasRestantes > 0 ? restanteVar / diasRestantes : 0,
    ahorroEsperado,
    totalGastos: suma(gastos),
  };
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
  const s = saldosActuales(config);
  return { ...s, ...reparto(s.general, config.metas) };
}

export function registroHoy(movs) {
  const hoy = hoyIso();
  return movs.some((m) => m.fecha === hoy || (m.creado && new Date(m.creado).toISOString().slice(0, 10) === hoy));
}

// Mes cuyo cierre conviene capturar: el anterior durante los primeros 10 días, si no el actual.
export function mesDeCierreSugerido() {
  const t = ymActual();
  const { y, m } = parseYm(t);
  const dia = Number(hoyIso().slice(8, 10));
  if (dia <= 10) return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  return t;
}
