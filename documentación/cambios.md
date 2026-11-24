# Funcionalidades y cambios

## Comparación de evaluaciones de jueces en Revisión Humana

**Qué cambió:** el modal existente distribuye las propuestas y la evaluación en dos columnas (45/55 aprox.). En el caso demo `TCK-DEMO-1043`, las dos tarjetas se identifican como Juez 1 y Juez 2 porque ahora incluyen evaluaciones explícitas con IDs internos distintos. La selección se hace con la propia tarjeta, que es un botón accesible por teclado; su estado seleccionado actualiza el título y el contenido del panel derecho. Un solo registro produce una sola tarjeta.

**Puntajes y contenido:** cada evaluación demo incluye puntaje original (7.8), determinista (7.5) y propio del juez (4.2 o 6.9), con una escala de demostración sin afirmar CVSS. El método `puntajeDelJuez(revision)` conserva el cero y deja que valores ausentes se presenten como “No disponible”. Opinión, análisis y justificación se leen de la primera opinión explícita de la tarjeta activa y solo se presentan en el panel derecho. Las propuestas discrepan: Juez 1 recomienda resolver y Juez 2 recomienda seguimiento. Los fixtures permanecen en `SupervisionAgentes` y el modo real continúa sin datos de jueces.

**Archivos modificados:** `src/app/rutas/Revision-humana/revision-humana.ts`, `.html`, `.css`; `src/app/servicios/supervision-agentes.ts`; y esta documentación.

**Resolución conjunta pendiente:** no se encontró un endpoint ni respuesta del backend para resolver conjuntamente las evaluaciones de un caso. La UI no marca ambas como resueltas por inferencia. El contrato debe indicar que la resolución conjunta fue confirmada y exponer el estado final de cada evaluación (o estado compartido verificable), además de identificar el caso y las evaluaciones afectadas. No se propone una ruta ni un verbo HTTP sin especificación backend. La decisión disponible en modo demo sigue siendo una modificación solo en memoria.

**Verificación:** `npm run build` terminó correctamente y prerenderizó 12 rutas. Reportó advertencias de bundle inicial (778.36 kB frente al presupuesto de 500 kB), presupuesto CSS excedido en Login e Inicio, y un icono sin uso en Login; no corresponden a esta modificación. No se realizó verificación interactiva en navegador para desplazamiento, foco, selección y ambos temas. En modo real, las evaluaciones y puntajes demo no se muestran por la selección de origen del componente.

## Supervisión, configuración y revisión humana de agentes

**Qué hace:** separa la supervisión del dashboard en secciones de Configuración, Historial, Recomendaciones del juez y Revisión humana. El dashboard muestra métricas por ejecución y tickets únicos en el modo demo. Cada vista muestra de forma visible si usa ejemplos o si falta la API real.

**Cómo funciona hoy:** `SupervisionAgentes` centraliza tickets, ejecuciones, propuestas y casos de revisión ficticios. Los conteos de tickets usan identificadores únicos; las categorías de estado son excluyentes; los tickets escalados y reasignados se muestran como atributos que pueden coincidir con otros estados. El porcentaje demo resuelto es tickets únicos completados / recibidos × 100. El tiempo promedio demo toma los minutos de resolución de tickets completados con esa medición; no se calcula a partir de duración de ejecuciones. Estos datos son ejemplos, no telemetría ni auditoría.

La configuración muestra los perfiles Bajo/Medio/Alto/Personalizado y las herramientas existentes. Guardar abre una confirmación con parámetro, valor anterior/nuevo e impacto. Al confirmar, solo actualiza una vista previa en memoria cuando el selector global está en demo; Cancelar descarta el borrador. Los perfiles no tienen umbrales ni alteran el comportamiento de agentes reales. Los permisos actuales se presentan como información no editable, ya que no hay API de autorización.

Recomendaciones conserva juntas las propuestas en conflicto e incluye análisis, justificación, estado previo/propuesto y decisión del juez de ejemplo. Revisión humana ofrece una sola acción seleccionable por caso, confirmación, comentario opcional, responsable desde la lista demo y registro de transiciones en memoria. Cambiar un puntaje en esta vista no calcula CVSS. El usuario aclaró que se refiere a CVSS producido por agentes; versión, vector, escala admitida y reglas del backend siguen pendientes y no se inventan.

**Archivos:** `src/app/rutas/Agentes/control-agente.ts/.html/.css`; nuevas rutas `Configuracion-agente/`, `Historial-agente/`, `Recomendaciones-agente/` y `Revision-humana/`; nuevo `src/app/servicios/supervision-agentes.ts`; componente `src/app/componentes/ayuda-tooltip/`; `src/app/app.routes.ts`; `src/app/componentes/sidebar-principal/sidebar-principal.ts`; `src/app/componentes/layout-principal/layout-principal.css`; `src/styles.css`; y documentación.

**Límites y APIs necesarias:** no existen endpoints ni persistencia para agentes, configuración, tickets, ejecuciones, agente juez, comentarios o decisiones HITL. Firebase autentica la identidad, pero no define por sí mismo roles empresariales; los ejemplos usan datos simulados y no registran cambios reales. Antes de habilitar producción, acordar contratos para esos recursos, quién puede decidir/reasignar, responsables válidos, transiciones de estado, auditoría inmutable y rangos de puntaje. CVSS debe llegar desde el agente/backend con su versión/vector/puntaje; este cliente no define su cálculo.

**Comprobación manual:** inicia sesión con una cuenta Firebase autorizada y selecciona Datos de demostración en el selector global. En Configuración cambia un perfil o herramienta, revisa la comparación de valores y prueba Cancelar y Confirmar; el aviso debe indicar que solo vive en memoria. En Historial filtra por fecha, agente, ticket, estado y tipo y abre Detalle. En Recomendaciones compara las dos propuestas de TCK-DEMO-1043. En Revisión humana prueba marcar y revisar un caso, elige una única acción, agrega un comentario y confirma; el registro de transición debe aparecer abajo. Cambiar el selector a Datos reales debe ocultar ejemplos y deshabilitar cambios; no se harán escrituras API. Cambia tema y ancho para revisar legibilidad. Para CVSS, solo comprobar que la interfaz lo identifica como pendiente, sin calcular un valor.

**Verificación automatizada:** `npm run build` completó correctamente y prerenderizó 12 rutas. Conserva la advertencia de presupuesto: bundle inicial 683.95 kB frente a 500 kB, además de un icono ArrowRight sin uso en Login. `npm test -- --watch=false` ejecutó dos pruebas: una pasó y `should render title` falló porque `app.spec.ts` busca “Hello…” en un `h1`, pero la aplicación abre Login y no encuentra ese encabezado. No se cambió el test fuera del alcance. No se verificaron los flujos visuales en navegador; las vistas de operación real permanecen vacías/deshabilitadas hasta conectar backend.

## Origen real y demostrativo de los dashboards

**Qué hace:** permite alternar desde el encabezado entre Datos reales y Datos de demostración. El modo real es el predeterminado. Cada vista identifica el origen y muestra estados vacíos o de conexión; las métricas reales no se completan con ejemplos automáticamente.

**Cómo funciona:** `OrigenDashboard` centraliza el modo seleccionado y los ejemplos coherentes. Agentes no tiene API conectada y por eso muestra “Sin datos” en modo real; sus acciones locales solo están habilitadas en demostración. Stack muestra el catálogo empresarial real guardado en el navegador o un catálogo de ejemplo de solo lectura. Sus indicadores de calidad, madurez, valor y evolución solo aparecen en demo; sin evaluaciones reales se conserva “Sin evaluar”. Activos obtiene sus registros desde `InventarioActivos` (API opcional o registros añadidos en la sesión) y calcula total, propietarios, distribución por tipo y estado desde esa misma lista. El inventario real comienza vacío. Los datos demo viven en memoria y el cambio de modo no llama a las operaciones de escritura.

**Archivos:** nuevo `src/app/servicios/origen-dashboard.ts`; `src/app/servicios/inventario-activos.ts`; `src/app/componentes/layout-principal/layout-principal.ts`, `.html` y `.css`; vistas y estilos de Agentes, Stack Tecnológico y Activos; y esta documentación.

**Cómo conectar APIs:** activos ya usa `GET /activos`, `POST /activos` y `PATCH /activos/{id}` en `InventarioActivos`; actualiza `API_CONFIG` cuando el backend esté disponible. Para agentes y Stack se necesitarán servicios/endpoints con contratos para sus métricas y evaluaciones; hasta entonces, el modo real deja esos datos vacíos o sin evaluar. Los ejemplos pueden editarse únicamente en `OrigenDashboard`; no se copian al catálogo ni al inventario real.

**Comprobación:** en cada pantalla cambia el selector entre Datos reales y Datos de demostración y verifica la etiqueta visible. En Stack agrega un registro real y confirma que los conteos y la gráfica por categoría reaccionan; al volver a demo, el formulario de edición queda oculto y se muestran ejemplos. En Activos registra datos reales con la API desactivada para que aparezcan en la sesión; confirma que el inventario inicia vacío y que los totales y distribuciones se derivan de sus registros. Para revisar error de conexión, activa la API y usa un backend no disponible: se debe mostrar el mensaje sin conservar la lista anterior. Cambia el tema claro/oscuro y reduce el ancho para revisar selector, tarjetas y gráficas.

**Verificación automatizada:** `npm run build` terminó correctamente y prerenderizó ocho rutas. Conserva la advertencia del presupuesto del bundle inicial (623.32 kB frente al límite de 500 kB) y una advertencia de icono sin uso en Login. `npm test -- --watch=false` ejecutó dos pruebas: una pasó y `should render title` falló porque espera “Hello…” en un elemento `h1`, pero la app actual muestra Login y no encuentra ese encabezado. No se modificó esa prueba fuera del alcance.

## Asignación de stack tecnológico a activos

**Qué hace:** añade una vista para elegir un activo, seleccionar varias tecnologías del catálogo disponible y guardar la relación. Muestra una lista de asignaciones realizadas durante la sesión actual.

**Implementación:** la nueva ruta `/asignar-stack` está disponible en la navegación lateral. `AsignacionesStack` mantiene las relaciones en memoria, mientras que `InventarioActivos` proporciona la lista de activos. La selección de tecnologías es un catálogo de demostración alineado con la pantalla Stack Tecnológico; las asignaciones se reinician al recargar y todavía no se envían a una API.

**Archivos:** `src/app/rutas/Asignar-stack/asignar-stack.ts`, `.html`, `.css`, `src/app/servicios/asignaciones-stack.ts`, `src/app/app.routes.ts` y `src/app/componentes/layout-principal/layout-principal.ts`.

**Comprobación manual:** abre “Asignar stack” en el menú, selecciona un activo, elige una o más tecnologías con Ctrl/Command y pulsa “Guardar asignación”. La relación debe aparecer en “Stacks asignados”. Cambiar el activo debe cargar la selección previamente guardada en esta sesión.

## Preparación para conectar el inventario a una API

**Qué hace:** deja el inventario listo para alternar entre datos de demostración y una API REST, sin perder el modo demo mientras el backend no exista.

**Implementación:** `API_CONFIG` centraliza la URL base (`http://localhost:3000/api`) y el interruptor `usarApi`, que inicia en `false`. Al activarlo, `InventarioActivos` consulta `GET /activos` y registra con `POST /activos`. El GET debe devolver una lista con los campos de `ActivoInventario`; el POST recibe los campos del formulario (`DatosNuevoActivo`) y debe responder con el activo ya normalizado para la tabla. La pantalla muestra estados de carga y error. Angular `HttpClient` queda habilitado en la configuración de la aplicación. Se requiere que el backend permita CORS desde el origen del frontend.

**Archivos:** `src/app/config/api.config.ts`, `src/app/app.config.ts`, `src/app/servicios/inventario-activos.ts`, `src/app/rutas/Activos/activos.ts`, `activos.html`, `src/app/rutas/Registrar-activo/registrar-activo.ts` y `registrar-activo.html`.

**Cómo conectar el backend después:** actualiza `baseUrl` y cambia `usarApi` a `true` en `api.config.ts`. Asegúrate de que el backend exponga los dos endpoints y use los contratos descritos arriba. El login, las estadísticas del dashboard, las cifras de resumen y la distribución de activos siguen siendo datos de demostración y necesitarán sus propios endpoints cuando exista el backend.

**Comprobación manual:** con `usarApi: false`, abre Activos y registra un elemento; debe aparecer en la tabla durante esa sesión. Con un backend disponible, configura su URL, activa `usarApi` y revisa que la tabla cargue desde `GET /activos` y que el formulario envíe `POST /activos`. Si hay un error HTTP, la interfaz informa que no pudo cargar o guardar.

## Inicio de sesión y navegación

**Qué hace:** la raíz (`/`) abre Login. Solo Firebase Authentication permite iniciar sesión. El origen Datos de demostración es una selección de datos disponible después de autenticar y no crea una identidad ni concede permisos.

**Implementación:** Login conserva su formulario reactivo y valida correo/contraseña antes de llamar a Firebase. Las rutas del `LayoutPrincipal` usan un guard que espera el estado de Firebase. Los roles y las operaciones reales requieren autorización del backend.

**Archivos:** `src/app/app.routes.ts`, `src/app/app.ts`, `src/app/app.html`, `src/app/componentes/layout-principal/layout-principal.ts`, `layout-principal.html`, `layout-principal.css`, `src/app/rutas/Login/login.ts` y `login.html`.

**Comprobación:** abre `/` y confirma que aparece Login. Intenta enviar campos inválidos, después inicia sesión con una cuenta Firebase autorizada y confirma que se abre la aplicación. Usa el menú para abrir Stack tecnológico y Activos.

## Control del agente

**Qué hace:** muestra estado, modelo, última ejecución, uptime, permisos, herramientas disponibles y métricas de operación. Iniciar, pausar y reiniciar actualizan el estado simulado; Ejecutar flujo lo cambia a “Ejecutando”. Los interruptores habilitan o deshabilitan herramientas localmente.

**Implementación:** `ControlAgente` guarda el estado y la lista de herramientas en memoria. Las tarjetas, gráficas y métricas usan valores de demostración escritos en la plantilla y los estilos; no representan telemetría real.

**Archivos:** `src/app/rutas/Agentes/control-agente.ts`, `control-agente.html`, `control-agente.css`, `src/styles.css` y `src/app/app.routes.ts`.

**Comprobación:** abre `/agentes`, prueba cada botón de acción y alterna una herramienta. Cambia el selector de periodo y revisa que la vista se ajuste al reducir el ancho del navegador.

## Stack tecnológico

**Qué hace:** presenta métricas globales, salud del stack, puntuaciones por categoría, una tabla de 48 tecnologías de ejemplo, filtro de categoría, paginación, exportación CSV, cuadrante de madurez y hallazgos ejecutivos.

**Implementación:** `StackTecnologico` genera datos de demostración en memoria. El filtro y la paginación se calculan localmente. Exportar construye un archivo CSV desde el catálogo simulado. Los gráficos se dibujan con CSS y HTML, sin dependencias adicionales.

**Archivos:** `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts`, `stack-tecnologico.html`, `stack-tecnologico.css`, `src/styles.css` y `src/app/app.routes.ts`.

**Comprobación:** abre `/stack-tecnologico`, filtra por categoría, cambia de página y pulsa Exportar para descargar el CSV. Confirma que aparecen las tarjetas, el gráfico de categorías, el cuadrante y los hallazgos.

## Activos empresariales

**Qué hace:** muestra indicadores, filtros por búsqueda/tipo/estado, una tabla paginada, distribución por tipo y contexto empresarial. Registrar activo abre el formulario existente.

**Implementación:** `InventarioActivos` ofrece un inventario de muestra compartido dentro de la sesión. El formulario agrega el activo a esa lista y vuelve al inventario; al recargar la página, los datos regresan a los valores iniciales porque no hay persistencia.

**Archivos:** `src/app/rutas/Activos/activos.ts`, `activos.html`, `activos.css`, `src/app/servicios/inventario-activos.ts`, `src/app/rutas/Registrar-activo/registrar-activo.ts`, `registrar-activo.html`, `registrar-activo.css`, `src/styles.css` y `src/app/app.routes.ts`.

**Comprobación:** abre `/activos`, busca por nombre o propietario, combina filtros, cambia el número de filas y pagina la tabla. Pulsa Registrar activo, completa el formulario y envíalo; el activo debe aparecer al inicio del inventario. Cancelar vuelve a la tabla sin agregarlo.

## Estilos compartidos y diseño adaptable

El marco común se define en `src/app/componentes/layout-principal/layout-principal.css`. Los estilos específicos de las tres pantallas se mantienen en sus archivos CSS y se cargan desde `src/styles.css` dentro de reglas `@scope`, con una clase raíz por vista para evitar que las reglas de tablas y tarjetas se mezclen. Las vistas reorganizan sus columnas para tabletas y móviles.

## Verificación realizada

- `npm run build`: compilación Angular completada correctamente y prerenderizado de 7 rutas.
- Durante la primera compilación se detectó que Angular no expone `Math` directamente en expresiones de plantilla; se reemplazó por métodos del componente para avanzar/retroceder páginas.
- La hoja de estilos de cada pantalla superaba el presupuesto por componente de Angular. Se conservaron los archivos CSS y se cargaron desde la hoja global con estilos delimitados por `@scope`, sin cambiar la configuración del proyecto.
- No se añadieron dependencias ni se conectaron servicios reales.

## Ajuste visual de Hermes Control

**Qué hace:** unifica la tipografía con Inter y sus pesos 400, 500, 600 y 700, refina la jerarquía de títulos y métricas, y acerca las pantallas de Control del agente, Stack tecnológico y Activos a las referencias visuales. En escritorio se mantienen las tarjetas superiores de Agentes en una fila; las columnas se reorganizan al estrechar el área disponible y la navegación móvil conserva la marca Hermes Control.

**Implementación:** `src/styles.css` define la familia tipográfica global y sus alternativas sans serif; `src/index.html` declara la carga de Inter. `layout-principal.css` ajusta las proporciones del menú, el espacio de trabajo y la cabecera móvil. `control-agente.css`, `stack-tecnologico.css` y `activos.css` afinan tarjetas, tablas, gráficas, espacios, bordes y estados. La tabla de Activos usa anchos por columna para reducir saltos de línea; los iconos de tecnología se presentan como iniciales en insignias consistentes. No se cambiaron servicios ni lógica de negocio y no se agregaron dependencias.

**Archivos:** `src/index.html`, `src/styles.css`, `src/app/rutas/Login/login.css`, `src/app/componentes/layout-principal/layout-principal.html`, `layout-principal.css`, `src/app/rutas/Agentes/control-agente.css`, `src/app/rutas/Stack-tecnologico/stack-tecnologico.css`, `stack-tecnologico.ts` y `src/app/rutas/Activos/activos.css`.

**Comprobación:** `npm run build` finalizó correctamente y prerenderizó 7 rutas. Se revisaron capturas del navegador a 1448×1080 y Control del agente a 390×844; la vista móvil no presentó desbordamiento horizontal y las tarjetas de escritorio quedaron alineadas en una fila. En esta sesión no se pudo descargar Google Fonts: Inter está declarada, pero el navegador no registró la fuente y mostró la alternativa sans serif. Con acceso a Google Fonts, se puede comprobar Inter en DevTools > Computed/Rendered Fonts.

## Iconografía y gráficas con Lucide y ECharts

**Qué hace:** unifica los iconos de navegación y las tres vistas con Lucide y reemplaza las gráficas de demostración por gráficos SVG de ECharts en Agentes y Stack tecnológico. Se conservan los datos simulados, las acciones y los formularios existentes.

**Implementación:** el componente compartido `GraficoDashboard` recibe opciones tipadas de ECharts y las renderiza en SVG. Carga los módulos de ECharts de forma diferida solo en navegador, registra los tipos de gráfico usados y observa el tamaño del contenedor para reajustar el dibujo. Al destruirse desconecta el observador y libera la instancia, evitando inicializar ECharts durante SSR. Los iconos se importan desde `@lucide/angular` y se eligen por vista.

**Archivos:** `src/app/componentes/grafico-dashboard/grafico-dashboard.ts`, `.html` y `.css`; `src/app/componentes/layout-principal/layout-principal.ts`, `.html` y `.css`; `src/app/rutas/Agentes/control-agente.ts`, `.html` y `.css`; `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts`, `.html` y `.css`; y `src/app/rutas/Activos/activos.ts`, `.html` y `.css`. Se añadieron `@lucide/angular` y `echarts` a `package.json` y `package-lock.json`.

**Comprobación:** ejecuta `npm run build` y abre `/agentes`, `/stack-tecnologico` y `/activos`. En Agentes, confirma el gráfico de éxito, la tendencia, el uso de herramientas y el desempeño; en Stack, el indicador, las categorías, la matriz y la evolución. Prueba la navegación, filtros, paginación, controles del agente y el formulario de activos para comprobar que las funciones existentes siguen disponibles. Reduce el ancho a móvil para revisar el reflujo.

**Resultado de verificación:** `npm run build` compila y prerenderiza las siete rutas. Se revisaron capturas de navegador de escritorio (1448 × 1080) y Agentes en móvil (390 × 844); los gráficos SVG se renderizan y la vista móvil no presenta desbordamiento horizontal. La matriz de madurez oculta las etiquetas numéricas internas para evitar que choquen con las etiquetas de cuadrantes. No se cambiaron servicios ni configuraciones de Angular. El build avisa que el bundle inicial supera el presupuesto configurado en unos 57 kB y que una hoja CSS supera su presupuesto; no se aumentaron esos límites.

**Tipografía:** Inter continúa declarada en `src/index.html` con alternativa sans serif, pero el navegador de verificación no pudo descargar Google Fonts y no registró Inter. Con acceso a Google Fonts, confirma la familia efectiva en DevTools > Computed/Rendered Fonts. La interfaz comprobada utilizó el fallback sans serif.

## Sidebar oscura compartida entre temas

**Qué hace:** conserva la sidebar oscura con la imagen original de la carretera tanto en el tema oscuro como en el tema claro. El interruptor sigue cambiando el tema del área principal; navegación, marca y perfil mantienen contraste claro sobre la sidebar.

**Implementación:** los estilos de fondo, superposición, color de texto, navegación activa y perfil ahora son compartidos por ambos temas en `layout-principal.css`. Se retiró la regla de tema oscuro que aclaraba la sidebar y las dos reglas globales que oscurecían el texto del perfil. En pantallas pequeñas la barra inferior también usa el fondo oscuro con la carretera atenuada.

**Archivos:** `src/app/componentes/layout-principal/layout-principal.css`, `src/styles.css`.

**Comprobación:** cambia entre tema claro y oscuro con el botón superior. Verifica que el contenido principal alterne, pero la sidebar conserve fondo morado oscuro, carretera visible abajo, textos claros y selección fucsia. Reduce el ancho para comprobar la barra de navegación inferior.

## Acciones de inventario

En Activos, “Asignar propietario” abre un formulario para elegir un activo y cambiar su responsable. “Ocultar inventario” pliega la tabla y el botón cambia a “Ver inventario” para mostrarla de nuevo. La actualización local dura durante la sesión; con API activa, requiere `PATCH /activos/{id}` y una respuesta con el activo actualizado.

## Componentes reutilizables de interfaz

La barra lateral se aisló en `src/app/componentes/sidebar-principal/`, y las cabeceras de Agentes, Stack Tecnológico y Activos usan `src/app/componentes/banner-pagina/`. Las gráficas ECharts ya se renderizan mediante el componente reutilizable `src/app/componentes/grafico-dashboard/`. Para editar cada pieza, modifica su TypeScript y plantilla; conserva las clases CSS de las vistas para mantener el estilo actual. El botón “Asignar tecnologías” está encima de la tabla de evaluación y lleva a `/asignar-stack`. En navegación móvil se distribuyen los ocho accesos para mantener visible también Asignar stack.


## Corrección de textos e indicadores de Stack

**Causa:** src/index.html ya declara UTF-8 y los archivos de la pantalla se pueden leer como UTF-8. La causa estaba en cadenas guardadas con mojibake tras una interpretación incorrecta de bytes UTF-8 como Windows-1252/ISO-8859-1; no en datos JSON ni en una conversión de Angular en tiempo de ejecución.

**Cambios:** se corrigieron las cadenas visibles y accesibles en la plantilla Stack, el nombre de navegación y el marco compartido. Los indicadores de tendencia usan el icono SVG Lucide ArrowUp. Se añadieron reglas CSS pequeñas para fijar el tamaño y la alineación de esos iconos. No se modificaron datos, funcionalidades, configuración ni dependencias.

**Archivos:** src/app/rutas/Stack-tecnologico/stack-tecnologico.html, stack-tecnologico.ts, stack-tecnologico.css, src/app/componentes/sidebar-principal/sidebar-principal.ts, sidebar-principal.html y src/app/componentes/layout-principal/layout-principal.html.

**Verificación:** npm run build completó correctamente y prerenderizó ocho rutas. La compilación mantiene la advertencia existente de que el bundle inicial excede el presupuesto configurado en 116.39 kB. Se comprobó la presencia de UTF-8 y la ausencia de secuencias mojibake en los archivos relevantes. No había navegador disponible para revisar capturas; filtros, paginación y exportación no se alteraron.


## Catálogo empresarial y asignaciones de tecnologías

**Qué hace:** permite registrar, editar y eliminar tecnologías de la empresa, clasificarlas por categoría, estado y licencia, y asignar varias a cada activo desde el catálogo. Evita duplicados por nombre sin distinguir mayúsculas y mantiene una confirmación antes de eliminar.

**Implementación:** CatalogoTecnologias guarda los registros en localStorage; AsignacionesStack guarda los identificadores de tecnologías seleccionados para cada activo. La pantalla de Stack deriva sus conteos y distribución por categoría del catálogo. Las puntuaciones de calidad, madurez y confiabilidad y la criticidad indican "Sin evaluar", pues no hay datos para calcularlas. El almacenamiento es local al navegador, no sincroniza usuarios o dispositivos y puede borrarse desde la configuración del navegador. Los activos continúan viniendo del inventario existente.

**Archivos:** nuevo src/app/servicios/catalogo-tecnologias.ts; src/app/servicios/asignaciones-stack.ts; src/app/rutas/Stack-tecnologico/stack-tecnologico.ts, .html y .css; src/app/rutas/Asignar-stack/asignar-stack.ts, .html y .css; plantillas de Activos y Agentes para corregir textos y símbolos; y este documento.

**Codificación:** src/index.html ya declara UTF-8. Los errores estaban escritos literalmente en las plantillas de Activos y Agentes; se corrigieron de forma puntual y las flechas de tendencia ahora usan SVG de Lucide. No se encontraron datos JSON del catálogo ni conversiones en tiempo de ejecución.

**Comprobación manual:** agrega una tecnología en Stack y confirma sus conteos, estado y categoría; edítala, comprueba que el mismo nombre duplicado se rechaza y elimínala confirmando el diálogo. En Asignar stack selecciona un activo, busca y marca varias tecnologías, guarda, cambia de activo y usa Modificar. Recarga y comprueba que catálogo y asignaciones persistan. Borra el catálogo para revisar el estado vacío. Ejecuta npm run build para compilar las rutas.


**Resultado de verificación:** npm run build terminó correctamente y prerenderizó ocho rutas. La salida prerenderizada de Stack muestra el estado vacío y Sin evaluar; no contiene las tecnologías de muestra anteriores. La lectura UTF-8 de las fuentes pasa y no quedan marcadores de mojibake en src. npm test -- --watch=false no pudo iniciar el worker de Vitest por timeout y no ejecutó pruebas. No se dispuso de navegador para probar interacciones visualmente. El build conserva la advertencia de presupuesto del bundle inicial: 621.71 kB frente a un límite de 500 kB. No se cambió la configuración.

## Corrección de contraste y desbordamientos en modo oscuro

**Problemas encontrados:** las tarjetas KPI de tickets de Agentes conservaban un fondo casi blanco mientras las reglas globales les asignaban texto claro. Configuración, historial, recomendaciones y revisión humana tenían textos auxiliares y controles con colores fijos pensados para el tema claro. En ECharts algunos ejes, leyendas, etiquetas y tooltips no definían colores, por lo que podían aparecer oscuros sobre el fondo oscuro. El encabezado móvil podía comprimir la búsqueda y el selector de origen.

**Cambios:** se añadieron reglas compartidas que usan los tokens del tema oscuro para superficies, bordes, textos, formularios y tablas; el tema claro conserva sus colores. Las KPI de tickets usan superficie oscura y cifras legibles. ECharts completa los colores de texto ausentes según el tema y adapta el tooltip, conservando los colores definidos por cada gráfica. Aumentó ligeramente el tamaño de algunas etiquetas de ejes en Agentes y Stack. El encabezado móvil reparte el espacio disponible, y las tablas conservan todas sus columnas con desplazamiento dentro de su contenedor.

**Archivos:** `src/styles.css`, `src/app/componentes/grafico-dashboard/grafico-dashboard.ts`, `src/app/componentes/layout-principal/layout-principal.css`, `src/app/rutas/Agentes/control-agente.ts`, `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts` y este documento.

**Verificación:** `npm run build` finalizó correctamente y prerenderizó 12 rutas. Persisten una advertencia de presupuesto del bundle inicial (687.69 kB frente a 500 kB) y una advertencia Angular en `Login` por un icono sin uso. `npm test -- --watch=false` ejecutó dos pruebas: una pasó y `should render title` falló porque busca un título `Hello` que no existe en la aplicación actual. No se dispuso de navegador en esta sesión, así que no se comprobaron visualmente los anchos 1440, 1024, 768 y 390 px. Las ocho capturas mencionadas no estaban adjuntas en el contexto disponible.

## Contraste de accesos a supervisión

En el tema oscuro, los accesos de Historial, Recomendaciones del juez, Revisión humana y Configuración heredaban texto morado oscuro sobre una superficie también oscura. Los accesos ahora usan lila claro, borde violeta y un hover fucsia discreto. El mismo tratamiento se aplica al control secundario para marcar revisión; el enlace secundario de configuración recibe texto claro y hover fucsia. Los estados corresponden únicamente al tema oscuro, por lo que el estilo del tema claro no cambia. El mensaje de ausencia de métricas de tickets conserva el token de texto secundario para mantener contraste.

**Archivo:** `src/styles.css`.

**Verificación:** se ejecutó `npm run build`. La inspección visual en navegador no estuvo disponible en esta sesión.

## Marcado único de revisiones

En Revisión humana, cada recomendación ahora puede marcarse una sola vez para revisión. El estado y el historial se consultan antes de registrar el marcado; si ya existe, el control muestra un check accesible y queda deshabilitado. Las entradas previas del historial se conservan para no borrar trazabilidad. El estado marcado tiene una presentación visible en ambos temas.

**Archivos:** `src/app/rutas/Revision-humana/revision-humana.ts`, `revision-humana.html`, `src/styles.css` y este documento.

**Verificación:** `npm run build` terminó correctamente y prerenderizó 12 rutas. Se conservan las advertencias existentes por el tamaño del bundle y el icono sin uso en Login.

## Auditoría de codificación y textos

Se revisaron 64 archivos HTML, TypeScript, CSS y JSON bajo `src`; todos decodifican como UTF-8 válido. `src/index.html` ya declara UTF-8. La búsqueda de `Ã`, `Â`, `â€`, `â†` y `�` solo encontró cadenas corruptas en la plantilla y lógica de Revisión humana: acentos, separadores, flechas y el símbolo de cierre. Se corrigieron esas cadenas en fuente; no se encontraron conversiones de texto que causaran el problema ni otros textos corruptos en `src`. La carga de Inter continúa configurada desde Google Fonts con alternativas del sistema, y el exportador CSV conserva su BOM UTF-8 intencional.

**Archivos:** `src/app/rutas/Revision-humana/revision-humana.html`, `revision-humana.ts` y este documento. La declaración de codificación, la carga de fuente y los estilos globales existentes no requirieron cambios.

**Verificación:** se ejecutó una búsqueda posterior en `src` para los patrones sospechosos y no quedaron coincidencias. `npm run build` se ejecuta para confirmar la compilación de las cadenas restauradas.

**Resultado final de la auditoría:** los 64 archivos de interfaz/datos analizados siguen siendo UTF-8 válido después de los cambios. La búsqueda de los cinco patrones sospechosos en `src` no devolvió coincidencias. `npm run build` completó correctamente y prerenderizó 12 rutas; permanecen las advertencias de presupuesto del bundle inicial y de un icono sin uso en Login.

## Corrección de reglas CSS unidas por secuencias literales

La tarjeta de tendencia de tareas en Agentes quedaba en una columna porque la regla `grid-column: span 8` estaba unida a la regla anterior mediante los caracteres literales `\n`; por ello el navegador descartaba el selector. Se separaron las reglas para que la gráfica vuelva a ocupar dos tercios del grid en escritorio y mantenga los breakpoints existentes. Se reparó el mismo separador en una regla de riesgo de tarjetas KPI de Activos. No se cambiaron datos, cálculos ni rutas.

**Archivos:** `src/app/rutas/Agentes/control-agente.css`, `src/app/rutas/Activos/activos.css` y este documento.

**Verificación:** `rg -n -F '\n' src/app/rutas --glob '*.css'` no debe encontrar secuencias literales en CSS. `npm run build` se ejecuta para validar el resultado.

## Ajuste del menú lateral

Configuración se movió al final de la navegación. Se retiraron Propietarios y Reportes porque no tienen pantallas propias habilitadas. La navegación móvil ahora distribuye sus nueve destinos en nueve columnas. Las rutas de la aplicación no cambiaron.

**Archivos:** `src/app/componentes/sidebar-principal/sidebar-principal.ts`, `src/app/componentes/layout-principal/layout-principal.css` y este documento.

## Correcciones de legibilidad y tema

El formulario de registro de activos ahora usa los tokens de superficie, texto, bordes y acento del tema activo. En modo oscuro sus tarjetas y campos conservan la identidad morada; el modelo de caja evita que los controles excedan su columna y los placeholders usan el color secundario del tema. Se aumentó el tamaño de texto de tablas y controles de paginación sin retirar columnas. Los contenedores de tablas pueden recorrerse con teclado y anuncian su propósito a lectores de pantalla. Las gráficas compartidas elevan a 11 px los textos menores y conservan colores adaptados al tema. En Agentes, el panel de tickets se ajusta al contenido cuando está en estado vacío. En tablet, los datos del agente se distribuyen en dos columnas para evitar cortes.

**Archivos:** `src/app/rutas/Registrar-activo/registrar-activo.css`, `src/styles.css`, `src/app/rutas/Stack-tecnologico/stack-tecnologico.css` y `.html`, `src/app/rutas/Activos/activos.css` y `.html`, `src/app/rutas/Historial-agente/historial-agente.css` y `.html`, `src/app/rutas/Revision-humana/revision-humana.css` y `.html`, `src/app/rutas/Agentes/control-agente.css`, `src/app/componentes/grafico-dashboard/grafico-dashboard.ts` y este documento.

**Verificación:** `npm run build` terminó correctamente y prerenderizó 12 rutas. Se inspeccionó el tema oscuro a 1440 px y 390 px, y el tema claro a 1440 px en Registrar activo. La captura de Agentes confirmó el estado real sin datos y el ajuste del panel de tickets. Se verificaron los anchos de 1024 px y 768 px; en 768 px se detectó y corrigió un desbordamiento de 28 px en la barra superior. La compilación mantiene dos advertencias existentes: un icono sin uso en Login y el presupuesto del bundle inicial.


## Acabado visual más amigable

Se suavizaron ligeramente los tonos de fondo y superficie, manteniendo la paleta morada y los acentos fucsia. Las tarjetas comparten esquinas y sombras más suaves; títulos largos equilibran sus saltos de línea. Botones y campos tienen transiciones discretas, foco visible y respuesta al pasar el cursor. Se respeta la preferencia del sistema para reducir movimiento.

**Archivo:** `src/styles.css`.

**Verificación:** `npm run build` terminó correctamente y prerenderizó 12 rutas. Se inspeccionaron capturas de escritorio a 1440 px y móviles a 390 px en tema oscuro; el formulario de activos también se comprobó en tema claro a 1440 px. Se midió el ancho del documento a 1024 px y 768 px; ambos coinciden con el viewport y no presentan desbordamiento horizontal.

## Acciones del catálogo de Stack

La sidebar conserva Stack Tecnológico como acceso al módulo y ya no muestra «Asignar stack tecnológico». En el encabezado de Catálogo empresarial, «Acciones» abre un menú con Exportar (la función CSV existente) y Nuevo stack (la ruta `/asignar-stack` existente). El menú se cierra al elegir una opción, al hacer clic fuera o al presionar Escape; con teclado acepta Enter/Espacio, flechas y Home/End. Nuevo stack conserva búsqueda, selección múltiple y guardado del formulario existente. Al abrirlo desde el catálogo, guardar o cancelar vuelve a `/stack-tecnologico#catalogo`; la ruta directa sigue disponible.

**Archivos:** `src/app/componentes/sidebar-principal/sidebar-principal.ts`; `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts`, `.html` y `.css`; `src/app/rutas/Asignar-stack/asignar-stack.ts`, `.html` y `.css`; y este documento.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. Se mantuvieron las advertencias conocidas de presupuesto del bundle inicial (698.11 kB frente a 500 kB) y el icono sin uso en Login; la primera compilación señaló además `RouterLink` sin uso en Stack, que se retiró de sus imports. No se dispuso de navegador para confirmar visualmente ambos temas, desbordamiento ni clics; las interacciones se verificaron revisando los handlers, rutas y usos compartidos del formulario/exportador.

## Distribución del catálogo y gráficas de Stack

El Catálogo empresarial ahora usa el ancho completo de la vista. Debajo, el panel de gráfica seleccionable comparte una fila con las tarjetas Tecnologías por estado y Tecnologías por licencia, ubicadas en una columna lateral. La fila se apila por debajo de 1000 px de ancho de contenedor para conservar espacio de lectura. Se mantuvieron las opciones, filtros, acciones y cálculos existentes.

**Archivos:** `src/app/rutas/Stack-tecnologico/stack-tecnologico.html`, `stack-tecnologico.css` y este documento.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. El CSS conserva la tarjeta como superficie temática y la gráfica se apila con los indicadores bajo 1000 px de ancho de contenedor; el scroll horizontal de la tabla permanece dentro de `.table-scroll`. No se contó con navegador para validar visualmente tema claro/oscuro, proporciones o desbordamiento en distintos viewports.

## Gráfica dinámica de Stack Tecnológico

Las visualizaciones «Tecnologías por categoría», «Salud del stack», «Madurez tecnológica», «Calidad por categoría» y «Valor de negocio» ahora comparten una tarjeta de ancho completo con selector. La selección comienza en Tecnologías por categoría y cambia el título y las opciones de una sola instancia de `GraficoDashboard`; ECharts conserva su configuración/datos existentes y recalcula su tamaño al cambiar la opción. Los cuatro indicadores de evaluación mantienen su disponibilidad en demo; en modo real se informa que aún no hay evaluaciones reales. «Evolución del índice tecnológico» permanece como visualización independiente porque no forma parte de las cinco opciones solicitadas. Evaluación del stack conserva su estado «Sin evaluar».

**Archivos:** `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts`, `.html` y `.css`; `src/app/componentes/grafico-dashboard/grafico-dashboard.ts`; y este documento.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. El bundle inicial quedó en 700.95 kB (el presupuesto configurado es 500 kB) y se mantiene la advertencia de `LucideArrowRight` sin uso en Login. La inspección de la plantilla confirmó que las cinco opciones ya no tienen instancias de gráficas independientes y que Evolución permanece separada. No había navegador disponible para comprobar visualmente los cambios de opción, temas y resoluciones estrechas; esos puntos quedan pendientes de revisión manual.

## Evaluación y tabla del Catálogo empresarial

La tarjeta «Evaluación del stack» quedó encima del Catálogo empresarial. La tabla mantiene su marcado semántico nativo y ahora define anchos por columna, alinea las celdas verticalmente, usa una división continua por fila y permite que la descripción se ajuste. La causa principal de la desalineación era `display:flex` aplicado al primer `td`, que lo sacaba del modelo de tabla; además, `.row-actions` permitía envolver los botones y la columna de descripción imponía un mínimo de ancho. Editar, Eliminar y las acciones del catálogo conservan sus handlers.

**Archivos:** `src/app/rutas/Stack-tecnologico/stack-tecnologico.html`, `stack-tecnologico.css` y este documento.

**Origen de datos:** el catálogo se obtendrá de iTop según el nuevo requerimiento. Esta corrección no implementa esa integración ni modifica servicios o APIs; debe abordarse cuando se defina su contrato.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. Se mantienen las advertencias del presupuesto del bundle inicial (701.78 kB frente a 500 kB) y de `LucideArrowRight` sin uso en Login. La plantilla conserva `table`/`thead`/`tbody`/`tr`/`th`/`td`, y el scroll horizontal se limita al contenedor con `overflow-x:auto`. No se dispuso de navegador para validar visualmente ambos temas y los distintos anchos. La búsqueda en `src/app` no encontró conexión actual con iTop; no se modificaron servicios ni APIs.

## Navegación de Agentes, Stack e Inicio

La sidebar presenta Inicio, Agentes, Stack Tecnológico, Activos y Configuración. Inicio ahora muestra una pantalla de bienvenida con la ilustración original en `public/assets/hermes-welcome-robot.png`, cuatro enlaces a módulos y métricas de las fuentes existentes. En modo demostración se identifican los valores de ejemplo; en modo real se muestran solo datos disponibles y se usa «Sin datos» cuando no hay fuente conectada. No existe servicio de autenticación que proporcione un nombre de usuario, por lo que el saludo es genérico.

Dashboard, Historial, Recomendaciones y Revisión humana comparten `NavegacionAgentes` y mantienen sus rutas previas para enlaces directos. Historial conserva los filtros y usa una vista adaptable de eventos y detalle. Recomendaciones conserva todas las propuestas por ticket y resalta desacuerdos sin seleccionar una propuesta. Revisión humana conserva filtros de estado, acciones mutuamente excluyentes, validaciones y el indicador de que los cambios son solo demostrativos en memoria. Configuración permanece como sección independiente.

En Stack se retiró de la interfaz el acceso «Nuevo stack» y el botón único «Exportar» mantiene la función CSV. La ruta `/asignar-stack` redirige al catálogo; el componente, servicio y datos asociados no se eliminaron. No se modificaron APIs ni servicios de negocio.

**iTop pendiente:** no se encontró integración, contrato, autenticación ni relación verificable entre equipos y tickets en el proyecto. Por ello no se inventaron endpoints ni se agregó el filtro por equipos. El mapeo iTop y ese filtro requieren la documentación contractual y el acceso backend autorizado.

**Archivos:** `src/app/app.routes.ts`; sidebar principal; el nuevo componente `src/app/componentes/navegacion-agentes/`; páginas Inicio, Agentes, Historial, Recomendaciones, Revisión humana y Stack; `public/assets/hermes-welcome-robot.png`; `documentación/README.md` y este registro.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. Se verificaron las rutas y enlaces Angular en código, las fuentes de datos y sus estados demo/real, y las reglas adaptables a temas y anchuras; el CSS de Inicio quedó dentro del presupuesto individual. La compilación conserva el aviso de presupuesto del bundle inicial (714.01 kB frente a 500 kB) y el icono `LucideArrowRight` sin uso en Login. No se contó con navegador para comprobar interacciones o capturas visuales en ambos temas.

## Ajustes visuales de Inicio y navegación compartida

Inicio ahora organiza bienvenida y tarjetas en una zona izquierda, ilustración en la derecha y métricas en una fila inferior. El alto mínimo considera topbar, paddings y navegación móvil; en pantallas con poco espacio la vista puede crecer y desplazarse naturalmente. Se retiraron las alturas y recortes de imagen que podían empujar u ocultar contenido.

Las ilustraciones claras y oscuras nuevas están en `public/assets/hermes-welcome-robot-light.png` y `public/assets/hermes-welcome-robot.png`. Se comprobaron sus canales alfa en las esquinas (transparencia presente); por eso la imagen se presenta sobre el fondo normal del tema sin filtros ni máscaras. La propiedad CSS de imagen cambia con `data-theme` y conserva el mismo contenedor y proporción.

Las cuatro rutas de Agentes comparten metadata `sidebarSection`; la sidebar la consulta al completar cada navegación para mantener Agentes seleccionado independientemente de la pestaña interna. La barra superior única de `LayoutPrincipal` conserva origen de datos, tema, notificaciones y perfil; se retiraron el campo de búsqueda global y sus iconos asociados. Los filtros locales de otras pantallas no se modificaron. La navegación compacta de la sidebar móvil distribuye ahora sus cinco destinos.

**Archivos:** `src/app/rutas/Inicio/inicio.html` y `.css`; ambas ilustraciones en `public/assets/`; `src/app/app.routes.ts`; `src/app/componentes/sidebar-principal/sidebar-principal.ts` y `.html`; `src/app/componentes/layout-principal/layout-principal.html`, `.ts` y `.css`; y estos documentos.

**Verificación:** `npm run build` terminó correctamente y prerenderizó 12 rutas. No aparecen estilos de búsqueda global ni selectores `:has` en el layout; las cuatro rutas tienen metadata común; el CSS de Inicio no rebasa el presupuesto individual y ambas ilustraciones conservan transparencia. El bundle inicial queda en 708.19 kB frente al presupuesto configurado de 500 kB; además se conserva el aviso existente del icono `LucideArrowRight` sin uso en Login. No hay herramienta de navegador disponible en esta sesión, por lo que no se pudieron tomar capturas ni comprobar visualmente varios viewports y temas.

## Corrección visual de Revisión humana

El amontonamiento aparecía en anchos de hasta 900 px porque el breakpoint convertía el panel de casos en una cuadrícula de dos columnas; las tarjetas, al ser hijos directos del panel, quedaban lado a lado. El layout de escritorio ya usaba dos paneles correctamente y la hoja CSS estaba importada globalmente. Se conserva el apilado de los paneles en pantallas estrechas, pero las tarjetas de casos permanecen en una lista vertical. No se modificaron el marcado, los filtros ni las acciones Human-in-the-Loop.

**Archivos:** `src/app/rutas/Revision-humana/revision-humana.css` y este documento.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. Se confirmó que el breakpoint mantiene las tarjetas en una sola columna y apila los paneles bajo 900 px. No hay navegador disponible en esta sesión para validar visualmente temas, interacciones y resoluciones.
## Rediseño de la barra superior

El Header compartido mantiene el selector de origen y el cambio de tema; el campo de búsqueda global y las notificaciones no forman parte de la barra. El perfil ahora abre un panel accesible con avatar, nombre, rol y opción de cerrar sesión. El Login solo simula autenticación y no existe un servicio de sesión/autenticación, por lo que «Cerrar sesión» aparece deshabilitado y el menú explica la limitación; no se simula una salida.

El panel se cierra con Escape o al hacer clic fuera. Los controles conservan estados de foco, soporte de temas y ajustes de ancho móvil. Se retiraron estilos residuales de búsqueda/notificaciones del layout compartido; los buscadores internos no se modificaron.

**Archivos:** `src/app/componentes/layout-principal/layout-principal.html`, `.ts`, `.css`; `src/styles.css`; y este documento. No se modificó la sidebar ni la lógica de origen o tema.

**Verificación:** `npm run build` completó y prerenderizó 12 rutas. La inspección confirma que el header ya no contiene controles ni estilos de búsqueda global o notificaciones. Se mantienen las advertencias preexistentes de presupuesto del bundle inicial (712.01 kB frente a 500 kB) y de `LucideArrowRight` sin uso en Login. No hay navegador disponible para validar visualmente interacciones, temas y dimensiones.
## Vulnerabilidades por prioridad en Stack Tecnológico

La visualización está declarada en `src/app/rutas/Stack-tecnologico/stack-tecnologico.html` y se coordina desde `stack-tecnologico.ts`; `GraficoDashboard` (`src/app/componentes/grafico-dashboard/`) la dibuja con ECharts, tooltips y adaptación de paleta por tema. El servicio `src/app/servicios/resultados-vulnerabilidades-agente.ts` mantiene el contrato para resultados reales, pero solo expone `recibir()`/`limpiar()`: no hay adaptador HTTP del agente ni invocaciones a `recibir()` en la aplicación.

En modo demostración la tarjeta usa los conteos ficticios Críticas 3, Altas 6, Medias 9 y Bajas 4 (22 en total). En modo real no usa ese fixture: cuenta el arreglo `vulnerabilities` del resultado del servicio y conserva «Sin datos de vulnerabilidades» si aún no hay registros. Los contadores, barras y tooltips usan las mismas cuatro categorías; cambiar el origen global vuelve a evaluar el estado y los datos. Las otras cinco opciones de la tarjeta dinámica no cambian.

El contrato TypeScript existente ya contiene los campos solicitados: `VulnerabilidadClasificada` define `vulnerabilityId`, `cveId`, prioridad del agente, `technicalSeverity.cvssScore`, justificación y `findings`; cada hallazgo incluye `findingId`, `assetId` y `technologyId`. `ResultadoAgenteVulnerabilidades.generatedAt` aporta la fecha del análisis a nivel de resultado. Así el frontend cuenta vulnerabilidades únicas por prioridad y mantiene separados sus hallazgos por activo; no calcula CVSS ni clasifica. Sigue pendiente acordar e implementar el adaptador HTTP/contrato con el equipo backend; no se inventó endpoint.

**Archivos de esta actualización:** `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts` y este documento. Se conservaron el HTML, el CSS, el servicio/modelo y el componente gráfico existentes.

**Verificación:** `npm run build` compiló correctamente y prerenderizó 12 rutas. La inspección estática confirmó que el fixture se usa solo en modo demo, el modo real depende exclusivamente del servicio y las categorías conservan sus colores y tooltip. La compilación mantiene advertencias existentes sobre el presupuesto del bundle inicial y un icono sin uso en Login. No se realizó verificación interactiva en navegador.
## Ajuste de distribución de Inicio

Se reorganizó únicamente el CSS de la página Inicio para equilibrar la bienvenida y las cuatro tarjetas en la columna izquierda, la ilustración del tema activo a la derecha y los cuatro indicadores en una barra inferior. Las tarjetas ahora tienen mayor área y jerarquía visual; las métricas ajustan sus separadores al pasar de cuatro a dos columnas. En tabletas y móviles el contenido fluye en una sola columna y conserva el desplazamiento natural cuando no cabe. La regla de altura usa el espacio disponible bajo el header y el padding existente; no recorta contenido.

Se conservaron el HTML y los componentes actuales, las rutas, las imágenes transparente clara/oscura, las métricas y su identificación de origen. El saludo sigue siendo genérico porque Inicio no dispone de un servicio de identidad de usuario; no se agregó un nombre fijo ni se modificó autenticación.

**Archivos:** `src/app/rutas/Inicio/inicio.css` y este documento.

**Verificación:** se revisaron la composición CSS, los breakpoints, los selectores por tema y las rutas/interpolaciones ya existentes. `npm run build` compiló correctamente y prerenderizó 12 rutas. No hubo advertencia de presupuesto para el CSS de Inicio; permanecen las advertencias del presupuesto global del bundle inicial y el icono `LucideArrowRight` sin uso en Login. No había directorio `.git` en la raíz de trabajo para comprobar el estado Git. No se contó con navegador en esta sesión para validar visualmente capturas en varios tamaños.
## Revisión humana integrada en Recomendaciones

La navegación de Agentes ahora muestra Dashboard, Historial y Recomendaciones. La ruta antigua `/revision-humana` redirige a `/recomendaciones-agente` preservando query params y fragmento. Si el enlace conserva `ticketId` o `recomendacionId`/`id` y el registro está disponible, Recomendaciones selecciona el caso y abre la revisión.

Recomendaciones reutiliza el componente existente `RevisionHumana` como modal HTML `<dialog>` centrado. El organismo mantiene las validaciones, acciones Human-in-the-Loop, comentarios limitados a 1000 caracteres y registro de auditoría en `SupervisionAgentes`; presenta las propuestas del ticket y deja seleccionar cuál revisar. El diálogo modal nativo proporciona capa superior, bloqueo de interacción/foco del fondo y restauración de foco al cerrarse. Escape, X y Cancelar pasan por la confirmación de descarte cuando hay cambios sin guardar. Guardar solicita confirmación y cierra tras registrar.

Las decisiones siguen disponibles únicamente en modo demostración y permanecen en memoria. El modo real muestra el estado sin API y mantiene deshabilitado el guardado; no se simula una escritura real. Comentarios y textos externos se muestran mediante interpolación Angular.

**Archivos:** `src/app/componentes/navegacion-agentes/navegacion-agentes.html` y `.ts`; `src/app/app.routes.ts`; `src/app/rutas/Recomendaciones-agente/recomendaciones-agente.ts`, `.html` y `.css`; `src/app/rutas/Revision-humana/revision-humana.ts`, `.html` y `.css`; y este documento. No se eliminaron el componente ni el servicio HITL.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. La revisión estática confirma las tres pestañas, la redirección compatible con query params, el modal `showModal()`, los campos y acciones existentes, filtro de estado, comparación de propuestas y auditoría. No hay pruebas unitarias existentes para estas rutas ni navegador disponible en esta sesión, por lo que no se validaron visualmente animaciones, clic fuera, foco y dimensiones. Persisten las advertencias de presupuesto del bundle inicial (737.09 kB frente a 500 kB) y `LucideArrowRight` sin uso en Login.
## Ajuste visual de Activos

Se retiró del HTML de la pantalla Activos la tarjeta «Contexto del inventario» y sus cuatro indicadores. Se conservaron los artículos de distribución por tipo y estado, así como datos, cálculos, servicios y el inventario. La columna derecha usa filas automáticas con separación; al quedar dos tarjetas, el layout se contrae sin una fila vacía. Se quitaron solo los registros de iconos y estilos exclusivos de la tarjeta retirada.

**Archivos:** `src/app/rutas/Activos/activos.html`, `.ts`, `.css` y este documento.

**Verificación:** se comprobó que el marcado mantiene las tarjetas de tipo y estado, que los indicadores retirados no aparecen en la vista y que no hay altura fija o fila reservada en `.right-column`. `npm run build` compiló correctamente y prerenderizó 12 rutas. Permanecen la advertencia existente del presupuesto del bundle inicial (728.96 kB frente a 500 kB) y el aviso del icono sin uso en Login. La inspección estática confirmó que no hay reglas de altura o filas fijas para la columna y que ambas tarjetas conservadas siguen en el HTML. No se contó con navegador para inspección visual. No se modificaron servicios, modelos ni tabla.
## Mejora visual de Estado de los activos

La tarjeta presenta En uso, Mantenimiento y Disponible en filas compactas con icono SVG, etiqueta, porcentaje, barra proporcional y cantidad destacada. Los porcentajes se redondean a partir de la cantidad de cada estado sobre el total del inventario; estados adicionales permanecen incluidos en el denominador y el pie lo aclara. Con cero activos, los tres conteos y porcentajes son cero. El icono de Mantenimiento se estandarizó como LucideWrench tanto en la tarjeta como en los badges de estado de la tabla. El resto de estados conserva sus iconos semánticos y los colores usan tokens compartidos para ambos temas.

**Archivos:** `src/app/rutas/Activos/activos.html`, `.css` y este documento.

**Verificación:** se revisaron los bindings existentes de `distribucionEstado`, el ajuste de estilos oscuro/claro y el breakpoint compacto. `npm run build` compiló correctamente y prerenderizó 12 rutas. Permanece la advertencia del presupuesto del bundle inicial (734.89 kB frente a 500 kB) y el aviso existente del icono sin uso en Login. No se contó con navegador para inspección visual en esta sesión.
## Contraste de Recomendaciones en modo oscuro

Se ajustaron los estilos encapsulados de Recomendaciones para que el aviso de desacuerdo use los tokens ámbar oscuros del tema, con borde visible, icono ámbar y texto claro. También se mejoró el contraste y tamaño de metadatos, estados, puntajes, análisis, justificaciones y badges; se conservaron estructura, contenido y comportamiento de las tarjetas. Los cambios se limitan al tema oscuro de esta pantalla, por lo que el tema claro y la lógica del modal/Human-in-the-Loop permanecen intactos.

**Archivos:** `src/app/rutas/Recomendaciones-agente/recomendaciones-agente.css` y este documento.

**Verificación:** `npm run build` compiló correctamente y prerenderizó 12 rutas. El bundle inicial reporta 733.23 kB frente al presupuesto configurado de 500 kB y continúa la advertencia de `LucideArrowRight` sin uso en Login. No se dispone de navegador en esta sesión para inspección visual ni medición automatizada de contraste.

## Rediseño de Configuración del agente

Configuración conserva el organismo de página y el servicio `SupervisionAgentes`. El resumen deriva el perfil y el conteo de herramientas del borrador en modo demo; en modo real muestra «Sin datos», ya que no existe API de configuración. La integración se marca como pendiente. Los perfiles son radios accesibles en tarjetas y las herramientas mantienen sus cambios locales mediante switches; los permisos siguen informativos. «Abrir revisión humana» navega a `/recomendaciones-agente`. El guardado conserva el modal de confirmación, la comparación anterior/nuevo y la aplicación exclusivamente en memoria demo; queda deshabilitado cuando no hay cambios o no es demo.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.ts`, `.html`, `.css` y este documento.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. Persisten las advertencias del bundle inicial (751.27 kB frente al presupuesto de 500 kB) y del icono `LucideArrowRight` sin uso en Login. La plantilla y los bindings se revisaron para selección única, switches, estado real desconocido, ruta HITL y guardado. No se contó con navegador para revisar visualmente tema claro/oscuro, teclado y breakpoints.

## Retiro del formulario de creación de tecnología

En el Catálogo empresarial se ocultó el modo «Agregar tecnología» y se retiró el aviso intermedio de solo lectura, de modo que el filtro y la tabla quedan inmediatamente bajo el encabezado. Se conserva el mismo formulario únicamente cuando se selecciona Editar en una fila, junto con su guardado y cancelación; no se modificaron catálogo, datos, exportación, filtro ni paginación.

**Archivos:** `src/app/rutas/Stack-tecnologico/stack-tecnologico.html` y este documento.

**Verificación:** inspección estática confirmó que el catálogo ya no presenta el modo de creación, conserva el formulario de edición condicional, exportación, filtros, filas y paginación. `npm run build` compiló correctamente y prerenderizó 12 rutas. No se contó con navegador para comprobar clics ni temas visualmente.

## Menú de perfil compartido entre sidebar y header

Se creó el componente reutilizable `MenuPerfil` y se montó en la sidebar con despliegue hacia arriba y en el header hacia abajo. Ambas instancias comparten los datos de perfil y el menú con cierre por clic externo y Escape; Enter/Espacio siguen la activación nativa del botón, las flechas abren el menú y el foco vuelve al botón con Escape. No se encontró servicio de autenticación ni endpoint: «Cerrar sesión» continúa deshabilitado y el menú informa que la sesión es demostrativa. No se borra información ni se simula logout.

**Archivos:** `src/app/componentes/menu-perfil/` (componente y estilos); `src/app/componentes/layout-principal/layout-principal.ts`, `.html`, `.css`; `src/app/componentes/sidebar-principal/sidebar-principal.ts`, `.html`; y este documento.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. Se revisaron las dos orientaciones, ids distintos, gestión compartida de eventos, estado deshabilitado de logout y elevación de la sidebar para evitar que recorte el menú. Persisten la advertencia del bundle inicial (753.76 kB frente al presupuesto de 500 kB) y el icono `LucideArrowRight` sin uso en Login. No se contó con navegador para validar visualmente foco, clic fuera, Escape, temas y posiciones.

## Puntajes, revisión humana y presentación del Dashboard

Se añadió un modelo interno de presentación para puntaje original, determinista y opiniones de juez, con `null` para etapas ausentes y preservación del cero como valor válido. No representa un contrato del backend. Los puntajes heredados `puntajeAnterior` y `puntajePropuesto` permanecen identificados como datos de propuesta demostrativa y no se reasignan a etapas nuevas ni se etiquetan como CVSS. El modal muestra el CVE cuando exista en el registro, las etapas que estén explícitamente disponibles, análisis/justificaciones recibidos y una tarjeta separada por opinión de juez registrada. El código demo actual contiene opiniones/decisiones asociadas a propuestas, no dos jueces confirmados para el mismo caso; por ello no se inventó un segundo juez.

Se retiró la acción de interfaz «Marcar revisado», conservando los estados históricos ya existentes. La resolución demo continúa afectando solo la revisión seleccionada en memoria. No hay API confirmada para resolver conjuntamente opiniones; falta acordar una operación atómica de caso completo y su respuesta antes de marcar ambas como resueltas en modo real. No se añadieron llamadas HTTP ni cambios de negocio.

El Dashboard ahora presenta primero la tendencia de tareas junto al desempeño; debajo ubica éxito, uso de herramientas y procesos en tres columnas. Se mantuvieron datos y cálculos existentes y se mejoró la legibilidad de ejes, leyendas, métricas y títulos. En Activos se quitó «Registrar activo» y la ruta heredada redirige al inventario; se conservaron componentes, datos y servicios. El apartado visible «Configuración» cambió a «Control de agentes», con icono de controles y la ruta técnica `/configuracion-agente` intacta. Se reforzó la tipografía, separación y diferenciación visual de las tarjetas de esa pantalla.

**Archivos:** `src/app/servicios/supervision-agentes.ts`; `src/app/rutas/Revision-humana/revision-humana.ts`, `.html`, `.css`; `src/app/rutas/Recomendaciones-agente/recomendaciones-agente.ts`, `.html`, `.css`; `src/app/rutas/Agentes/control-agente.ts`, `.html`, `.css`; `src/app/rutas/Activos/activos.ts`, `.html`; `src/app/app.routes.ts`; `src/app/componentes/sidebar-principal/sidebar-principal.ts`; `src/app/rutas/Inicio/inicio.ts`, `.html`; `src/app/rutas/Configuracion-agente/configuracion-agente.ts`, `.html`, `.css`; y este documento.

**Integración pendiente:** el backend debe definir qué escala tiene cada puntaje, la asociación CVE/caso, los resultados y justificaciones por etapa, una o más opiniones con identificador y estado, y la resolución atómica conjunta. Hasta recibir y verificar ese contrato, el modo real sigue mostrando ausencia de integración y la demo no se presenta como resultado empresarial.

**Verificación:** `npm run build` finalizó correctamente y prerenderizó 12 rutas. El bundle inicial es de 747.28 kB y supera el presupuesto configurado de 500 kB; también permanece el aviso preexistente de `LucideArrowRight` sin uso en Login. La inspección del código confirmó que «Marcar revisado» y «Registrar activo» ya no aparecen en esos controles, que la ruta antigua redirige a `/activos`, que `null` no se convierte en cero y que no hay operación de resolución conjunta en cliente. No se realizó verificación visual en navegador ni pruebas automatizadas.

## Contraste de textos secundarios en modo claro

El token claro `--text-secondary` ahora usa `#302936`. Se aplicó el mismo color mediante selectores limitados a textos secundarios de Inicio, Dashboard, Historial, Recomendaciones, Stack Tecnológico, Activos, Configuración, el menú de perfil y el modal de Revisión Humana. Los estados semánticos, advertencias y estilos del tema oscuro se conservaron. ECharts usa ese color para etiquetas y tooltips en tema claro y mantiene su paleta existente en tema oscuro.

En las opciones de «Nivel conservador» solo se ajustaron color y lectura tipográfica: título, perfiles y etiqueta usan `#170A24`; descripciones usan `#302936` a 15 px, peso 500 y line-height 1.5; iconos y radio usan `#8129C1`. No se modificaron fondos, bordes, sombras, espaciados ni estados de selección de las tarjetas.

**Archivos:** `src/styles.css`; `src/app/componentes/grafico-dashboard/grafico-dashboard.ts`; `src/app/rutas/Configuracion-agente/configuracion-agente.css`; y este documento.

**Verificación:** el contraste calculado contra blanco es 14.04:1 para `#302936`, 19.00:1 para `#170A24` y 6.95:1 para `#8129C1`; los tres superan WCAG AA para texto normal cuando se usan como texto sobre blanco. Las reglas nuevas están delimitadas a `data-theme="light"`; no se dispuso de navegador para inspección visual. Pendiente ejecutar la compilación después de este ajuste.

## Panel unificado de Control de agentes y escala tipográfica

La pantalla de Control de agentes conserva su resumen y guardado actuales, y ahora agrupa nivel conservador, herramientas, permisos y Human-in-the-Loop dentro de un solo panel: perfiles e ilustración en la columna izquierda; las otras tres secciones, separadas por divisores, en la derecha. En viewport reducido las columnas se apilan. Se mantiene la gestión de estado existente, incluidos los controles demo y la condición de solo lectura en modo real. El selector de origen se ubicó en la sidebar entre navegación y perfil; permanece accesible en el menú inferior móvil. El header compartido conserva únicamente el cambio de tema.

Se copió el PNG transparente proporcionado a `public/assets/hermes-agent-laptop.png` y se muestra como ilustración decorativa con proporción natural y `object-fit: contain`. No se editó la imagen. Se añadió el token global `--font-size-increase: 2.67px` y se aplicó aditivamente a las declaraciones explícitas de tamaño tipográfico de las hojas CSS de la aplicación, al tamaño base heredado y a las opciones `fontSize` de ECharts encontradas en sus componentes. No se aplicó `transform`, `zoom` ni una escala global.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.html` y `.css`; `src/app/componentes/layout-principal/layout-principal.html`, `.ts` y `.css`; `src/app/componentes/sidebar-principal/sidebar-principal.html` y `.ts`; hojas CSS de `src/app/` y `src/styles.css`; `src/app/componentes/grafico-dashboard/grafico-dashboard.ts`, `src/app/rutas/Agentes/control-agente.ts`, `src/app/rutas/Stack-tecnologico/stack-tecnologico.ts`; `public/assets/hermes-agent-laptop.png`; y este documento.

**Verificación:** `npm run build` compiló la aplicación y prerenderizó 12 rutas. Se comprobó por inspección que la plantilla comparte una única superficie exterior, las cuatro secciones aparecen una vez, el origen queda en la sidebar y el tema permanece en el header; se revisaron reglas responsivas y el recurso tiene canal alfa PNG (transparencia). El incremento se aplicó de forma aditiva a 392 declaraciones `font-size` y a 20 valores `fontSize` de ECharts, sin repetir el token en declaraciones ya transformadas. La última compilación reportó advertencias de presupuesto del bundle inicial (767.43 kB frente a 500 kB), Inicio CSS (4.36 kB frente a 4 kB) y `LucideArrowRight` no utilizado en Login. No hay navegador disponible en esta sesión para comparación visual interactiva.

## Espaciado y padding de pantallas

Se corrigió el selector del layout compartido: el HTML utiliza la clase `.page-content`, mientras la regla base se aplicaba al elemento inexistente `page-content`. El contenido ahora recibe padding de escritorio de 28 px horizontal, con reducción gradual a 20 px en tablet y 14 px en móvil, evitando sumarlo con otro padding de página. Sidebar conserva su ancho; sus enlaces y perfil ganaron un margen interno pequeño.

Se ampliaron de forma moderada los paddings de tarjetas de navegación de Inicio, paneles y gráficas del Dashboard, lista/detalle de Historial y Recomendaciones, paneles de Stack Tecnológico, inventario/KPI de Activos y panel unificado de Control de agentes. Se aumentó la separación de filtros respecto de resultados y paginación. Las filas de tablas siguen compactas y el desbordamiento permanece contenido en sus wrappers `.table-scroll` existentes. Las reglas nuevas conservan breakpoints y tokens de superficie, por lo que se aplican igual en temas claro y oscuro.

**Archivos CSS:** `src/app/componentes/layout-principal/layout-principal.css` (padding del contenido compartido y margen interior de sidebar); `src/app/rutas/Inicio/inicio.css` (tarjetas de navegación y resumen); `src/app/rutas/Agentes/control-agente.css` (paneles, métricas y gráficas); `src/app/rutas/Historial-agente/historial-agente.css` (paneles, filtros y columnas); `src/app/rutas/Recomendaciones-agente/recomendaciones-agente.css` (lista, detalle, casos y propuestas); `src/app/rutas/Stack-tecnologico/stack-tecnologico.css` (paneles, gráficas, filtro y paginación); `src/app/rutas/Activos/activos.css` (KPI, filtros e inventario); `src/app/rutas/Configuracion-agente/configuracion-agente.css` (panel unificado y filas internas); y este documento.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. Se revisaron las reglas existentes de breakpoints y el uso del contenedor local de scroll para las tablas. La compilación mantiene advertencias de presupuesto del bundle inicial (767.46 kB frente a 500 kB), `inicio.css` (4.36 kB frente a 4 kB) y `LucideArrowRight` sin uso en Login. No hubo capturas adjuntas accesibles ni navegador para inspección visual.

## Rediseño de Login con degradado CSS y robot

Login ahora usa un layout responsivo de dos columnas: identidad e ilustración en la izquierda y formulario en una superficie morada oscura a la derecha. El fondo se construye con degradados CSS, sin una imagen de fondo. El recurso PNG adjunto se conserva independiente, transparente y con `object-fit: contain`; en pantallas pequeñas las columnas se apilan y se reduce su tamaño.

Se conservaron `FormGroup`, validaciones, `entrar()`, el estado de carga y el botón mostrar/ocultar. Se añadió el icono SVG de correo a la etiqueta correspondiente y se dejaron los errores enlazados accesiblemente solo cuando aparecen. Las credenciales que ya existían siguen siendo una simulación local de demostración; este componente no autentica en backend y no debe considerarse un mecanismo de producción.

**Archivos:** `src/app/rutas/Login/login.html`, `login.css`, `login.ts`, `public/assets/hermes-login-robot.png` y este documento.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. La plantilla conserva bindings de validación, carga, visibilidad de contraseña y envío, y el recurso está en la ruta estática referenciada. La compilación reporta advertencias del presupuesto inicial (774.72 kB frente a 500 kB), de `inicio.css` (4.36 kB frente a 4 kB), de `login.css` (5.62 kB frente a 4 kB) y del import `LucideArrowRight` sin uso preexistente en Login. No hubo navegador para validar visualmente el responsive ni para hacer un envío manual.

## Ajuste compacto del panel de Control de agentes

Se corrigió la cascada del tema oscuro que restauraba fondo y borde en cada `.config-card` interna. Dentro de `.config-panel`, los apartados ahora permanecen transparentes y sin sombra; solo las divisiones horizontales separan Herramientas, Permisos y Human-in-the-Loop. La columna pasa a una proporción cercana a 55/45. Se compactaron paddings de sección y filas, manteniendo nombres, estados auxiliares, controles, textos, tamaños tipográficos y comportamiento.

El PNG existente tiene dimensiones 1536 × 1024 y su alfa ocupa casi todo el lienzo (bbox 0,21–1532,1024); sus márgenes transparentes no explican el tamaño visual reducido. Se incrementó el límite de altura del recurso y se centró el lienzo debajo de las opciones, respetando su proporción y transparencia. El panel no tiene altura fija; en móvil las columnas siguen apilándose. Guardar cambios permanece bajo el panel, alineado a la derecha.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.css` y este documento. No se modificó HTML, TypeScript, datos ni servicios.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. La revisión estática confirma que la regla de tema oscuro ya no restaura superficies internas, que el divisor vertical y separadores horizontales permanecen, y que el panel no tiene altura fija. La compilación conserva las advertencias del bundle inicial (775.42 kB frente a 500 kB), `login.css` (5.62 kB frente a 4 kB), `inicio.css` (4.36 kB frente a 4 kB) y el icono sin uso en Login. No se recibió una pareja de capturas accesibles en esta solicitud ni se dispone de navegador para cotejo visual directo.

## Layout sin header y fondos degradados

Se retiró del layout compartido el contenedor horizontal que reservaba 72 px. El botón accesible de cambio de tema ahora se posiciona en la esquina superior derecha del workspace, sin crear una segunda barra. El contenido principal conserva su padding propio; en móvil se deja espacio para el control flotante y la navegación inferior.

El fondo oscuro del workspace reutiliza el mismo degradado CSS de Login mediante `--background-dark-neon`. El tema claro usa `--background-light-lavender`; workspace y contenido permanecen transparentes para que se vea el degradado sin cambiar superficies de tarjetas. La sidebar continúa con su fondo decorativo oscuro. El selector de origen recibió estilos limitados a `.sidebar-data-source`, con fondo `#351A4B`, texto blanco y borde `#795093` en ambos temas, incluidos estados de foco, hover y deshabilitado.

**Archivos:** `src/app/componentes/layout-principal/layout-principal.html` y `.css` (eliminación del wrapper de header, posición compartida del botón y estilo del selector); `src/styles.css` (tokens de fondos y superficies transparentes); `src/app/rutas/Login/login.css` (reutilización del token oscuro); y este documento.

**Verificación:** `npm run build` compiló la aplicación y prerenderizó 12 rutas. La inspección confirmó que el layout ya no contiene un `<header>` ni referencias activas a `.topbar`, el control conserva `alternarTema()` y sus atributos accesibles, y selector/perfil permanecen dentro de SidebarPrincipal. La compilación conserva advertencias existentes del presupuesto del bundle inicial (774.97 kB frente a 500 kB), `login.css` (5.44 kB frente a 4 kB), `inicio.css` (4.36 kB frente a 4 kB) y `LucideArrowRight` sin uso en Login. No hay navegador disponible para la verificación visual interactiva.

## Consistencia tipográfica entre temas

La auditoría encontró que las descripciones de perfiles en Control de agentes recibían 15 px, peso 500 y line-height 1.5 solo en claro, mientras que la regla compartida usaba 13 px y line-height 1.4. También había ajustes tipográficos solo para oscuro en Recomendaciones (nota de puntaje, aviso de conflicto, metadatos y análisis). Se trasladaron los valores mayores de esos elementos a reglas compartidas y se retiraron los tamaños/pesos/alturas de línea exclusivos del tema; los selectores de tema conservan sus colores. El aumento global existente `--font-size-increase: 2.67px` no se modificó ni se volvió a aplicar.

Los tamaños configurados para etiquetas, ejes, leyendas y valores de ECharts se inspeccionaron en los componentes TypeScript y no dependen del modo de color, por lo que no requirieron cambios. Las media queries tipográficas siguen respondiendo al ancho del viewport de la misma forma en ambos temas.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.css` (perfil compartido a 15 px, peso 500 y line-height 1.5); `src/app/rutas/Recomendaciones-agente/recomendaciones-agente.css` (tamaños compartidos para los elementos antes ajustados solo en oscuro); y este documento.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. La búsqueda de declaraciones de tipografía ligadas directamente a `data-theme` confirmó que las diferencias encontradas se limitaron a las dos hojas CSS corregidas; los tamaños ECharts inspeccionados son compartidos. Persisten avisos existentes de presupuesto del bundle inicial (774.80 kB frente a 500 kB), CSS de Inicio (4.36 kB), CSS de Login (5.44 kB) e `LucideArrowRight` no utilizado en Login. No se proporcionaron capturas accesibles en este turno ni hay navegador disponible, por lo que la comparación visual elemento a elemento queda sin verificar.

## Reordenamiento del Dashboard de Agentes

La plantilla de Control de agente ahora presenta «Funcionamiento del agente» inmediatamente después del encabezado, navegación y aviso de origen. Conserva las cinco métricas, las cuatro gráficas y el resumen de procesos. «Estado del agente» y «Tickets» aparecen debajo en la misma fila de escritorio con las proporciones existentes; los breakpoints previos siguen apilándolos en pantallas pequeñas. Solo se ajustó el margen entre secciones. No se modificaron datos, cálculos ni opciones de ECharts. El componente compartido `app-grafico-dashboard` ya observa el tamaño de su host con `ResizeObserver` y llama a `chart.resize()`.

**Archivos:** `src/app/rutas/Agentes/control-agente.html` (orden de los bloques), `src/app/rutas/Agentes/control-agente.css` (separación entre la sección de funcionamiento y la fila inferior) y este documento.

**Verificación:** `npm run build` compiló y prerenderizó 12 rutas. La estructura HTML confirma el orden requerido y la fila `.top-grid` conserva su grid y breakpoints. No hubo navegador disponible para probar tooltips o validar visualmente dimensiones; los valores y opciones permanecen sin cambios. La compilación mantiene avisos de presupuesto del bundle inicial (774.81 kB frente a 500 kB), CSS de Inicio (4.36 kB), CSS de Login (5.44 kB) e `LucideArrowRight` sin uso en Login.

## Limpieza de bordes decorativos de tarjetas informativas

Se hicieron transparentes los bordes exteriores de tarjetas KPI y resúmenes informativos en Inicio, Agentes, Stack Tecnológico, Activos y Control de agentes. También se retiraron de las tarjetas de contenido textual de Historial y Recomendaciones. Se conservó el grosor del borde para no cambiar dimensiones, además de fondos, radios, padding, sombras y separadores.

Se excluyeron los paneles de gráficas y tablas, la lista de tickets seleccionable, botones, campos, modales, alertas, controles de foco y perfiles seleccionables. Los divisores internos que ayudan a organizar métricas y secciones permanecen visibles. La regla compartida aplica en ambos temas y prevalece sobre el repintado de bordes del tema oscuro.

**Archivos:** `src/styles.css` (reglas acotadas por página y clase) y este documento. No se modificaron HTML, TypeScript, datos ni servicios.

**Verificación:** la revisión de plantillas y selectores confirma que las clases de gráficas (`.chart-card`, `.chart-panel`, `.evolution-card`) y tablas (`.table-panel`, `.inventory`, `.history-panel.table-panel`) no están incluidas en las reglas de limpieza; se mantienen los bordes de `.ticket-option`, `.profile-option`, controles, diálogos y alertas. No hay repositorio Git detectable en el directorio de trabajo para consultar diff/status. Falta ejecutar la compilación Angular y no se dispone de navegador para inspección visual directa.


## Identidad Hermes, catálogo y decisiones humanas

Se incorporó `public/assets/hermes-winged-boot.png`, copia intacta de la imagen adjunta, en la marca de sidebar y en los dos lockups de Login; `src/index.html` la usa como favicon PNG. El recurso transparente conserva su proporción con `object-fit: contain`; los iconos Lucide de capas del menú Stack y de los indicadores tecnológicos permanecen sin cambios.

El Catálogo empresarial conserva consulta, filtro por categoría, paginación y exportación, pero ya no muestra la columna Acciones ni el formulario de edición asociado. Las funciones de escritura `CatalogoTecnologias.guardar()` y `CatalogoTecnologias.eliminar()` permanecen en el servicio y no se tocan; la búsqueda de referencias encontró como consumidor únicamente la interfaz Stack retirada. La tabla sigue leyendo `CatalogoTecnologias.tecnologias`. También se retiró la tarjeta «Evolución del índice tecnológico», su opción ECharts y sus datos demo exclusivos; las demás gráficas continúan usando `GraficoDashboard` y ECharts.

Decisión humana presenta cuatro acciones con identificadores internos `accept-recommendation`, `assign-score`, `accept-original-score` y `reject-recommendation`. «Asignar puntaje» requiere un valor numérico finito y guarda la decisión en `RevisionDemo.decisionHumanaPuntaje`, sin modificar `puntajePropuesto` ni las evaluaciones. El historial demo conserva la etiqueta y el valor de cada decisión con puntaje, incluido cero. `RevisionHumana.puntajeOriginalSeleccionado` toma el valor solo de la evaluación activa y descarta ausentes/no finitos; `puntajeNuevoValido` valida presencia y finitud sin definir escala. `confirmar()` verifica modo demo, selección, decisión y puntaje antes de mostrar la confirmación y llamar al servicio. `SupervisionAgentes.actualizarRevisionDemo(id, estado, decision, comentario, puntaje, etiqueta)` registra el estado, la decisión estructurada, el puntaje y un evento de historial solo en memoria; para aceptar/rechazar conserva la actualización local del ticket existente. Como el backend no confirma rango ni precisión, no se impone escala o límite y esa definición queda pendiente. «Aceptar puntaje original» lee exclusivamente `evaluacion.puntajeOriginal`, permite cero y bloquea guardar si el valor es `null` o no está disponible. Cada decisión queda asociada al ID de la revisión elegida (y por tanto a la evaluación del juez seleccionada). En demo se conserva la confirmación y el registro en memoria; en modo real el popup informa que no hay API HITL y no habilita guardado.

**Archivos:** recurso PNG; sidebar y estilos del layout; Login, su estilo e imports; `src/index.html`; Stack Tecnológico (vista, estilos y lógica); `Revision-humana` (vista, estilos y lógica); `SupervisionAgentes` (modelo/registro demo); `OrigenDashboard` (datos demo de la gráfica retirada); este documento.

**Contratos backend pendientes:** operación y DTO HITL para aceptar/rechazar recomendación, registrar puntaje humano o aceptar explícitamente el original; vínculo de decisión con caso, recomendación y juez; estados/transiciones e idempotencia; actor y auditoría; rango, escala y precisión del puntaje; respuesta/errores de guardado. No se inventó endpoint ni se reporta persistencia real.

**Verificación:** se inspeccionaron las referencias a las operaciones CRUD antes de retirar la interfaz de edición y se conservaron sus métodos de servicio. Verificación completada: `npm run build` compiló y prerenderizó 12 rutas. Se mantuvieron avisos de presupuesto del bundle inicial (764.70 kB frente a 500 kB), `login.css` (5.16 kB frente a 4 kB), `inicio.css` (4.36 kB frente a 4 kB) y `LucideArrowRight` sin uso en Login. No hay navegador interactivo disponible para comprobar visualmente los temas, transparencia, dimensiones y breakpoints.


## Actualización del icono oficial Hermes

Se sustituyó el contenido de `public/assets/hermes-winged-boot.png` por la imagen exacta adjunta de la bota alada con contorno fucsia neón. La misma ruta compartida ya se utiliza en el logo de la sidebar (`sidebar-principal.html`), los dos lockups de Login (`login.html`) y el favicon (`src/index.html`); por eso no se crearon recursos duplicados ni se modificaron plantillas, componentes, dimensiones o navegación. El CSS existente mantiene alineación, tamaños y `object-fit: contain`, sin filtros ni fondos añadidos. Los iconos funcionales de capas se conservaron.

**Verificación:** el archivo copiado conserva el hash SHA-256 del original adjunto y el PNG reporta 1304×1206 píxeles con canal alfa.  `npm run build` terminó correctamente y prerenderizó 12 rutas. Se conservaron los avisos existentes de presupuesto del bundle inicial (764.70 kB frente a 500 kB), CSS de Login/Inicio y `LucideArrowRight` sin uso en Login. La inspección visual interactiva en ambos temas no está disponible en esta sesión.


## Actualización de ilustraciones del robot Hermes

Se reemplazaron cuatro recursos existentes conservando las rutas y referencias de los componentes:

- `hermes-login-robot.png`: imagen 1, robot con laptop y estela; se muestra en Login (`src/app/rutas/Login/login.html`). En la actualización inicial el archivo tenía fondo negro opaco; fue sustituido después por el PNG transparente documentado en «Autenticación Firebase y acceso demo en Login».
- `hermes-agent-laptop.png`: imagen 2, robot sonriente con laptop; se muestra en Configuración del agente (`src/app/rutas/Configuracion-agente/configuracion-agente.html`).
- `hermes-welcome-robot-light.png`: imagen 3, robot con paneles claros; Inicio la selecciona en el tema claro (`src/app/rutas/Inicio/inicio.css`).
- `hermes-welcome-robot.png`: imagen 4, robot con paneles neón oscuros; Inicio la usa por defecto y en tema oscuro (`src/app/rutas/Inicio/inicio.css`).

Las imágenes 2, 3 y 4 conservan su canal alfa y transparencia. Los estilos actuales mantienen `object-fit: contain` donde hay elementos `img` y `background-size: contain` para Inicio. No se tocaron las plantillas, CSS, servicios, navegación ni iconos funcionales. La ruta Control del agente conserva su icono Lucide: actualmente no consume una ilustración rasterizada.

**Verificación:** se comprobó la correspondencia de las cuatro referencias actuales, dimensiones PNG, canales alfa y hash del contenido copiado. `npm run build` terminó correctamente y prerenderizó 12 rutas. Se conservaron avisos existentes de presupuesto del bundle inicial (764.70 kB frente a 500 kB), CSS de Login (5.16 kB) e Inicio (4.36 kB), además de `LucideArrowRight` sin uso en Login. No se dispone de navegador interactivo para una inspección visual de ambos temas o tamaños móviles.


## Corrección de compilación de Configuración del agente

Se declaró `controlesPersonalizados` en `ConfiguracionAgente` con claves tipadas como `keyof ParametrosPersonalizadosDemo`. La plantilla puede iterar Autonomía, Revisión y Cautela e indexar el borrador sin ampliar las claves a `string` ni recurrir a conversiones inseguras. Se mantuvieron el estado demo, el actualizador de sliders y el flujo de guardado existentes. En Login se retiró `LucideArrowRight` tanto del import como del registro standalone porque no tiene referencias en la plantilla.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.ts`, `src/app/rutas/Login/login.ts` y este documento.

**Verificación:** `npm run build` no reportó errores TypeScript ni de plantilla y prerenderizó las 12 rutas. El comando terminó con código 1 porque el bundle inicial alcanzó 1.19 MB, por encima del presupuesto máximo configurado de 1.00 MB. También se mostraron avisos de CSS en Login (5.16 kB frente a 4 kB) e Inicio (4.36 kB frente a 4 kB), y dependencias CommonJS de Firebase. No se modificaron budgets ni configuración de compilación, ajenos a esta corrección. El aviso de `LucideArrowRight` ya no aparece.


## Autenticación Firebase y nombre corto del perfil

Firebase Authentication es el único método de inicio de sesión. Se eliminó la excepción local para `admin@correo.com` / `123456`, así como su texto y estilo en Login. El único acceso usa correo y contraseña con AngularFire; los errores de credenciales mantienen un mensaje común, mientras que conexión fallida y exceso de intentos tienen mensajes claros sin exponer códigos internos.

`SesionAutenticacion` mantiene los estados `verificando`, `firebase` y `sin-sesion`. Su suscripción a `authState` espera la restauración de Firebase y conserva la persistencia gestionada por el SDK. El guard del layout y sus rutas hijas requiere una sesión Firebase. El menú usa `signOut` para cerrar la sesión. No quedan banderas de sesión demo ni almacenamiento local de credenciales/tokens.

El modo de datos de demostración permanece separado: una persona con sesión Firebase puede seleccionar Datos de demostración o Datos reales según las capacidades actuales. El selector no concede permisos al backend; las operaciones reales deben autorizarse en servidor. Los datos demo, simulaciones y sliders no se eliminaron.

El perfil obtiene el email desde el usuario autenticado, muestra únicamente la parte anterior al primer `@` (o `Usuario` si no existe) y conserva el subtítulo `Cuenta Firebase`. El contenedor del perfil usa ancho mínimo cero y truncado con puntos suspensivos para evitar desbordamientos.

Se reemplazó exclusivamente `public/assets/hermes-login-robot.png`, manteniendo la ruta usada por Login. La imagen adjunta conserva sus píxeles originales; se verificó PNG de 1536×1024 con canal alfa y píxeles transparentes en las esquinas, por lo que el fondo no está incorporado como rectángulo negro. El CSS responsive existente sigue controlando tamaño y `object-fit: contain`.

**Archivos:** `src/app/servicios/sesion-autenticacion.ts`, `src/app/guards/autenticacion.guard.ts`, `src/app/rutas/Login/login.ts`, `src/app/rutas/Login/login.html`, `src/app/rutas/Login/login.css`, `src/app/app.routes.ts`, `src/app/componentes/menu-perfil/menu-perfil.ts`, `src/app/componentes/menu-perfil/menu-perfil.html`, `src/app/componentes/menu-perfil/menu-perfil.css`, `src/app/componentes/sidebar-principal/sidebar-principal.ts`, `src/app/componentes/sidebar-principal/sidebar-principal.html` y este documento. `app.config.ts` ya proporcionaba Firebase Auth, así que no se modificó.

**Límites de autorización:** autenticar una cuenta Firebase no concede roles administrativos. El guard solo protege la navegación frontend; las APIs y Firestore deben validar identidad y permisos en el servidor. No se encontró un interceptor existente que envíe ID tokens a los endpoints HTTP y no se inventó uno ni se modificó el backend. Las reglas de acceso reales, el rol de cada usuario y la verificación de una cuenta Firebase de prueba quedan pendientes de contratos/permisos autorizados.

**Verificación:** la búsqueda en `src/app` no encontró las credenciales demo, `iniciarSesionDemo`, el texto de acceso ni un estado de sesión demo. El selector conserva ambas opciones y los datos simulados permanecen disponibles. `npm run build` compiló los bundles y prerenderizó 12 rutas sin errores TypeScript ni de plantilla, pero terminó con código 1 por el presupuesto del bundle inicial (1.21 MB frente al máximo de 1.00 MB). También reportó avisos de CSS en Inicio (4.36 kB) y Login (5.03 kB), además de dependencias CommonJS de Firebase. No se dispone de credenciales Firebase autorizadas para probar en vivo el acceso correcto/incorrecto, cierre y restauración de una cuenta real. El backend debe validar tokens y permisos en sus propios endpoints.


## Interacción del botón Cerrar sesión

Se añadieron estilos locales al botón existente de `MenuPerfil`: hover con fondo violeta/fucsia y brillo tenue, icono fucsia con desplazamiento horizontal de 2 px, estado active con escala breve y focus visible para teclado. Las transiciones duran 200 ms y se desactivan con `prefers-reduced-motion`. El estado de carga sigue deshabilitando el botón durante `SesionAutenticacion.cerrarSesion()`; si Firebase falla, el servicio no borra la sesión y el componente presenta un mensaje legible.

**Archivos:** `src/app/componentes/menu-perfil/menu-perfil.css` y este documento. No se modificaron la estructura del sidebar ni el flujo de autenticación.

**Verificación:** el CSS cubre hover, active, focus-visible, disabled y movimiento reducido; el HTML existente conserva un `button` nativo con texto accesible, llamada a `cerrarSesion()` y prevención de clics repetidos. Pendiente de inspección interactiva en navegador. `npm run build` se ejecutó; no reportó errores de TypeScript/plantilla y prerenderizó las 12 rutas, pero finalizó con código 1 por el presupuesto global del bundle inicial (1.21 MB frente a 1.00 MB). No se dispone de una sesión Firebase autorizada para probar el cierre real en vivo.


## Menú de perfil y bienvenida personalizada

El desplegable inferior se posiciona hacia arriba dentro del contenedor del perfil, con ancho limitado al sidebar, `box-sizing: border-box` y una superficie morada oscura fija en ambos temas. Se añadieron estilos locales de alineación y foco para el control de apertura; el botón de cierre Firebase conserva sus estados de interacción. La misma propiedad de presentación del perfil muestra `Cuenta empresarial` tanto en el sidebar como en el menú, y mantiene el nombre derivado del email.

Inicio ahora prioriza el `displayName` de Firebase; si no existe, muestra el prefijo del correo y finalmente `Usuario`. Las flechas de las tarjetas Agentes, Stack Tecnológico, Activos y Control de agentes se iluminan cuando se pasa el mouse por cualquier parte de la tarjeta; también conservan respuesta focus-visible/active y soporte para `prefers-reduced-motion`. Los enlaces se conservan.

**Archivos:** `src/app/componentes/menu-perfil/menu-perfil.ts`, `src/app/componentes/menu-perfil/menu-perfil.css`, `src/app/rutas/Inicio/inicio.ts`, `src/app/rutas/Inicio/inicio.html`, `src/app/rutas/Inicio/inicio.css`, `src/styles.css` (reglas suplementarias limitadas a los componentes) y este documento.

**Verificación:** el selector de flecha ahora depende de `:hover` en `.home-link-card`, mientras focus-visible y active siguen disponibles; ambos lugares del perfil comparten el texto actualizado. `npm run build` prerenderizó las 12 rutas sin errores TypeScript ni de plantilla, pero terminó con código 1 por el presupuesto del bundle inicial (1.21 MB frente a 1.00 MB). Permanecen los avisos CSS de Inicio (4.36 kB frente a 4 kB) y Login (5.03 kB frente a 4 kB), además de CommonJS en Firebase. No hubo navegador disponible para inspección visual en ambos temas y tamaños.


## Feeds de inteligencia

Se añadió la pantalla protegida `/feeds` y su opción al menú lateral inmediatamente antes de Control de agentes. La navegación usa el icono `LucideRss` disponible en el proyecto: el PNG RSS adjunto fue revisado y contiene fondo opaco negro, por lo que no se utiliza para evitar un recuadro no deseado. El globo holográfico transparente se guardó en `public/assets/hermes-intelligence-globe.png` y se integra detrás del carrusel.

`FeedsInteligenciaServicio` define el modelo interno tipado de feed, conserva en memoria los seis ejemplos y permite cambiar su estado únicamente cuando el selector global está en modo demo. El modelo incluye identificador, nombre, categoría, proveedor, descripción, estado, frecuencia ilustrativa, sincronización opcional, cobertura y severidad. Los datos demo comienzan con cuatro feeds activos y dos inactivos. No se asignan fechas ficticias de sincronización: por ello el KPI de últimas 24 horas informa “No disponible”. En modo real el servicio devuelve una lista vacía y la vista informa “Integración pendiente”; no hace solicitudes HTTP ni supone contratos. Las señales de carga y error quedan disponibles para la futura integración.

El carrusel navega en bucle mediante una posición virtual continua, mientras mantiene la selección anclada al ID estable del feed para tolerar cambios de orden en los datos. Al pulsar una tarjeta lateral, esta ocupa el centro y se actualizan los detalles; los puntos de paginación fueron retirados y no queda un hueco reservado para ellos. Para listas de dos feeds se muestra un solo vecino, evitando duplicar la misma tarjeta a ambos lados; con cero o un registro se maneja el estado vacío o la tarjeta única. También se conserva la navegación por arrastre/gesto y trackpad. El control `switch` es independiente de la selección. Se retiró de esta vista la ilustración del robot, sin eliminar su recurso, y se elevó el globo al primer plano decorativo detrás de las tarjetas, con dimensiones contenidas en el escenario. Se conserva su visibilidad en ambos temas y el contraste de tarjetas en modo claro. No se añadió historial de activación ni sincronización. Se ajustó la cuadrícula móvil del menú a seis accesos.

**Archivos de esta corrección:** `src/app/componentes/sidebar-principal/sidebar-principal.ts` (orden Feeds antes de Control de agentes), `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.ts` (selección estable por ID y navegación lateral/circular), `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.html` (eliminación total de puntos y selección de tarjeta por ID), `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.css` (capa, tamaño y visibilidad del globo; espacio del carrusel sin paginación) y este documento. La ruta aprovecha el guard Firebase existente y se carga de forma diferida; el selector demo/real es el estado existente `OrigenDashboard`.

**Pendiente del backend:** contrato de consulta de feeds, estructura de respuesta, identificadores estables, permisos de activación, operaciones para cambiar el estado, semántica de sincronización y campos de cobertura/severidad. Hasta que se confirmen, el modo real no presenta datos ni simula operaciones.

**Verificación:** `npm run build -- --configuration development` compiló después de los cambios finales y prerenderizó 13 rutas sin errores. El build de producción también prerenderizó las 13 rutas y compiló el chunk diferido de Feeds (13.85 kB), pero terminó con código 1 por el presupuesto del bundle inicial (1.24 MB frente a 1.00 MB); persisten los avisos CSS de Login e Inicio y CommonJS de Firebase. La plantilla ya no contiene botones de flecha ni referencia al robot. La revisión de CSS confirmó estilos de contraste claro, hover en tarjetas laterales y ausencia de desbordamiento horizontal en el carrusel; no hubo navegador disponible para inspección visual interactiva.

**Verificación de esta corrección:** `npm run build -- --configuration development` completó correctamente y prerenderizó las 13 rutas. La búsqueda de referencias confirmó que se eliminaron del componente la navegación por puntos y sus estilos, mientras el índice virtual continúa controlando la animación y los detalles derivan de la selección por ID. Se revisaron las posiciones dinámicas para colecciones vacías, de un feed, dos feeds y más; no hubo navegador disponible para comprobar visualmente el globo en ambos temas ni las interacciones físicas/responsivas.

## Corrección de interacción y visibilidad del carrusel Feeds

La causa de los clics perdidos era la captura del puntero en cada `pointerdown`: el contenedor llamaba `setPointerCapture()` antes de que el navegador resolviera el objetivo del clic, por lo que el botón de la tarjeta lateral podía no recibirlo. Ahora el arrastre se registra primero y la captura se solicita solo después de superar el umbral horizontal de 45 px. El clic normal conserva como destino el botón accesible que cubre la tarjeta; el switch sigue separado y el servicio demo conserva la responsabilidad de cambiar únicamente su estado.

El planeta usa el mismo PNG y se renderiza en ambas ramas. El contenedor y la imagen mantienen `pointer-events: none` para la decoración y la imagen queda por debajo del escenario. El planeta se perdía visualmente con feeds porque los fondos casi opacos de las tarjetas ocultaban su área central; las tarjetas ahora usan superficies translúcidas en ambos temas, conservando texto y controles por encima. No se agregaron imágenes ni capas de interacción.

Se añadió `feeds-inteligencia.spec.ts` con cobertura de selección por clic después de `pointerdown`, selección lateral, wrap circular, cambio de filtro, listas vacías/pequeñas y separación de activación. No se modificó servicio, contrato ni datos demo.

**Archivos:** `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.ts`, `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.html`, `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.css`, `src/app/rutas/Feeds-inteligencia/feeds-inteligencia.spec.ts` y este documento.

**Verificación:** la suite focalizada `npm test -- --watch=false --include=src/app/rutas/Feeds-inteligencia/feeds-inteligencia.spec.ts` pasó sus 5 pruebas. `npm run build -- --configuration development` terminó correctamente y prerenderizó 13 rutas. Una ejecución general de `npm test -- --watch=false` reportó una falla preexistente en `src/app/app.spec.ts` (espera un `h1` con “Hello”, ausente en el contenido actual); la suite focalizada de Feeds sí pasó. No había navegador ejecutable disponible, así que el aspecto visual final y clics físicos/táctiles quedan pendientes de comprobación manual.


## Presentación de Configuración personalizada

Se reorganizó únicamente el contenido de Configuración personalizada en tres tarjetas apiladas: Autonomía, Revisión y Cautela. Cada tarjeta presenta icono, descripción, anillo SVG, slider horizontal y límites de 0% y 100%. El anillo usa un recorrido SVG normalizado a 100 y su desplazamiento se calcula desde el mismo valor de `parametrosPersonalizadosBorrador` usado por el slider; ambos se actualizan con el estado existente y no se mantienen porcentajes duplicados.

Se conservaron el selector de perfiles, el borrador de sesión, las comparaciones anterior/nuevo, el guardado demo y la restauración de `cancelar()`. Los valores iniciales se mantienen en `SupervisionAgentes` (70/55/40). La nota informativa indica que son porcentajes demo. En modo real, los controles siguen deshabilitados y muestran integración pendiente; no se envían valores al backend. El robot continúa después del panel personalizado en el flujo de la columna izquierda, y la columna derecha no se modificó.

Los sliders conservan teclado y focus visible, usan controles `range` nativos y aplican movimiento reducido al progreso circular. El CSS emplea tokens de tema para superficies, texto, bordes y acentos.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.ts` (metadata con icono y descripción), `src/app/rutas/Configuracion-agente/configuracion-agente.html` (tarjetas y SVG vinculados al borrador), `src/app/rutas/Configuracion-agente/configuracion-agente.css` (presentación responsive y temas) y este documento.

**Verificación:** `npm run build -- --configuration development` compiló sin errores y prerenderizó 13 rutas. `npm run build` también prerenderizó 13 rutas sin errores TypeScript, plantilla o estilos de este componente, pero terminó con código 1 porque el bundle inicial excede el presupuesto configurado: 1.24 MB frente a 1.00 MB. Se mantienen los avisos CSS preexistentes de Login e Inicio y CommonJS en dependencias Firebase. No se realizó inspección visual en navegador.


## Reorganización de Configuración personalizada

Se restauró el icono Lucide `LucideSlidersHorizontal` en el recuadro del encabezado y se registró en los imports standalone del componente, que era lo que impedía que el selector se renderizara.

La plantilla conserva el perfil, herramientas, estado de los parámetros, edición y guardado existentes. El robot sigue debajo de los perfiles en la columna izquierda. Herramientas permanece arriba en la columna derecha. Cuando el perfil borrador es Personalizado, la columna derecha muestra allí las tres tarjetas existentes y omite visualmente los paneles de Permisos y políticas y Human-in-the-Loop. Con Bajo, Medio o Alto vuelve a renderizar ambos paneles. Sus contenidos y servicios no se eliminaron.

Los sliders y círculos siguen leyendo `parametrosPersonalizadosBorrador`; no se creó un estado paralelo. En modo real se muestran como controles deshabilitados con porcentajes no disponibles y aviso de integración pendiente. Un texto aclara que elegir este perfil no modifica permisos, políticas ni revisiones obligatorias.

**Archivos:** `src/app/rutas/Configuracion-agente/configuracion-agente.ts`, `src/app/rutas/Configuracion-agente/configuracion-agente.html`, `src/app/rutas/Configuracion-agente/configuracion-agente.css` y este documento.

**Verificación:** `npm run build -- --configuration development` compiló correctamente y prerenderizó 13 rutas. Se conservaron sin cambios los perfiles, la función `actualizarParametroPersonalizado`, el flujo de guardar/cancelar y los paneles de seguridad en su rama condicional. No se hizo una inspección visual interactiva en navegador.
