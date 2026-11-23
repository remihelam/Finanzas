// Genera un archivo de calendario (.ics) con recordatorios recurrentes.
function stamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}
function local(fecha, hora) {
  return `${fecha.replace(/-/g, '')}T${hora.replace(':', '')}00`;
}
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function primerDia(dia) {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth(), dia);
  if (x < d) x.setMonth(x.getMonth() + 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function evento({ id, titulo, desc, inicio, rrule, alarma = 'PT0M' }) {
  return [
    'BEGIN:VEVENT',
    `UID:${id}@finanzas-app`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${inicio}`,
    'DURATION:PT10M',
    `RRULE:${rrule}`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:${desc}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${titulo}`,
    `TRIGGER:${alarma}`,
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

export function generarIcs(config) {
  const hora = (config.recordatorio && config.recordatorio.hora) || '21:30';
  const ev = [];
  ev.push(evento({ id: 'diario', titulo: '📝 Registra tus gastos del día', desc: 'Abre la app de finanzas y registra lo que gastaste hoy.', inicio: local(hoy(), hora), rrule: 'FREQ=DAILY' }));
  ev.push(evento({ id: 'cierre', titulo: '📅 Cierre de mes: actualiza tus saldos', desc: 'Anota cuánto tienes en Nu, Revolut, DiDi y tu cuenta de nómina.', inicio: local(primerDia(1), '10:00'), rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' }));
  for (const t of config.tarjetas) {
    if (!t.pago) continue;
    const d = Math.min(t.pago, 28);
    ev.push(evento({ id: `tarjeta-${t.id}`, titulo: `💳 Pagar ${t.nombre}`, desc: `Fecha límite de pago de ${t.nombre}. Paga el total para no generar intereses.`, inicio: local(primerDia(d), '09:00'), rrule: `FREQ=MONTHLY;BYMONTHDAY=${d}`, alarma: '-P2D' }));
  }
  for (const f of config.fijos) {
    if (!f.dia || f.frecuencia !== 'mensual') continue;
    const d = Math.min(f.dia, 28);
    let rrule = `FREQ=MONTHLY;BYMONTHDAY=${d}`;
    if (f.hasta) rrule += `;UNTIL=${f.hasta.replace('-', '')}28T235959Z`;
    ev.push(evento({ id: `fijo-${f.id}`, titulo: `${f.icono || '📌'} Pagar ${f.nombre}`, desc: `Pago mensual de ${f.nombre}.`, inicio: local(primerDia(d), '09:00'), rrule, alarma: '-P1D' }));
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Finanzas personales//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Finanzas', ...ev, 'END:VCALENDAR'].join('\r\n');
}
