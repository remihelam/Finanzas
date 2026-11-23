# Mis finanzas

App web instalable (PWA) para registrar gastos diarios y proyectar el ahorro a 7 años. Funciona en iPhone y en computadora, y sincroniza con Supabase.

- **Sin paso de compilación**: HTML, CSS y módulos de JavaScript (Preact + htm incluidos en `vendor/`).
- **Funciona sin conexión**: los datos viven en el dispositivo (localStorage) y se sincronizan con Supabase cuando hay sesión.
- **Datos personales fuera del código**: el archivo `datos/mis-datos.json` está en `.gitignore` y se carga desde la pantalla de bienvenida.

## Estructura

| Archivo | Qué hace |
|---|---|
| `js/proyeccion.js` | Motor de proyección mes a mes: sueldo con aumentos, bonos, fijos con sus reglas de ajuste, deudas, retiro y rendimientos |
| `js/calculos.js` | Lo real contra el plan del mes, saldos de tarjetas y metas |
| `js/store.js` | Estado local y cola de cambios pendientes de sincronizar |
| `js/sync.js` | Sincronización con Supabase (gana el último cambio) |
| `js/pantallas/*` | Inicio, Movimientos, Registro rápido, Plan y Ajustes |
| `supabase/esquema.sql` | Tablas y reglas RLS |
| `config.js` | URL y clave pública de Supabase |

## Desarrollo local

Sirve la carpeta con cualquier servidor estático, por ejemplo con `npx serve .`, y abre la dirección. Al cambiar archivos, sube `VERSION` en `sw.js` para que los dispositivos instalados se actualicen.

La instalación paso a paso está en [GUIA-INSTALACION.md](GUIA-INSTALACION.md).
