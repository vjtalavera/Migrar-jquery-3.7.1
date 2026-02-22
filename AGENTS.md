# AGENTS.md

## Resumen del proyecto
- SPA en React 18 + Vite + TypeScript.
- Herramienta local para analizar codigo legado (migracion jQuery) y reportar hallazgos.

## Stack
- React con hooks y TSX.
- Vite para build.
- CSS global en `src/styles.css`.

## Comandos
- `npm run dev` para desarrollo local.
- `npm run build` para build de produccion.
- `npm run preview` para previsualizar el build.

## Estructura
- `src/App.tsx`: UI principal y logica de escaneo.
- `src/main.tsx`: bootstrap React.
- `src/data/*`: datos y reglas.
- `public/`: assets estaticos.
- `index.html`: entrada.

## Convenciones de codigo
- TypeScript en modo estricto; evitar `any`.
- Componentes funcionales con hooks; sin clases.
- Preferir inmutabilidad y helpers puros.
- Mantener cambios pequenos e incrementales.
- Evitar reintroducir jQuery; usar DOM APIs nativas o React refs.
- No ejecutar side effects en render; usar `useEffect` cuando aplique.
- Validar inputs y manejar errores de lectura de archivos.

## UI/UX
- Accesibilidad basica: labels, `aria-*` cuando aplique, focus visible.
- No bloquear la UI con operaciones grandes; partir trabajo si es necesario.
- Mensajes de estado claros (procesando, completado, errores).

## Estilos
- Mantener estilos en `src/styles.css`.
- Evitar inline styles salvo excepciones puntuales.
- No introducir frameworks CSS sin acuerdo.

## Rendimiento
- Limitar operaciones por archivo y cortar con `maxFindingsPerFile`.
- Usar memoizacion ligera (`useMemo`/`useCallback`) solo si evita recomputo real.

## Calidad
- No hay suite de tests en el repo.
- Antes de cambios grandes, ejecutar `npm run build` para validar.

## Seguridad y archivos
- La app procesa archivos locales del usuario; no enviar contenido a red.
- Evitar dependencias nuevas salvo necesidad.
