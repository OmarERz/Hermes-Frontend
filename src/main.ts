import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { loadAppConfig, RuntimeConfigError } from './app/core/config/app-config';
import { environment } from './environments/environment';

/** Shows a startup failure as plain text (never as HTML). */
function showStartupError(message: string): void {
  const box = document.createElement('p');
  box.setAttribute('role', 'alert');
  box.style.cssText = 'margin:2rem;font:16px system-ui,sans-serif;color:#b91c1c';
  box.textContent = message;
  document.body.replaceChildren(box);
}

loadAppConfig(environment, document.baseURI)
  .then((config) => bootstrapApplication(App, createAppConfig(config)))
  .catch((error: unknown) => {
    console.error(error);
    showStartupError(
      error instanceof RuntimeConfigError
        ? `La configuración de runtime-config.json no es válida: ${error.message}`
        : 'No se pudo iniciar la aplicación. Recarga la página o avisa al equipo de soporte.',
    );
  });
