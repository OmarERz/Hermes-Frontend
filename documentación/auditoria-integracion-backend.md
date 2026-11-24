# Auditoría de hardcoding e integración con backend

**Alcance:** análisis estático del frontend Angular y archivos de configuración visibles en el repositorio. No se modificó código fuente, configuración ni dependencias. Las referencias `archivo:Línea` corresponden al estado inspeccionado y pueden cambiar con futuras ediciones.

## Resumen ejecutivo

- La selección global `real`/`demo` existe en `OrigenDashboard`, pero cada página elige su fuente por separado. No hay un repositorio/fachada común que resuelva los datos de todas las áreas.
- Hay una URL base centralizada en `src/app/config/api.config.ts:2-6`. La bandera `usarApi` está en `false`; solo `InventarioActivos` contiene solicitudes HTTP de negocio.
- Las únicas operaciones `HttpClient` encontradas son `GET /activos`, `POST /activos` y `PATCH /activos/{id}`. No se encontraron `PUT` ni `DELETE` HTTP.
- Las demás áreas usan fixtures en memoria, almacenamiento del navegador o resultados vacíos. No hay conexión verificada a iTop, agentes, tickets, recomendaciones ni autenticación.
- Las seis gráficas de Stack y las gráficas del Dashboard de Agentes reutilizan `GraficoDashboard` (ECharts), pero varias opciones y datos se preparan dentro de componentes de página. Las fuentes demo están parcialmente centralizadas; Vulnerabilidades conserva sus conteos demo en la página.
- No calculo un porcentaje global de hardcoding: el repositorio no define una métrica reproducible para contar componentes, campos o caminos de datos. Cualitativamente, la mayoría de módulos analíticos depende de demostración o no tiene fuente real.

## Método y alcance

Se revisaron `AGENTS.md`, los archivos bajo `src/app`, búsquedas recursivas de URL, `HttpClient`, `fetch`, Axios, almacenamiento web, patrones de datos demo y usos de gráficas. También se revisaron `angular.json`, `package.json`, archivos JSON de proyecto y `documentación/` para localizar configuración, proxy y documentación previa. El comando `git status` no pudo ejecutarse porque esta carpeta no se reconoce como repositorio Git (`fatal: not a git repository`). No se infiere estado de cambios locales.

## Tabla A — Estado general de los módulos

| Módulo | Fuente actual | Hardcoding | API actual | Preparación | Pendiente |
|---|---|---|---|---|---|
| Inicio | `OrigenDashboard`, `SupervisionAgentes`, `CatalogoTecnologias`, `InventarioActivos`; selector en `inicio.ts:16-35` | Métricas demo compartidas; tickets y tasa reales se representan como `null` | Carga inventario por el servicio; el resto no | Parcialmente preparado | Endpoint/contrato para resumen, tecnologías, tickets y métricas de agentes; unificar estados de carga/error |
| Agentes — Dashboard | `OrigenDashboard.agentes` y `SupervisionAgentes.tickets`; `control-agente.ts:43-61` | Sí, métricas/series demo centralizadas, transformación KPI local | No | Dependiente de datos demo | Contrato de telemetría, periodo, ejecución, herramientas, tickets y agregados |
| Agentes — Historial | `SupervisionAgentes.ejecuciones`; `historial-agente.ts:14-38` | Sí, cinco ejecuciones con fechas y tickets demo | No; en real retorna arreglo vacío | Dependiente de datos demo | Consulta, filtros, paginación, detalle y retención/auditoría |
| Agentes — Recomendaciones | `SupervisionAgentes.revisiones`; `recomendaciones-agente.ts:15-52` | Sí, propuestas, análisis, puntajes y decisión demo | No; en real retorna arreglo vacío | Dependiente de datos demo | Consulta de recomendaciones, conflictos, juez, puntajes y trazabilidad |
| Revisión humana mediante modal | Misma fuente demo de supervisión; `revision-humana.ts:46-90` | Sí; cambios solo en memoria | No; decisiones deshabilitadas/no se guardan en backend | Dependiente de datos demo | Contrato de caso, autorización, decisión, comentario, responsable, puntajes y auditoría |
| Stack Tecnológico | Catálogo demo en `OrigenDashboard`; catálogo llamado real desde `CatalogoTecnologias` (localStorage); `stack-tecnologico.ts:19-31` | Sí; evaluaciones de stack solo demo, valores de vulnerabilidad demo en página | Sin API de tecnologías/evaluaciones/vulnerabilidades | Parcialmente preparado | Catálogo empresarial, evaluación, asignaciones y resultados de agente; no llamar “real” al almacenamiento local |
| Vulnerabilidades por prioridad | Fixture de conteos en página para demo; `ResultadosVulnerabilidadesAgente` en memoria para real | Sí en demo y explícitamente separado; no hay fixture real | No; el servicio solo permite `recibir()` un modelo tipado | Parcialmente preparado (modelo interno propuesto, sin transporte) | Contrato backend/agente, validación runtime, estados de consulta y mecanismo de recepción |
| Activos | Demo desde `OrigenDashboard`; real desde `InventarioActivos`; `activos.ts:16-67` | Demo separado; métricas derivadas de los registros | Sí, rama opcional inactiva con `usarApi=false` | Parcialmente preparado | Confirmar endpoint/JSON, autenticación, validación, criticidad/incidencias y CORS del backend |
| Configuración del agente | `SupervisionAgentes` (perfil/herramientas demo); `configuracion-agente.ts:14-80` | Sí; estado local en memoria y confirmación simulada | No | Dependiente de datos demo | Lectura/escritura autorizada y auditoría; políticas reales deben permanecer backend-owned |
| Barra superior y perfil | `OrigenDashboard` para selector; tema local del layout; perfil literal en `MenuPerfil`; `layout-principal.ts:18-29`, `menu-perfil.ts:12-17` | Perfil fijo; modo de origen es estado de interfaz | No | Hardcodeado sin separación (perfil); selector preparado como estado local | Identidad de sesión, rol, proveedor auth y persistencia/contrato del origen si el backend lo requiere |

**Estados usados:** “Listo para integración” requeriría contrato disponible y separación de transporte, adaptación y presentación. Ningún módulo cumple actualmente ese umbral integral. “Parcialmente preparado” indica que existe servicio/modelo o ruta de API, pero no contrato verificado o conexión activa.

## Qué tan hardcodeado está el sistema

### Datos demo legítimos, identificados como tales

- `src/app/servicios/origen-dashboard.ts:11-36`: perfil/telemetría de agente, cinco herramientas, series de siete días y números de ejemplo.
- `src/app/servicios/origen-dashboard.ts:39-55`: seis tecnologías, salud 86, listas de calidad/madurez/valor y evolución.
- `src/app/servicios/origen-dashboard.ts:57-65`: siete activos `DEMO-001` a `DEMO-007` con características y propietarios de ejemplo.
- `src/app/servicios/supervision-agentes.ts:62-90`: perfil inicial, cinco herramientas, tres propuestas, cinco tickets y cinco ejecuciones demo fechadas.
- `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts:46-51`: conteos demo de vulnerabilidades (3, 6, 9, 4; total 22), condicionados al origen demo en `70-78`.
- `src/app/rutas/Login/login.ts:36-44` y `login.html:65`: acceso de demostración con credenciales codificadas (no se reproducen aquí). No es autenticación de servidor.

Estos datos son fixtures legítimos mientras la interfaz indique que son demostrativos. El riesgo surge si se presentan como registros reales o se habilitan acciones con efectos reales en modo demo.

### Hardcoding problemático o que requiere aclaración

- `src/app/componentes/menu-perfil/menu-perfil.ts:15-16`: nombre, iniciales y rol estáticos; no existe servicio de identidad verificado. El botón de logout está indisponible.
- `src/app/rutas/Registrar-activo/registrar-activo.ts:15-35`: valores iniciales fijos para un nuevo activo, incluidos código `ACT-000123`, tipo, estado, RAM, almacenamiento y sistema operativo. Son defaults del formulario, no datos cargados del backend; confirmar si el código debería generarse en servidor.
- `src/app/rutas/Activos/activos.html:9-11`: criticidad e incidencias indican “Sin evaluar”, no son cifras inventadas. Deben permanecer vacías hasta que exista evaluación/dato.
- `src/app/rutas/Stack-tecnologico/stack-tecnologico.html:7` y `:13-18`: indicadores de criticidad/evaluación sin datos reales; no son cero.
- `src/app/rutas/Agentes/control-agente.html:44`: etiqueta accesible del gráfico contiene “97,8” literal, mientras la gráfica y sus datos usan `datosDemo`; si se incorporan datos variables, ese `aria-label` puede quedar inconsistente.
- `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts:87-96`: algunas etiquetas accesibles describen valores demo (por ejemplo salud 86) en forma fija.
- Los límites de ejes, colores, textos, tamaños, categorías de filtro y opciones de UI de gráficos/forms son constantes de presentación o dominio local, no datos backend. No se clasifican por sí mismas como hardcoding problemático.

### Grado global

No se asigna porcentaje: no existe denominador acordado (cantidad de módulos, campos, pantallas o flujos) ni ponderación objetiva entre fixture separado, valor fijo de UI y API conectada. Evidencia cualitativa: Inicio, Agentes, Historial, Recomendaciones, HITL y Configuración dependen de fuentes demo o carecen de conexión real; Stack tiene catálogo en localStorage y evaluaciones demo; Activos es el único dominio con llamadas HTTP, pero desactivadas por configuración.

## Configuración de API y transporte

| Archivo | Línea exacta | Nombre / valor | Finalidad | ¿Cambiar para integrar? |
|---|---:|---|---|---|
| `src/app/config/api.config.ts` | 2-6 | `API_CONFIG`; `usarApi: false`; `baseUrl: 'http://localhost:3000/api'` | URL base única de la llamada de inventario y bandera que selecciona la rama HTTP/local | Sí: sustituir por configuración aprobada por entorno y habilitar según despliegue. El host `localhost` no es configuración de producción verificada |
| `src/app/app.config.ts` | 3, 8-14 | `provideHttpClient(withFetch())` | Registra `HttpClient` con backend fetch para Angular | No necesariamente; ya permite solicitudes. No se encontró configuración de interceptores |
| `src/app/servicios/inventario-activos.ts` | 41 | `endpoint = \`${API_CONFIG.baseUrl}/activos\`` | Deriva el recurso de activos desde la URL central | Conservar el patrón; adaptar solo tras confirmar ruta de contrato |
| `src/server.ts` | 61 | Log `http://localhost:${port}` | Dirección del servidor Node/SSR local | No es URL de API cliente. No se encontró implementación de endpoints de negocio en este archivo |
| `src/index.html` | 8-10 | Google Fonts `https://fonts.googleapis.com` y `fonts.gstatic.com` | Recursos de tipografía Inter | No son rutas del backend |

**Búsqueda adicional:** no se encontraron archivos `environment*`, proxy de Angular, `fetch`, Axios, `XMLHttpRequest`, interceptor, configuración CORS ni otro `HttpClient` en el código inspeccionado. No se imprimieron secretos. La aplicación habilita la infraestructura HTTP, pero no se encontró mecanismo de autenticación para estas llamadas.

## Tabla B — Inventario de solicitudes HTTP

| Método | Servicio | Función | Archivo | Línea | Ruta/API | Estado |
|---|---|---|---|---:|---|---|
| GET | `InventarioActivos` | `cargar()` | `src/app/servicios/inventario-activos.ts` | 45-53; llamada 47 | `${API_CONFIG.baseUrl}/activos` (`/activos` relativo a base URL) | Condicional e inactivo con `usarApi=false`; con bandera activa tipa respuesta `ActivoInventario[]`, pero contrato no verificado |
| POST | `InventarioActivos` | `agregar(datos)` | `src/app/servicios/inventario-activos.ts` | 56-79; llamada 58 | `${API_CONFIG.baseUrl}/activos` | Condicional; con bandera apagada crea y agrega en memoria. Consumida por `RegistrarActivo.registrar()` en `registrar-activo.ts:37-46` |
| PATCH | `InventarioActivos` | `asignarPropietario(id, propietario)` | `src/app/servicios/inventario-activos.ts` | 81-89; llamada 83 | `${API_CONFIG.baseUrl}/activos/${encodeURIComponent(id)}`; cuerpo `{ propietario }` | Condicional; apagada, devuelve el activo encontrado localmente; consumida por `Activos.guardarPropietario()` en `activos.ts:107-116` |
| PUT | No encontrado | No encontrado | — | — | No encontrado | No hay llamada identificada |
| DELETE | No encontrado | No encontrado | — | — | No encontrado | No hay llamada HTTP identificada; la eliminación de tecnologías es local |

No hay parámetros query en las llamadas encontradas. El GET espera arreglo de `ActivoInventario`, el POST y PATCH esperan un `ActivoInventario`. Son expectativas TypeScript actuales, no contrato confirmado por el backend. El GET limpia la colección y propaga el error en `inventario-activos.ts:47-52`; POST/PATCH no agregan manejo de error dentro del servicio. La pantalla de Activos muestra error para GET y PATCH; Registro muestra mensaje para POST.

## Tabla C — Gráficas y datos

La instancia reusable de ECharts está en `src/app/componentes/grafico-dashboard/grafico-dashboard.ts:17-24,32-48,50-79,82-104`; recibe `EChartsCoreOption` y etiqueta por `@Input`. Maneja resize y tema; no conoce el dominio ni realiza consultas.

| Gráfica | Componente | Archivo / línea | Fuente actual y transformación | Datos que deberá aportar el backend | Estado |
|---|---|---|---|---|---|
| Tecnologías por categoría | `StackTecnologico` / `GraficoDashboard` | `stack-tecnologico.html:59-72`; TS `130-140` | `tecnologias`; cuenta filas por categoría en `130-132`; demo de `OrigenDashboard:39-46`, “real” desde catálogo local | Tecnologías con identificador, categoría y estado de calidad de dato; confirmar semántica de categoría | No backend; gráfica reutilizable, página transforma lista |
| Salud del stack | Igual | HTML `59-72`; TS `142-144` | `OrigenDashboard.stack.salud` (`:48-55`), demo | Resultado de evaluación con valor, periodo, ámbito y estado de evaluación | Demo; no evaluación real |
| Madurez tecnológica | Igual | HTML `59-72`; TS `146-148` | `OrigenDashboard.stack.madurez`, demo; `demoBars()` | Valores por tecnología y escala/metodología definida por equipo | Demo; escala 1-5 configurada localmente |
| Calidad por categoría | Igual | HTML `59-72`; TS `146-148` | `OrigenDashboard.stack.calidad`, demo; `demoBars()` | Evaluación por categoría, escala, fecha/versión | Demo |
| Valor de negocio | Igual | HTML `59-72`; TS `146-148` | `OrigenDashboard.stack.valorNegocio`, demo; `demoBars()` | Indicadores, escala y valores entregados por backend | Demo |
| Vulnerabilidades por prioridad | Igual | HTML `59-78`; TS `40-51,66-85,149-159` | Conteos demo en `StackTecnologico`; real desde `ResultadosVulnerabilidadesAgente.resultado()?.vulnerabilities`; cuenta una vulnerabilidad por `vulnerabilityId` en arreglo, prioridad en `70-78` | Contrato de resultado clasificado con identificador único y prioridad; política para duplicados/hallazgos multi-activo y origen/fecha | Modelo interno propuesto, sin API ni validador; en modo real el store no se llena por ruta encontrada |
| Evolución del índice tecnológico | Igual | HTML `90`; TS `160-162` | Periodos y valores desde `OrigenDashboard.stack`, demo | Serie temporal con periodos, métrica/escala y metadatos | Demo; visualización separada |
| Tasa de éxito de ejecución | `ControlAgente` / `GraficoDashboard` | HTML `44`; TS `64-72` | `OrigenDashboard.agentes` (`:11-36`); compone pastel con tasa y éxitos/errores | Conteos y definición temporal del denominador, éxitos/errores; evitar `100 - porcentaje` si el backend tiene conteos propios | Demo; opción estática creada en componente |
| Uso de herramientas | Igual | HTML `46`; TS `74-82` | Lista porcentual y total demo del agente | Uso/conteo por herramienta, ventana temporal y total | Demo; transformación ligera de fixture |
| Tareas completadas (tendencia) | Igual | HTML `45`; TS `84-91` | Días y serie demo de `OrigenDashboard.agentes` | Serie temporal y zona/ventana temporal | Demo |
| Desempeño del agente | Igual | HTML `48`; TS `93-107` | Series de éxito/tiempo de respuesta demo; ejes de escala definidos en TS | Series alineadas por periodo, unidad y denominador | Demo |
| Procesos / cola | `ControlAgente` | HTML `47`; valores desde TS `46` | KPIs `enProceso`, `completadosHoy`, `enCola` del fixture `OrigenDashboard.agentes` | Conteos con instante de corte/definición de estado | Tarjeta KPI, no chart ECharts; demo |
| Tickets e indicadores de ticket | `ControlAgente` | HTML `21-29`; cálculo TS `48-61` | Cuenta/agrupa `SupervisionAgentes.tickets`; mediana/promedio resolutivo local por tickets completados | Tickets con estado, fechas y medidas acordadas o agregados validados | Demo; no servicio API |
| Distribución por tipo de activo | `Activos` | HTML `46`; TS `34-44` | Agrupa los registros seleccionados y calcula porcentaje local | Activos con tipo; total paginado no debe confundirse con total del inventario | API opcional de inventario/demo |
| Estado de los activos | `Activos` | HTML `47`; TS `45-56` | Cuenta activos en tres estados y calcula porcentaje | Activos con estado válido; documentar tratamiento de estados no contemplados | API opcional/demo |
| KPI de inventario | `Activos` | HTML `8-11`; TS `31-33` | Total, propietarios distintos y áreas desde activos; criticidad/incidencias dicen “Sin evaluar” | Activos, propietarios/áreas si corresponde; criticidad/incidencias solo con contrato/evaluación real | Parcial, solo depende del inventario |
| Resumen de Inicio | `Inicio` | HTML `20-26`; TS `20-35` | Demo desde fuentes compartidas; en real, tecnologías del localStorage, activos desde servicio, tickets/tasa null | Resumen por dominio o datos suficientes con estados y fecha de actualización | Parcial; sin API unificada |

Los datos requeridos son capacidades funcionales derivadas de lo que dibuja cada pantalla, no nombres de campos JSON propuestos como contrato externo.

## Tabla D — Simulaciones

| Funcionalidad | Archivo / línea | Simulación actual | Backend requerido |
|---|---|---|---|
| Inicio de sesión | `src/app/rutas/Login/login.ts:25-44`; HTML `login.html:65` | Valida en cliente contra correo/contraseña literal, retardo `setTimeout`; no crea sesión ni token | Autenticación real, emisión/renovación de sesión, expiración y autorización (contrato y mecanismo pendientes) |
| Perfil/logout | `src/app/componentes/menu-perfil/menu-perfil.ts:15-16` | Nombre/rol fijo; logout deshabilitado | Endpoint/mecanismo de sesión e identidad; no existe servicio de auth encontrado |
| Configuración perfil/herramientas | `configuracion-agente.ts:59-79`; `SupervisionAgentes:92-101` | Confirmación actualiza signals y agrega evento demo en memoria | Operación de configuración autorizada y auditoría desde backend; perfiles, herramientas y límites por acordar |
| Decisiones HITL | `revision-humana.ts:78-90`; `SupervisionAgentes:103-116` | Validaciones de UI, confirmación y modificación de señales; historial actor “Usuario demo” | Enviar decisión, comentario, responsable y versión/estado; autorización y auditoría backend. El frontend no prueba que una operación real ocurrió |
| Recomendaciones / juez | `recomendaciones-agente.ts:26-69`; fuentes `SupervisionAgentes:70-74` | Lista y comparación demo; `registrarDecision()` solo actualiza mensaje/cierra modal | Lectura de recomendaciones/decisión del juez y trazabilidad |
| Historial | `historial-agente.ts:25-38`; fixtures `SupervisionAgentes:84-90` | Tabla y filtros locales de registros de ejemplo; no es auditoría real | Consulta paginable y filtros del historial auditable |
| Editar/eliminar tecnologías | `catalogo-tecnologias.ts:28-39,48-73`; UI `stack-tecnologico.ts:180-220` | CRUD localStorage; eliminación local también limpia asignaciones | CRUD de catálogo, autorizaciones, conflictos y persistencia multiusuario. No se encontró llamada HTTP |
| Asignar tecnologías a activos | `asignar-stack.ts:28-71`; `asignaciones-stack.ts:28-65` | Carga activos del servicio/catálogo local y guarda relaciones en localStorage; retorno a catálogo | Relación activo-tecnología y reglas del backend/iTop por confirmar |
| Alta de activo | `inventario-activos.ts:56-79`; consumidor `registrar-activo.ts:37-46` | POST si API habilitada; caso actual (bandera apagada) sintetiza registro y lo añade en memoria | POST está escrito; confirmar DTO, validación, generación de ID y respuesta |
| Asignación de propietario | `inventario-activos.ts:81-89`; consumidor `activos.ts:107-116` | PATCH si API habilitada; si no, toma registro local y muta propietario | PATCH está escrito; confirmar autorización, recurso/cuerpo/respuesta |
| Cambiar origen | `layout-principal.ts:28`; `origen-dashboard.ts:67` | Cambia signal en frontend; no hace solicitud | No requiere endpoint por sí solo salvo que backend determine perfiles de datos |
| Exportar catálogo | `stack-tecnologico.ts:226-235` | Genera CSV en navegador con tecnologías actuales | No requiere API si exporta dataset ya cargado; si se requiere exportación integral/paginada, confirmar contrato |

El código del dashboard no ofrece acciones “ejecutar/pausar/reiniciar agente” encontradas en la búsqueda de handlers. La configuración cambia únicamente la vista demo; no se halló ejecución real de agentes.

## Modelos y contratos

### Modelos internos encontrados

- Activos: `ActivoInventario` y `DatosNuevoActivo`, `src/app/servicios/inventario-activos.ts:6-36`.
- Tecnología y formulario: `TecnologiaEmpresa`, `DatosTecnologia`, `src/app/servicios/catalogo-tecnologias.ts:3-17`.
- Asignación: `AsignacionTecnologias`, `src/app/servicios/asignaciones-stack.ts:3-6`.
- Tickets, propuestas, ejecuciones y revisiones: `src/app/servicios/supervision-agentes.ts:3-58`.
- Vulnerabilidades y hallazgos: `src/app/servicios/resultados-vulnerabilidades-agente.ts:3-30`.
- `OrigenDashboard` mantiene objetos sin interfaces explícitas para los agregados de agentes y stack (`origen-dashboard.ts:11-55`).

### Estado del contrato

- **Backend confirmado:** ninguno se pudo verificar desde este repositorio.
- **Modelo interno de frontend:** interfaces anteriores; en el caso de activos, coinciden actualmente con el tipo que se declara como respuesta HTTP, lo que acopla transporte y vista.
- **Propuesto/no confirmado:** `ResultadoAgenteVulnerabilidades`, marcado como contrato propuesto en `resultados-vulnerabilidades-agente.ts:14`; no equivale a un contrato entregado por el backend.
- **Transformación/adaptador externo:** no encontrado. El `JSON.parse` de `CatalogoTecnologias` parte de `unknown` pero filtra solo `id` y `nombre` (`catalogo-tecnologias.ts:48-60`); no es adaptador backend. `HttpClient.get<T>()` y sus equivalentes no validan en runtime la estructura JSON.

Los campos obligatorios de interfaces internas son visibles en esos archivos. Aún no pueden usarse para exigir campos al backend hasta acordar DTO, opcionalidad, fechas, enums, unidades, errores y compatibilidad de versiones.

## Seguridad e integración

- **Credenciales en frontend:** se encontró un par de correo/contraseña demo en login (`login.ts:36-44`, `login.html:65`); no se reproducen aquí. Son credenciales de demostración, no credenciales de backend. No se encontró secreto/token de API.
- **Autenticación:** no se encontró servicio de autenticación, interceptor, `Authorization`/Bearer ni sesión real. El perfil indica `logoutDisponible = false` (`menu-perfil.ts:15-16`).
- **URL:** `http://localhost:3000/api` es visible en el bundle, como corresponde a una URL; usa HTTP y no es apta como URL de producción HTTPS sin configuración por entorno.
- **Errores:** inventario propaga error en GET (`inventario-activos.ts:49-52`); Inicio ignora error (`inicio.ts:20-22`); no hay estrategia de errores común ni manejo general verificado para POST/PATCH.
- **Validación:** existe validación de formulario y duplicados en algunas páginas, pero el JSON HTTP se acepta con tipos estáticos. No es validación runtime ni sustituye validación backend.
- **Separación demo/real:** el selector y varias páginas evitan fallback demo silencioso. Excepciones semánticas: el “catálogo real” es localStorage; el inventario sin API permite mutaciones en memoria bajo el origen real; por ello “real” significa modo seleccionado, no necesariamente origen empresarial.
- **Autorización:** controles de UI y modo demo no constituyen autorización. No hay evidencia de backend en el proyecto para verificar permisos.
- **CORS:** configuración no encontrada; debe ser implementada/configurada por el backend/infraestructura según origen del frontend.

## MAPA DE CONEXIÓN CON EL BACKEND

| Prioridad | Archivo / línea exacta | Qué conectar | Comportamiento actual | Qué enviar/recibir y método determinable | Contrato pendiente / consumidores |
|---|---|---|---|---|---|
| P0 | `src/app/config/api.config.ts:2-6` (`API_CONFIG`) | URL central, configuración por entorno y bandera actual | Base URL localhost, API desactivada | Configuración aprobada por entorno; no es llamada | URL base, HTTPS, ambientes y política de habilitación |
| P0 | `src/app/servicios/inventario-activos.ts:45-53` (`cargar`) | Lectura del inventario | GET `/activos` tipado como `ActivoInventario[]`; rama apagada en config | GET ya determinado por consulta existente | Contrato, filtros/paginación, estados, errores; consumidores Inicio, Activos y AsignarStack |
| P0 | `src/app/servicios/inventario-activos.ts:56-79` (`agregar`) | Alta de activo | POST existente; memoria cuando API apagada | POST `{...DatosNuevoActivo}`; respuesta `ActivoInventario` tipada | Campos requeridos, validación, ID, errores; consumidor `RegistrarActivo` |
| P1 | `src/app/servicios/inventario-activos.ts:81-89` (`asignarPropietario`) | Cambio de propietario | PATCH existente con `{ propietario }` | PATCH `/activos/{id}`; el código determina que es modificación | Permisos, reglas y respuesta; consumidor `Activos` |
| P1 | `src/app/servicios/catalogo-tecnologias.ts:20-73` | Sustituir persistencia navegador por acceso de dominio si catálogo será backend | CRUD localStorage `hermes-control.catalogo-tecnologias.v1` | GET/POST/PATCH/DELETE no determinables con precisión hasta acordar operaciones y contratos | Fuente de verdad, multiusuario, concurrencia; consumidores Inicio/Stack/AsignarStack |
| P1 | `src/app/servicios/asignaciones-stack.ts:9-65` | Relación entre activo y tecnologías | Map + localStorage | Operaciones de lectura/escritura requeridas funcionalmente; método HTTP depende del contrato | Cardinalidad, claves, origen iTop; consumidor AsignarStack y borrado de tecnología |
| P1 | `src/app/servicios/resultados-vulnerabilidades-agente.ts:14-44` | Recepción de resultados clasificados | Modelo propuesto y signal en memoria; solo `recibir()`/`limpiar()` | Transporte no determinable; no inventar endpoint ni verbo antes del contrato | Identificadores, prioridad, hallazgos por activo, conteo único, timestamp; consumidor Stack |
| P1 | `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts:46-78,149-159` | Separar fixture demo de vista y alimentar modelo del servicio | Conteos 3/6/9/4 en componente demo; real cuenta `vulnerabilities` del store | Sin llamada en la página | Contrato de resultados, estados de carga/error/integración; visualización en `stack-tecnologico.html:58-78` |
| P1 | `src/app/servicios/origen-dashboard.ts:8-67` | Mantener modo global, separar fixtures de repositorios reales | Signal de modo + fixtures inline | No es servicio API | Contratos de agentes, stack, tecnologías/activos; consumidores Inicio, Agentes, Activos, Stack y layout |
| P1 | `src/app/servicios/supervision-agentes.ts:60-116` | Sustituir o complementar fuentes demo por servicios de dominio | Tickets, ejecuciones, recomendaciones, config y HITL en memoria | Verbos por recurso no deben definirse hasta contratos de consulta y mutación | Autorización, auditoría, responsables, transición, juez; consumidores Agentes, Historial, Recomendaciones, HITL, Configuración |
| P2 | `src/app/rutas/Agentes/control-agente.ts:43-107` | Presentar modelos internos para métricas/gráficas | Datos demo y agregación local; sin petición | Consultas a confirmar (telemetría/agregados) | Ventana temporal, definiciones KPI y unidades; consumidores únicamente la página/control charts |
| P2 | `src/app/rutas/Inicio/inicio.ts:20-35` | Adaptar tarjetas de resumen a estado agregado | Combina demo, catálogo local e inventario; error se ignora | Ideal consumir servicios comunes/resultado resumen, no inventar endpoint | Origen de cada métrica, fecha de corte y estados vacíos |
| P2 | `src/app/rutas/Login/login.ts:25-44`; `menu-perfil.ts:15-16` | Autenticación e identidad compartida | Login local contra literales; usuario perfil fijo | Método/ruta no determinables sin diseño de auth del equipo | Proveedor, cookie/token, CSRF, logout, roles y políticas |
| P2 | `src/app/rutas/Configuracion-agente/configuracion-agente.ts:59-79` | Configuración real autorizada | Solo demo en memoria; guardado bloqueado en modo real | Modificación HTTP no determinable sin contrato y política | Valores permitidos, autorización, confirmación/auditoría backend |
| P2 | `src/app/rutas/Revision-humana/revision-humana.ts:78-90`; `SupervisionAgentes:103-116` | Decisión HITL real | Actualiza estado demo, comentario, puntaje y responsable en memoria | Operación de decisión no determinable hasta acordar transición/endpoint | Autorización, trazabilidad, idempotencia, rangos y auditoría |

### No modificar cada gráfica manualmente

El componente visual `GraficoDashboard` ya recibe una opción tipada y no debería conocer el JSON externo. La capa única a preparar es: selector global de origen → repositorio/servicio por dominio → validación de respuesta desconocida → adaptador a modelos internos → transformación de modelo a opción ECharts en capa de presentación. Los fixtures deben quedar como fuente demo identificable. Así se actualizan los datos del dominio y se conservan las gráficas/componentes. Hoy `GraficoDashboard` ya resuelve render, tema y resize; no es la capa de datos.

## Arquitectura mínima recomendada

1. Confirmar con el backend el contrato y el mecanismo de autenticación antes de habilitar llamadas reales.
2. Conservar `API_CONFIG` como único punto de URL, trasladando valores a configuración por entorno solo con autorización de cambios de configuración.
3. Mantener servicios por dominio (Activos, Tecnologías, Agentes/Tickets, Vulnerabilidades), no por gráfica.
4. Separar DTO externo de modelos de interfaz; recibir JSON como `unknown`, validar estructura y adaptar en una capa pequeña. No agregar mapeos ficticios antes del contrato.
5. Centralizar el estado de consulta (`loading`, `data`, `empty`, `error`, `pending`) y respetar el selector global para elegir fuente. No caer a fixtures cuando el modo sea real.
6. Extraer fixtures existentes a fuentes demo cuando se trabaje cada dominio, sin cambiar la presentación en bloque.
7. Empezar por vulnerabilidades como piloto: el tipo interno existe, pero los conteos demo residen en la página y el servicio real no se alimenta desde ningún transporte encontrado.

## Información que solicitar al equipo backend

- OpenAPI/Swagger o contrato versionado con rutas, verbos, query params, cuerpos, respuestas y errores.
- URL por ambiente, HTTPS, CORS y estrategia de timeout/reintentos.
- Autenticación, cookies/tokens, renovación, logout, CSRF y permisos por operación.
- Inventario iTop: clases/atributos disponibles, identificadores, relaciones, paginación, filtros, nullability y frecuencia de sincronización.
- Catálogo tecnológico y relaciones activo-tecnología; especificar fuente de verdad y escritura permitida.
- Métricas de agentes: definiciones KPI, periodo, zona horaria, unidades, estados y series alineadas.
- Tickets, recomendaciones, juez e HITL: transiciones, quién decide, auditoría, comentarios, responsable, puntajes/rangos e idempotencia.
- Vulnerabilidades: resultado único vs. hallazgo por activo, CVE/CVSS y versión, prioridad del agente, justificación, explotación, tecnología/activo, timestamps y procedencia.
- Semántica explícita para vacío, no evaluado, pendiente, no disponible y error.

## Checklist de integración futura

- [ ] Contratos y autenticación aprobados; no hay secretos en Angular.
- [ ] URL centralizada por entorno y despliegue HTTPS.
- [ ] DTO JSON validado en runtime antes de adaptación.
- [ ] Modelos internos independientes del JSON del servidor.
- [ ] Servicios por dominio y tratamiento común de errores/estados.
- [ ] Origen demo/real excluyente, sin fallback silencioso.
- [ ] Catálogo y relaciones dejan de etiquetarse como backend-real si solo son localStorage.
- [ ] Las métricas tienen definiciones y periodos acordados.
- [ ] Acciones sensibles se autorizan y auditan en backend; la UI no es control de acceso.
- [ ] Casos demo y errores de red probados sin mezclar datos.
- [ ] Actualización manual definida; no agregar polling/WebSocket sin contrato.

## Respuestas solicitadas

**A. Grado dependiente de hardcoding/demo:** alto en el conjunto de métricas y pantallas operativas. No doy porcentaje porque no hay criterio cuantitativo reproducible en el proyecto. El inventario es la única integración HTTP de negocio encontrada y está desactivada por `usarApi=false`.

**B. Módulos preparados:** Activos parcialmente (GET/POST/PATCH escritos, contrato no confirmado); Vulnerabilidades parcialmente a nivel de modelo interno; el resto no tiene API real verificada. ECharts está desacoplado de JSON, pero su página recibe datos demo directamente.

**C. URL base:** `src/app/config/api.config.ts:2-6`, propiedad `API_CONFIG.baseUrl`. Mantenerla como central; configurar por ambiente cuando se autorice y confirme el despliegue.

**D. Verbos actuales:** GET, POST y PATCH están únicamente en `src/app/servicios/inventario-activos.ts:47,58,83`. No se encontraron PUT ni DELETE HTTP.

**E. Archivos principales que revisar al recibir backend:** `api.config.ts:2-6`; `inventario-activos.ts:41,45-89`; `catalogo-tecnologias.ts:20-73`; `asignaciones-stack.ts:9-65`; `resultados-vulnerabilidades-agente.ts:14-44`; `origen-dashboard.ts:8-67`; `supervision-agentes.ts:60-116`; `stack-tecnologico.ts:46-78,99-165`; `control-agente.ts:43-107`; `activos.ts:14-117`; `inicio.ts:15-35`. Las líneas son referencias actuales, no identificadores permanentes.

**F. Contratos a solicitar:** inventario y alta/cambio de activo; catálogo/relaciones tecnológicas; agentes y telemetría; tickets, historial, recomendaciones/juez y decisiones HITL; configuración; vulnerabilidades clasificadas; autenticación e identidad. Ver lista detallada anterior.

**G. Adaptar una sola vez:** validación de DTO externo, adaptadores por dominio, estados de consulta y selección de fuente. `GraficoDashboard` debe continuar consumiendo modelos/opciones de presentación y no acoplarse al JSON.

**H. Funcionalidades demo:** login, perfil, paneles de agente, recomendaciones/juez, historial, HITL, configuración, evaluaciones de stack, vulnerabilidades demo, catálogo y asignaciones locales. Alta de activo y cambio de propietario simulan en memoria cuando la bandera API está apagada.

**I. Cinco preparaciones prioritarias:** (1) pedir contrato OpenAPI, autenticación y ambientes; (2) mantener URL central y habilitación segura por ambiente; (3) separar DTO/adaptadores/modelos internos con validación runtime; (4) normalizar consulta/estado real-demo y los estados vacío/error/pendiente; (5) pilotar Vulnerabilidades y luego migrar servicios por dominio, empezando por catálogo/activos y agentes sin reescribir gráficas.

## Verificaciones y limitaciones

- Se inspeccionaron archivos fuente y búsquedas recursivas de transporte, URLs, almacenamiento, fixtures, gráficas y acciones.
- No se instalaron dependencias ni se modificó el código/configuración.
- No se ejecutó build ni prueba interactiva: el entregable es un diagnóstico estático y no hubo cambio de aplicación que validar.
- No se pudo consultar `git status`: el directorio de trabajo reportó que no es un repositorio Git.
- La existencia/operatividad del backend, contratos, CORS, autenticación y permisos no se puede verificar desde este código.
