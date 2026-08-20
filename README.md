# Dashboard de Gestión — Meta & TikTok

Dashboard estático (HTML/CSS/JS, sin backend) que lee en vivo tu Google Sheet
y muestra: resumen general, resumen mensual, leads ingresados/vendidos, torta
de tipificaciones, ranking y efectividad por asesor, CPL, CPA, CVR y vendido
por contacto. Cada vez que alguien abre el link, vuelve a leer el Sheet — no
hay que "re-publicar" nada cuando cambian los datos.

## 1. Dejar el Google Sheet listo (una sola vez)

El dashboard lee el Sheet directamente desde el navegador de quien lo abre,
así que el Sheet necesita permitir lectura sin iniciar sesión:

1. Abre el Sheet → botón **Compartir** (arriba a la derecha).
2. En "Acceso general" cambia de "Restringido" a **"Cualquiera con el enlace"**.
3. Rol: **Lector** (no "Editor" — así nadie puede modificar los datos desde
   ese link).
4. Guardar.

Esto no lo hace público en el sentido de "aparece en buscadores" ni lo lista
en ningún lado: solo alguien que tenga el link exacto del Sheet (o el link
del dashboard) puede verlo. Es el mismo criterio de privacidad que eligieron
para el dashboard (URL no listada, sin login).

**Importante:** si en algún momento cambias el acceso de vuelta a
"Restringido", el dashboard deja de poder leer los datos y mostrará un error.

## 2. Revisar `config.js`

Ya viene configurado con el ID de tu Sheet y los nombres exactos de las 6
pestañas que usa (`LEADS TIKTOK V.2`, `SALES REVOLUTION | LEADS META |`,
`SALES REVOLUTION | LEADS META`, `LEADS TIKTOK SR`, `RESUMEN META`,
`RESUMEN TIKTOK`). Solo tienes que tocar este archivo si:

- Cambias el nombre de alguna pestaña en el Sheet → actualiza el `name`
  correspondiente en `LEAD_SHEETS` o `RESUMEN_SHEETS`.
- Agregas una pestaña nueva de leads (por ejemplo una "V.3") → copia uno de
  los bloques de `LEAD_SHEETS` y ajusta los nombres de columna (`cols`) según
  los headers reales de esa pestaña.
- La campaña sigue en **2027** → cambia `DEFAULT_YEAR`. Esto es porque las
  pestañas `RESUMEN META` / `RESUMEN TIKTOK` solo traen el nombre del mes
  (ej. "Julio"), no el año, así que el dashboard asume el año configurado acá
  para calcular la inversión mensual.

## 3. Subir a GitHub

```bash
cd dashboard-entel
git init
git add .
git commit -m "Dashboard de gestión Meta & TikTok"
```

Crea un repositorio nuevo en GitHub (puede ser privado o público — el
contenido del repo no trae datos, solo el código que los va a leer) y
súbelo:

```bash
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

## 4. Activar GitHub Pages

1. En el repo, ve a **Settings → Pages**.
2. En "Source" elige **Deploy from a branch**.
3. Branch: **main**, carpeta **/ (root)**.
4. Guarda. En 1-2 minutos tu dashboard queda publicado en:
   `https://TU-USUARIO.github.io/TU-REPO/`

Guarda ese link — es el que abres para ver el dashboard actualizado en
cualquier momento, y es el que decides compartir o no con tu equipo.

## 5. Mantenimiento

- **No hay que hacer nada** para que el dashboard se actualice: cada vez que
  se abre el link, vuelve a leer el Sheet tal cual está en ese momento.
  También se refresca solo cada 10 minutos si lo dejas abierto en una
  pestaña (ajustable en `config.js` → `AUTO_REFRESH_MINUTES`).
- El botón **↻ Actualizar** fuerza una relectura inmediata.
- Los filtros (Plataforma / Mes / Asesor) recalculan todo en el momento, sin
  volver a pedir datos al Sheet.

## Cómo se calculan las métricas

- **Leads ingresados**: total de filas en las 4 pestañas de leads (Meta +
  TikTok), combinadas.
- **Gestionados / Contacto / No contacto**: según la columna `Status
  Gestión` de cada pestaña.
- **Leads vendidos**: filas cuya tipificación empieza con "VENTA" (cubre
  "VENTA MONO" y "VENTA MULTI"). Se usa la tipificación y no la columna `QTY
  Venta` porque esta última tiene datos sueltos con errores de tipeo (fechas,
  texto libre) en el Sheet original.
- **Inversión, CPL, CPA**: la inversión mensual se toma de las celdas
  "Inversión" en `RESUMEN META` / `RESUMEN TIKTOK` (no hay gasto por lead
  individual en el Sheet). CPL = inversión ÷ leads del período. CPA =
  inversión ÷ ventas del período. Por eso el ranking por asesor no trae CPL
  ni CPA — la inversión no está desagregada por asesor en el Sheet, solo por
  plataforma y mes.
- **CVR**: ventas ÷ leads ingresados.
- **Vendido por contacto**: ventas ÷ leads contactados.
- **Efectividad (vs. gestionados)**: ventas ÷ leads gestionados.
- **Torta de tipificaciones**: se muestran las 7 tipificaciones más
  frecuentes y el resto se agrupa en "Otras" (hay ~20 tipificaciones
  distintas en el Sheet; con todas, la torta sería ilegible).

### Nota de calidad de datos

Al revisar tu Sheet actual, ~225 leads de la pestaña `SALES REVOLUTION |
LEADS META` (sin el `|` final) no tienen `Año`/`Mes`/`Fecha` completados.
Esos leads sí se cuentan en el **resumen general**, pero no pueden ubicarse
en el **resumen mensual** (no hay forma de saber a qué mes pertenecen). El
dashboard te avisa cuántos son arriba de la tabla mensual. Si quieres que
también aparezcan en el mensual, hay que completar esas fechas en el Sheet.

## Estructura de archivos

```
index.html    → estructura de la página
style.css     → estilos + paleta de colores (claro/oscuro)
config.js     → ID del Sheet, nombres de pestañas, mapeo de columnas
data.js       → descarga y normaliza los datos del Sheet
metrics.js    → calcula todas las métricas a partir de los datos normalizados
app.js        → dibuja los gráficos (Chart.js) y las tablas
```
