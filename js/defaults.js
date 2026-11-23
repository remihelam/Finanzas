// Configuración inicial vacía (para empezar desde cero o para un dispositivo nuevo).
import { ymActual } from './fechas.js';

export function configVacia() {
  const t = ymActual();
  return {
    horizonte: `${Number(t.slice(0, 4)) + 7}-12`,
    sueldo: { neto: 0, base: t, mesAumento: 1 },
    bonos: [],
    fijos: [],
    variable: {
      monto: 0, crece: true, base: t,
      categorias: [
        { id: 'c-comidas', nombre: 'Comidas', icono: '🍽️' },
        { id: 'c-super', nombre: 'Súper', icono: '🛒' },
        { id: 'c-gasolina', nombre: 'Gasolina', icono: '⛽' },
        { id: 'c-salidas', nombre: 'Salidas', icono: '🍻' },
        { id: 'c-otros', nombre: 'Otros', icono: '📦' },
      ],
    },
    tarjetas: [],
    deudas: [],
    ahorro: { fechaCorte: t, retiroPct: 5, cuentas: [{ id: 'a-general', nombre: 'Ahorro', saldo: 0, tasa: 8, destino: 'general' }], historial: {} },
    metas: { fondo: 150000, enganche: 1000000 },
    escenarios: {
      conservador: { nombre: 'Conservador', aumento: 3, inflacion: 5, rendimiento: 7, doctorado: 8 },
      base: { nombre: 'Base', aumento: 4.5, inflacion: 4, rendimiento: 8.5, doctorado: 5 },
      optimista: { nombre: 'Optimista', aumento: 6, inflacion: 3.5, rendimiento: 10, doctorado: 3 },
    },
    escenario: 'base',
    incluirInciertos: false,
    recordatorio: { hora: '21:30' },
  };
}
