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
dos archivos. Los tipos de la API se nombran en `src/app/core/api/api-types.ts`; no se escriben a mano.

## Estructura

- `src/app/core/`: configuración (`config/`), cliente de la API y errores (`api/`), sesión, guardas de rol,
  interceptor del token y directiva `*appIfRole` (`auth/`).
- `src/app/shared/`: estados de carga, vacío y error; paginación por cursor; diálogo de confirmación con
  `expected_version`; exportación CSV segura.
- `src/app/features/`: pantallas nuevas conectadas al backend (Vulnerabilidades).
- `src/app/rutas/`, `src/app/componentes/`, `src/app/servicios/`: pantallas y componentes del prototipo. Las que aún
  no tienen ruta en el backend muestran «Sin datos» o «Pendiente de conectar con el backend».
- Documentación del prototipo: `documentación/`.

## Seguridad

- El token de Firebase se manda (`Authorization: Bearer`) **solo** a la API configurada; ante un 401 se renueva una
  vez y, si sigue fallando, la sesión termina y se vuelve al login.
- El rol se toma de `GET /api/me` (rol efectivo), nunca del token. Las rutas tienen un rol mínimo y las acciones que
  el rol no permite se ocultan; el backend aplica la misma tabla.
- Las fuentes se sirven desde el propio build (`@fontsource/inter`); no hay scripts en línea en `index.html`.
