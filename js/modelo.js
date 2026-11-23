// Normaliza la configuración a la forma actual (sin perder datos de versiones anteriores).
// No cambia `updatedAt`: migrar no cuenta como una edición del usuario.
export function migrar(c) {
  if (!c) return c;
  const x = { ...c };
  if (!x.presupuestos) {
    const v = x.variable || { monto: 0, crece: true, categorias: [] };
    x.presupuestos = [{ id: 'p-ocio', nombre: 'Ocio', monto: v.monto, pago: 'tarjeta', crece: v.crece !== false, base: v.base, categorias: v.categorias || [] }];
  }
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
