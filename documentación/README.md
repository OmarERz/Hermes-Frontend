# Documentación de la aplicación

Hermes Control es una aplicación Angular para supervisar agentes, administrar el catálogo tecnológico empresarial y consultar activos y vulnerabilidades. Se conecta al backend de Hermes (fuente de verdad) y usa Firebase Auth; la configuración y los comandos están en el `README.md` de la raíz. El catálogo y sus asignaciones se guardan temporalmente en localStorage; las pantallas que aún no tienen ruta en el backend muestran «Sin datos» (ya no hay datos de demostración).

## Estructura actual

- `src/app/app.ts` y `src/app/app.html`: raíz Angular y punto de salida del enrutador.
- `src/app/app.routes.ts`: rutas de Login, el marco de administración y sus pantallas hijas.
- `src/app/componentes/layout-principal/`: navegación lateral, encabezado común, búsqueda visual e identidad Hermes Control.
- `src/app/componentes/navegacion-agentes/`: pestañas accesibles compartidas para Dashboard, Historial, Recomendaciones y Revisión humana.
- `src/app/rutas/Login/`: inicio de sesión con Firebase Auth (correo y contraseña); al entrar carga el perfil y el rol desde `GET /api/me`.
- `src/app/rutas/Inicio/`: bienvenida, enlaces a módulos y métricas según los datos disponibles; usa ilustraciones transparentes distintas para tema claro y oscuro.
- `src/app/rutas/Agentes/`: control y métricas simuladas del agente.
- `src/app/rutas/Configuracion-agente/`: configuración de demostración separada del dashboard.
- `src/app/rutas/Historial-agente/`: consulta y filtros de eventos demostrativos; no representa auditoría real.
- `src/app/rutas/Recomendaciones-agente/`: comparación demostrativa de propuestas y desacuerdos.
- `src/app/rutas/Revision-humana/`: decisiones y comentarios de demostración en memoria.
- `src/app/servicios/supervision-agentes.ts`: modelos de presentación de tickets, ejecuciones, recomendaciones y revisiones (listas vacías hasta conectar el backend).
- `src/app/rutas/Stack-tecnologico/`: registro, administración y consulta del catálogo empresarial; el dashboard calcula sus conteos desde los registros guardados.
- `src/app/rutas/Asignar-stack/`: componente y lógica de asignación conservados; la ruta pública `/asignar-stack` redirige al catálogo y no ofrece acceso al formulario.
- `src/app/rutas/Activos/`: inventario, filtros y paginación de activos.
- `src/app/rutas/Registrar-activo/`: formulario que agrega elementos al inventario en memoria.
- `src/app/servicios/inventario-activos.ts`: registros en memoria; inicia vacío (el backend aún no tiene ruta de activos para esta pantalla).
- `src/app/core/`: configuración (`config/`), cliente tipado de la API y manejo de errores (`api/`), sesión, guardas por rol e interceptor del token (`auth/`).
- `src/app/shared/`: estados de carga, vacío y error, paginación por cursor, diálogo de confirmación con versión esperada y exportación CSV segura.
- `src/app/features/vulnerabilities/`: pantalla Vulnerabilidades conectada a `GET /api/vulnerabilities`.
- `src/styles.css`: carga los estilos de las tres pantallas, delimitados a su vista.
- `src/app/tarjeta/`: componente de ejemplo con contador, no se usa en las rutas actuales.
- `src/main.ts` y `src/app/app.config.ts`: arranque en el cliente (lee `runtime-config.json` si existe) y proveedores de Angular.

## Ejecutar la aplicación

Con las dependencias instaladas, ejecuta `npm start` desde la raíz y abre la dirección local que indique Angular CLI (normalmente `http://localhost:4200`). Para compilar, ejecuta `npm run build`.

## Funcionalidades y verificaciones

El detalle de cada funcionalidad, sus archivos y los pasos para comprobarla se mantiene en [cambios.md](cambios.md). La raíz abre Login. Al iniciar sesión con Firebase y cargar el perfil, navega a Inicio.

## Criterio para mantener esta documentación

Al incorporar una funcionalidad o hacer un cambio importante, actualizar primero el documento existente que corresponda. Añadir una entrada en `cambios.md` con su propósito, funcionamiento, archivos involucrados y pasos de comprobación. Crear documentos nuevos solo si describen un tema que no tenga ya un lugar adecuado.
- `src/app/componentes/banner-pagina/`: cabecera reutilizable de las vistas principales.
- `src/app/componentes/sidebar-principal/`: navegación lateral y perfil de usuario.
- `src/app/componentes/grafico-dashboard/`: componente reutilizable para gráficas ECharts.
- `src/app/servicios/catalogo-tecnologias.ts`: catálogo de tecnologías persistido en localStorage.
- `src/app/servicios/asignaciones-stack.ts`: relaciones entre activos y tecnologías persistidas en localStorage.
- El selector global ofrece datos reales (predeterminado) o datos de demostración. Las pantallas muestran estados vacíos o “Sin evaluar” cuando no hay datos reales.
- Configuración, historial, recomendaciones y revisión humana son demostraciones mientras no existan APIs de agentes; ninguna acción se presenta como persistida en producción.
