// Normaliza la configuración a la forma actual (sin perder datos de versiones anteriores).
// No cambia `updatedAt`: migrar no cuenta como una edición del usuario.
export function migrar(c) {
  if (!c) return c;
  const x = { ...c };
  if (!x.presupuestos) {
    const v = x.variable || { monto: 0, crece: true, categorias: [] };
    x.presupuestos = [{ id: 'p-ocio', nombre: 'Ocio', monto: v.monto, pago: 'tarjeta', crece: v.crece !== false, base: v.base, categorias: v.categorias || [] }];
  }
  x.presupuestos = x.presupuestos.map((p) => ({ cambios: [], ...p }));
  delete x.variable;
  x.fijos = (x.fijos || []).map((f) => ({ pago: 'debito', ...f }));
  x.ajustes = x.ajustes || {};
  x.ahorro = { pendientes: [], tarjetasPorPagar: 0, ...x.ahorro };
  return x;
}

// Todas las categorías de gasto variable (de todos los presupuestos).
export function categoriasVariables(config) {
  return config.presupuestos.flatMap((p) => p.categorias.map((c) => ({ ...c, presupuesto: p.id })));
}

export function presupuestoDeCategoria(config, catId) {
  const p = config.presupuestos.find((x) => x.categorias.some((c) => c.id === catId));
  return p ? p.id : null;
}

// Mes al que "pertenece" un gasto para presupuesto y tarjeta.
// Normalmente es el mes de la compra; si se paga en un mes posterior (compra después del corte),
// cuenta como consumo del mes anterior al pago (mes vencido).
export function mesConsumo(m) {
  if (m.pagoMes) {
    const [y, mm] = m.pagoMes.split('-').map(Number);
    const total = y * 12 + (mm - 1) - 1;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  }
  return m.fecha.slice(0, 7);
}

// Mes en que se paga una compra con tarjeta: el que elegiste, o el que toca según el día de corte.
export function mesDePagoAuto(config, cuenta, fecha) {
  const tj = config.tarjetas.find((x) => x.id === cuenta);
  if (!tj) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  const salto = tj.corte && d > tj.corte ? 2 : 1;
  const total = y * 12 + (m - 1) + salto;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
