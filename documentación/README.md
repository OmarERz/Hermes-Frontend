# Documentación de la aplicación

Hermes Control es una aplicación Angular para supervisar agentes, administrar el catálogo tecnológico empresarial y consultar activos. El catálogo y sus asignaciones se guardan temporalmente en localStorage; agentes y otros indicadores siguen usando datos de demostración.

## Estructura actual

- `src/app/app.ts` y `src/app/app.html`: raíz Angular y punto de salida del enrutador.
- `src/app/app.routes.ts`: rutas de Login, el marco de administración y sus pantallas hijas.
- `src/app/componentes/layout-principal/`: navegación lateral, encabezado común, búsqueda visual e identidad Hermes Control.
- `src/app/componentes/navegacion-agentes/`: pestañas accesibles compartidas para Dashboard, Historial, Recomendaciones y Revisión humana.
- `src/app/rutas/Login/`: inicio de sesión de demostración.
- `src/app/rutas/Inicio/`: bienvenida, enlaces a módulos y métricas según los datos disponibles; usa ilustraciones transparentes distintas para tema claro y oscuro.
- `src/app/rutas/Agentes/`: control y métricas simuladas del agente.
- `src/app/rutas/Configuracion-agente/`: configuración de demostración separada del dashboard.
- `src/app/rutas/Historial-agente/`: consulta y filtros de eventos demostrativos; no representa auditoría real.
- `src/app/rutas/Recomendaciones-agente/`: comparación demostrativa de propuestas y desacuerdos.
- `src/app/rutas/Revision-humana/`: decisiones y comentarios de demostración en memoria.
- `src/app/servicios/supervision-agentes.ts`: catálogo de ejemplo central para tickets, ejecuciones, recomendaciones, revisiones y configuración en memoria.
- `src/app/rutas/Stack-tecnologico/`: registro, administración y consulta del catálogo empresarial; el dashboard calcula sus conteos desde los registros guardados.
- `src/app/rutas/Asignar-stack/`: componente y lógica de asignación conservados; la ruta pública `/asignar-stack` redirige al catálogo y no ofrece acceso al formulario.
- `src/app/rutas/Activos/`: inventario, filtros y paginación de activos.
- `src/app/rutas/Registrar-activo/`: formulario que agrega elementos al inventario en memoria.
- `src/app/servicios/inventario-activos.ts`: registros reales en memoria y conexión opcional a la API de activos; inicia vacío cuando no hay registros.
- `src/app/servicios/origen-dashboard.ts`: origen global real/demo y conjuntos demostrativos centralizados para Agentes, Stack y Activos.
- `src/app/config/api.config.ts`: URL base y selección entre datos de demostración y API REST.
- `src/styles.css`: carga los estilos de las tres pantallas, delimitados a su vista.
- `src/app/tarjeta/`: componente de ejemplo con contador, no se usa en las rutas actuales.
- `src/main.ts`, `src/app/app.config.ts` y `src/app/app.config.server.ts`: arranque y configuración Angular/SSR.

## Ejecutar la aplicación

Con las dependencias instaladas, ejecuta `npm start` desde la raíz y abre la dirección local que indique Angular CLI (normalmente `http://localhost:4200`). Para compilar, ejecuta `npm run build`.

## Funcionalidades y verificaciones

El detalle de cada funcionalidad, sus archivos y los pasos para comprobarla se mantiene en [cambios.md](cambios.md). La raíz abre Login. El inicio de sesión es una simulación local y, al aceptarse, navega a Control del agente.

## Criterio para mantener esta documentación

Al incorporar una funcionalidad o hacer un cambio importante, actualizar primero el documento existente que corresponda. Añadir una entrada en `cambios.md` con su propósito, funcionamiento, archivos involucrados y pasos de comprobación. Crear documentos nuevos solo si describen un tema que no tenga ya un lugar adecuado.
- `src/app/componentes/banner-pagina/`: cabecera reutilizable de las vistas principales.
- `src/app/componentes/sidebar-principal/`: navegación lateral y perfil de usuario.
- `src/app/componentes/grafico-dashboard/`: componente reutilizable para gráficas ECharts.
- `src/app/servicios/catalogo-tecnologias.ts`: catálogo de tecnologías persistido en localStorage.
- `src/app/servicios/asignaciones-stack.ts`: relaciones entre activos y tecnologías persistidas en localStorage.
- El selector global ofrece datos reales (predeterminado) o datos de demostración. Las pantallas muestran estados vacíos o “Sin evaluar” cuando no hay datos reales.
- Configuración, historial, recomendaciones y revisión humana son demostraciones mientras no existan APIs de agentes; ninguna acción se presenta como persistida en producción.
