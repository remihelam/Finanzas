// Componentes compartidos de la interfaz.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';

export { html, useState, useEffect, useRef };

// ---- Avisos breves (toast) ----
let pushToast = null;
export function toast(texto, accion) {
  if (pushToast) pushToast({ texto, accion, id: Math.random() });
}
export function Toasts() {
  const [t, setT] = useState(null);
  useEffect(() => {
    pushToast = (x) => setT(x);
  }, []);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), t.accion ? 5000 : 2500);
    return () => clearTimeout(h);
  }, [t]);
  if (!t) return null;
  return html`<div class="toast" role="status">
    <span>${t.texto}</span>
    ${t.accion && html`<button class="toast-btn" onClick=${() => { t.accion.fn(); setT(null); }}>${t.accion.texto}</button>`}
  </div>`;
}

// ---- Hoja deslizable (modal) ----
export function Hoja({ titulo, onCerrar, children, completa }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', k);
    document.body.classList.add('con-hoja');
    return () => {
      window.removeEventListener('keydown', k);
      document.body.classList.remove('con-hoja');
    };
  }, []);
  return html`<div class="hoja-fondo" onClick=${(e) => e.target === e.currentTarget && onCerrar()}>
    <div class=${'hoja' + (completa ? ' hoja-completa' : '')} role="dialog" aria-modal="true" aria-label=${titulo}>
      <div class="hoja-cab">
        <h2>${titulo}</h2>
        <button class="icono-btn" aria-label="Cerrar" onClick=${onCerrar}>✕</button>
      </div>
      <div class="hoja-cuerpo">${children}</div>
    </div>
  </div>`;
}

export function Barra({ valor, max, estado }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (valor / max) * 100)) : 0;
  return html`<div class="barra" role="progressbar" aria-valuenow=${Math.round(p)} aria-valuemin="0" aria-valuemax="100">
    <div class=${'barra-relleno ' + (estado || '')} style=${`width:${p}%`}></div>
  </div>`;
}

export function Seg({ opciones, valor, onCambio, etiqueta }) {
  return html`<div class="seg" role="radiogroup" aria-label=${etiqueta}>
    ${opciones.map(
      (o) => html`<button role="radio" aria-checked=${o.valor === valor} class=${o.valor === valor ? 'activo' : ''} onClick=${() => onCambio(o.valor)}>${o.texto}</button>`
    )}
  </div>`;
}

export function Campo({ etiqueta, ayuda, children }) {
  return html`<label class="campo"><span class="campo-etq">${etiqueta}</span>${children}${ayuda && html`<span class="campo-ayuda">${ayuda}</span>`}</label>`;
}

// Entrada numérica que acepta texto vacío mientras se escribe.
export function Num({ valor, onCambio, paso, min, placeholder }) {
  return html`<input type="number" inputmode="decimal" step=${paso || 'any'} min=${min} placeholder=${placeholder}
    value=${valor ?? ''} onInput=${(e) => onCambio(e.target.value === '' ? null : Number(e.target.value))} />`;
}

export function Tarjeta({ titulo, accion, children, clase }) {
  return html`<section class=${'tarjeta ' + (clase || '')}>
    ${(titulo || accion) && html`<div class="tarjeta-cab"><h3>${titulo}</h3>${accion}</div>`}
    ${children}
  </section>`;
}

export function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
