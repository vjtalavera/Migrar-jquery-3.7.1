# Migrar jQuery 3.7.1

Aplicacion web en React + Vite para detectar APIs obsoletas de jQuery en archivos locales (JS/TS/JSP/HTML) y sugerir reemplazos basados en la documentacion oficial.

## Caracteristicas
- Escaneo local de archivos y carpetas (sin enviar contenido a servidores).
- Deteccion de APIs deprecadas y eliminadas segun las reglas oficiales.
- Sugerencia de reemplazo y linea corregida cuando es posible.
- Filtros de resultados: solo con incidencia, todos los archivos o sin reemplazo oficial.
- Agrupacion por archivo con despliegue/recogida.
- Panel de **ARCHIVOS INCLUIDOS** con incidencias por include (JSP y scripts con `src`).

## Requisitos
- Node.js 18+ (recomendado 20+)
- npm

## Instalacion
```bash
npm install
```

## Uso
```bash
npm run dev
```
Abre la URL que indica Vite (por defecto `http://localhost:5173`).

### Flujo recomendado
1. Selecciona una carpeta o archivos individuales.
2. Ejecuta el escaneo.
3. Revisa los hallazgos agrupados por archivo.
4. Usa los filtros para enfocar los resultados.

## Filtros de hallazgos
- **Solo con incidencia**: solo muestra resultados con sugerencia oficial disponible.
- **Todos los archivos**: incluye archivos sin incidencias.
- **Sin reemplazo oficial**: muestra coincidencias sin sugerencia oficial.

## Archivos incluidos
El panel **ARCHIVOS INCLUIDOS** detecta:
- `<%@include ... file|page>`
- `<jsp:include ... file|page>`
- `<jsp include ... file|page>`
- `<script ... src="...">`

Si el archivo incluido fue escaneado, se listan sus incidencias. Si no fue escaneado, se indica en el panel.

## Estructura del proyecto
- `src/App.tsx`: UI y logica de escaneo.
- `src/data/deprecations.ts`: reglas de deprecacion.
- `src/styles.css`: estilos globales.
- `public/`: assets estaticos.

## Privacidad y seguridad
La aplicacion procesa los archivos localmente en el navegador. No se realiza ningun envio a la red.

## Scripts disponibles
- `npm run dev`: desarrollo.
- `npm run build`: build de produccion.
- `npm run preview`: previsualizacion del build.

## Notas
La deteccion es heuristica y puede requerir validacion manual en casos ambiguos.
