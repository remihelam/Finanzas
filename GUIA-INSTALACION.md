# Guía para instalar "Mis finanzas" (unos 20 minutos, una sola vez)

Vas a crear dos cuentas gratuitas:

- **GitHub**: aloja la app y le da una dirección web, por ejemplo `https://tuusuario.github.io/finanzas`.
- **Supabase**: guarda tus datos en la nube para que el iPhone y la computadora vean lo mismo.

Hazlo desde la **computadora**.

---

## Paso 1. Crear tu cuenta de GitHub

1. Entra a <https://github.com/signup>.
2. Escribe tu correo, una contraseña y un nombre de usuario. El usuario va a quedar en la dirección de la app, así que escoge uno corto, por ejemplo `remih`.
3. Confirma el código que te llega por correo.
4. Si te pregunta por un plan, escoge el **Free**.

## Paso 2. Crear tu proyecto en Supabase

1. Entra a <https://supabase.com/dashboard/sign-up> y elige **Continue with GitHub**. Así usas la cuenta que acabas de crear.
2. Toca **New project**:
   - **Name**: `finanzas`
   - **Database password**: toca *Generate a password* y guárdala en tus notas. La app no la usa, pero conviene tenerla.
   - **Region**: la más cercana a México, por ejemplo *East US (North Virginia)*.
   - Toca **Create new project** y espera uno o dos minutos.
3. **Crear las tablas**: en el menú de la izquierda abre **SQL Editor** y toca **New query**. Copia y pega todo el contenido del archivo `supabase/esquema.sql`, luego toca **Run**. Debe decir *Success. No rows returned*.
4. **Simplificar el inicio de sesión** (opcional, pero recomendado): abre **Authentication**, luego **Sign In / Providers** y después **Email**. Desactiva **Confirm email** y guarda. Así no tienes que confirmar el correo para entrar.
5. **Copiar tus datos de conexión**: toca el botón **Connect** de arriba, o entra a **Project Settings** y luego **API Keys**. Copia dos cosas:
   - **Project URL**: algo como `https://abcdxyz.supabase.co`
   - **anon public** (o *publishable*): una clave larga que empieza con `eyJ…` o `sb_publishable_…`

   ⚠️ Copia **solo** la clave *anon* o *publishable*. **Nunca** compartas la *service_role* ni la *secret*.

   👉 **Mándame esas dos cosas por el chat.** Con ellas dejo la app conectada. La clave anon es pública por diseño: tus datos los protege tu contraseña y las reglas de seguridad que creó el paso 3.

## Paso 3. Publicar la app en GitHub

Hay dos opciones. La **A** es la más fácil.

**Opción A: me das acceso y yo la subo.** Conecta GitHub a Claude: en claude.ai entra a **Settings**, luego **Connectors** y después **GitHub**. Avísame y yo creo el repositorio, subo los archivos y activo la publicación.

**Opción B: la subes tú.**
1. En GitHub toca **+** y luego **New repository**.
   - **Repository name**: `finanzas`
   - Déjalo como **Public**. Esto es requisito de GitHub Pages gratis, y en el código no van tus datos personales.
   - Toca **Create repository**.
2. Toca **uploading an existing file**. Descomprime `finanzas-app.zip` y arrastra **todo su contenido** (no la carpeta). Después toca **Commit changes**.
3. Entra a **Settings** y luego **Pages**. En *Branch* elige `main` y la carpeta `/ (root)`, y toca **Save**.
4. En uno o dos minutos aparece arriba: *Your site is live at `https://tuusuario.github.io/finanzas/`*.

## Paso 4. Primer uso en la computadora

1. Abre la dirección de tu app.
2. Toca **📂 Cargar mis datos iniciales** y elige el archivo `mis-datos.json` que te pasé. Trae tu sueldo, bonos, gastos fijos, tarjetas y metas.
3. Entra a **Más**, luego **Cuenta y sincronización**. Escribe tu correo y una contraseña, toca **Crear cuenta** y después **Entrar**.
4. Arriba a la derecha debe aparecer **● Sincronizado** en verde.

## Paso 5. Instalarla en tu iPhone

1. Abre la dirección de la app en **Safari**. Tiene que ser Safari, no Chrome.
2. Toca el botón **Compartir** (el cuadro con la flecha) y luego **Agregar a pantalla de inicio**. Después toca **Agregar**.
3. Abre la app desde el ícono nuevo y toca **☁️ Ya la uso en otro dispositivo**.
4. Entra con **el mismo correo y contraseña**. Tus datos aparecen en unos segundos.

## Paso 6. Recordatorios

En el iPhone, desde **Safari** (no desde el ícono instalado), entra a **Más**, luego **Recordatorios** y toca **Agregar a mi calendario**. Elige **Agregar todo**. Tendrás:

- Un aviso diario a las 21:30 para registrar tus gastos.
- Un aviso el día 1 de cada mes para el cierre de saldos.
- Un aviso dos días antes de la fecha de pago de cada tarjeta (primero anota las fechas en **Más**, en **Tarjetas y deudas**).

---

## Uso diario (menos de 1 minuto)

- **Cada noche**: toca **+**, escribe el monto, elige la categoría y elige la forma de pago. Se guarda solo.
- **Cuando pagues la renta, la colegiatura u otro fijo**: en **Inicio**, en *Pendientes de este mes*, toca **Pagar**.
- **Cuando pagues una tarjeta**: toca **+**, luego **Pagar tarjeta**, el monto y la tarjeta.
- **El día 1 de cada mes**: entra a **Más**, luego **Ahorros y metas**, y anota cuánto tienes en Nu, Revolut, DiDi y tu cuenta de nómina. Toca **Guardar cierre**.
- **Si te suben el sueldo o cambia la colegiatura**: entra a **Más** y luego a **Sueldo y bonos** o a **Gastos fijos**.

Funciona sin internet. Lo que registres se sincroniza al volver la conexión.
