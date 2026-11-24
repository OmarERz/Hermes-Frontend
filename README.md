# Hermes Control (front)

Front de Hermes en **Angular 21** (zoneless, render en el cliente). Se conecta al backend de Hermes por su API
(`openapi/openapi.json`) y usa **Firebase Auth** para iniciar sesión. El backend es la fuente de verdad: el front no
guarda datos propios ni usa Firestore.

## Requisitos

- Node 22 LTS (`.nvmrc`; con nvm: `nvm use`) y npm 10.
- Para probar contra datos reales: la pila local del backend (`make up` y `make demo` en el repo del backend), que
  publica la API en `http://127.0.0.1:8000` y el emulador de Firebase Auth en `http://127.0.0.1:9099`.

## Primeros pasos

```bash
npm ci --ignore-scripts   # el build no necesita scripts de instalación de las dependencias
npm start                 # http://localhost:4200
```

Para que el backend acepte el front en otro origen, en el backend pon `CORS_ALLOWED_ORIGINS=http://localhost:4200`
antes de `make up`. Usuarios de prueba del emulador (los crea `make emulator-token ROLE=<rol>` en el backend):
`reader@hermes.test`, `analyst@hermes.test` y `admin@hermes.test`, con la contraseña `emulator-test-password`.

## Configuración

- **Valores del build** (`src/environments/`):
  - `environment.ts` (desarrollo y pruebas): API en `http://127.0.0.1:8000` y emulador de Firebase Auth
    (`http://127.0.0.1:9099`, proyecto `demo-hermes`). Un clon limpio funciona así, sin archivos locales.
  - `environment.prod.ts` (`npm run build`): la API en el **mismo origen** que sirve el front (detrás del proxy
    inverso), sin emulador y sin configuración de Firebase.
- **Ajuste en tiempo de ejecución** (opcional): `public/runtime-config.json` (ignorado por git) se lee al arrancar y
  reemplaza solo los campos que trae. Copia el ejemplo `src/environments/runtime-config.example.json` y llena la
  configuración web del proyecto real de Firebase (`hermes-pass-sec`, consola de Firebase → Configuración del
  proyecto). Con `"authEmulatorUrl": null` se usa el proyecto real en lugar del emulador. En producción, sirve ese
  archivo junto a `index.html`. Si el archivo existe pero no es válido, la app no arranca y dice qué campo falla.
- `itopBaseUrl` (opcional, en `runtime-config.json`): URL de la consola web de iTop para los enlaces «Ver/Editar/Crear
  en iTop». Sin ella, esos enlaces no aparecen (los que trae la API, como `itop_url` de un CI, sí).
- El antiguo `src/environments/firebase.ts` del prototipo ya no se lee: pasa sus valores a `runtime-config.json`.

## Comandos

| Comando                           | Qué hace                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm start`                       | Servidor de desarrollo con recarga                                                              |
| `npm run verify`                  | La puerta de calidad: `api:check` + `lint` + `format:check` + `test` + `build`                  |
| `npm run lint`                    | ESLint (angular-eslint, typescript-eslint)                                                      |
| `npm run format` / `format:check` | Prettier                                                                                        |
| `npm test`                        | Pruebas unitarias (Vitest, sin red)                                                             |
| `npm run build`                   | Build de producción en `dist/hermes-front/browser`                                              |
| `npm run audit`                   | `npm audit` de las dependencias de producción (falla con _high_ o _critical_)                   |
| `npm run api:generate`            | Regenera `src/app/core/api/schema.d.ts` desde `openapi/openapi.json` (openapi-typescript 7.9.1) |
| `npm run api:check`               | Falla si los tipos generados no corresponden al OpenAPI                                         |

**Actualizar el contrato:** copia `openapi/openapi.json` del backend, corre `npm run api:generate` y versiona los
dos archivos. Los tipos de la API no se escriben a mano: se toman de los generados con `ApiResult`, `ApiQuery`,
`ApiBody` y `ApiSchema` (`src/app/core/api/api-client.ts`).

## Estructura

- `src/app/core/`: configuración (`config/`), cliente tipado de la API y errores (`api/`), sesión, guardas de rol,
  interceptor del token y directiva `*appIfRole` (`auth/`), navegación por secciones y pestañas (`navigation/`).
- `src/app/shared/`: estados de carga, vacío y error; paginación por cursor; diálogo de confirmación con
  `expected_version`; exportación CSV segura; enlaces a iTop; nombres en español de los niveles y estados;
  pestañas de sección y página provisional.
- `src/app/features/`: una carpeta por área; cada pantalla entra por su archivo `<nombre>.page.ts`.
- `src/app/testing/`: dobles de prueba compartidos (sesión con un rol).
- `src/app/rutas/`, `src/app/componentes/`, `src/app/servicios/`: pantallas y componentes del prototipo. Las que aún
  no tienen ruta en el backend muestran «Sin datos» o «Pendiente de conectar con el backend».
- Documentación del prototipo: `documentación/`.

## Trabajo en paralelo por carriles (F17.2 en adelante)

Cada pantalla ya tiene su ruta, su sección, su pestaña, su título y su rol mínimo (`src/app/app.routes.ts` y
`src/app/core/navigation/navigation.ts`, con una prueba que los mantiene iguales). La ruta carga un **archivo de
entrada** fijo, `src/app/features/<área>/<nombre>.page.ts`, que hoy muestra la pantalla del prototipo o una página
provisional. Cada carril construye sus pantallas **solo dentro de sus carpetas**:

| Carril                         | Carpetas propias (crear, editar y borrar solo aquí)                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A · Agentes y operación        | `src/app/features/agents/`, `src/app/features/home/`, `src/app/rutas/Agentes/`, `src/app/rutas/Historial-agente/`, `src/app/rutas/Inicio/` |
| B · Inventario                 | `src/app/features/inventory/`, `src/app/rutas/Activos/`, `src/app/rutas/Stack-tecnologico/`                                                |
| C · Vulnerabilidades y tickets | `src/app/features/vulnerabilities/`                                                                                                        |
| D · Recomendaciones y feedback | `src/app/features/recommendations/`, `src/app/rutas/Recomendaciones-agente/`, `src/app/rutas/Revision-humana/`                             |
| E · Juez y fórmula             | `src/app/features/configuration/`, `src/app/rutas/Configuracion-agente/`                                                                   |
| F1 · Fuentes y empresa         | `src/app/features/sources/`, `src/app/features/company/`, `src/app/features/connections/`, `src/app/rutas/Feeds-inteligencia/`             |
| F2 · Corridas y administración | `src/app/features/runs/`, `src/app/features/admin/`                                                                                        |
| Asistente (al final)           | `src/app/features/setup/`                                                                                                                  |

Reglas:

1. **Archivo de entrada:** conserva su ruta y el nombre de la clase que exporta (`MetricsPage`, `AssetsPage`…);
   el carril reemplaza su contenido por la pantalla real. Las rutas, secciones, pestañas, títulos y roles no se
   tocan desde un carril: si hace falta una ruta o un rol nuevo, se pide un PR de la base.
2. **Fuera de las carpetas propias no se edita nada.** En particular, son de la base: `src/app/core/`,
   `src/app/shared/`, `src/app/testing/`, `src/app/app.*`, `src/app/componentes/`, `src/app/servicios/`,
   `src/app/rutas/Login/`, `src/styles.css`, `src/environments/`, `src/main.ts`, `src/index.html`, `public/`,
   `openapi/`, `src/app/core/api/schema.d.ts`, `package.json`, `package-lock.json`, `angular.json`,
   `tsconfig*.json`, `eslint.config.mjs`, `.prettier*`, `.github/`, `README.md` y `documentación/`.
3. **Las hojas de estilo que importa `src/styles.css` no se editan ni se borran**, aunque estén dentro de una
   carpeta propia (`control-agente.css`, `historial-agente.css`, `activos.css`, `stack-tecnologico.css`,
   `configuracion-agente.css`, `recomendaciones-agente.css`, `revision-humana.css`, `feeds-inteligencia.css`):
   guardan las vistas compartidas (`assets-view`, `agent-view`…) y el tema oscuro. Los estilos nuevos van en la
   hoja propia del componente. Al reemplazar una pantalla del prototipo se borran su `.ts` y su `.html`, no su
   `.css` global.
4. **API:** `inject(ApiClient).get('/api/…', { path, query })` (también `post`, `put`, `patch`, `delete`) dentro de
   la carpeta propia; los tipos, con `ApiResult`, `ApiQuery`, `ApiBody` y `ApiSchema`. No se agregan métodos a
   `HermesApi` ni alias a `api-types.ts`. Si una ruta todavía no está en `openapi/openapi.json`, se espera al PR
   de la base que regenera el contrato. El progreso en vivo de una corrida (`GET /api/runs/{id}/events`, SSE) no
   pasa por `ApiClient`: necesita una llamada en _streaming_ que mande el token (carril F2).
5. **Diseño:** cada página empieza con `<app-banner-pagina>` (dibuja las pestañas de la sección) dentro de la clase
   de vista del prototipo que reutiliza (`assets-view`, `agent-view`, `stack-view`…).
6. **Piezas compartidas:** `AsyncState`, `CursorPager` y `<app-async-state>` para datos asíncronos (con señales:
   la app es _zoneless_); `withExpectedVersion` y `<app-confirm-changes-dialog>` para escrituras con versión;
   `*appIfRole` (con `ACTION_ROLES` o el rol directo) para ocultar acciones; `<app-itop-link>` para «Ver, Editar o
   Crear en iTop»; `shared/labels.ts` para nombres de niveles, estados y clasificaciones; `toCsv` para exportar.
7. **Pruebas:** las de componentes usan `...provideFakeSession(rol)` de `src/app/testing/fake-session.ts`.
8. **Sin dependencias npm nuevas** (se piden a la base).
9. Un carril solo importa archivos de otro carril ya integrado en `develop`, y sin editarlos.
10. Los servicios del prototipo (`src/app/servicios/`) no se editan ni se borran: el carril deja de usarlos y la
    limpieza final quita los que nadie importe.
11. Proceso: rama `feat/f17-N-<nombre>` desde `origin/develop` (se integra `develop` con merge, sin _rebase_), un
    commit por tarea con `npm run verify` en verde, revisión de feature con el script compartido, puerta local,
    push aislado y PR hacia `develop`. Los cambios de documentación van en el texto del PR.

## Seguridad

- El token de Firebase se manda (`Authorization: Bearer`) **solo** a la API configurada; ante un 401 se renueva una
  vez y, si sigue fallando, la sesión termina y se vuelve al login.
- El rol se toma de `GET /api/me` (rol efectivo), nunca del token. Las rutas tienen un rol mínimo y las acciones que
  el rol no permite se ocultan; el backend aplica la misma tabla.
- Las fuentes se sirven desde el propio build (`@fontsource/inter`); no hay scripts en línea en `index.html`.
