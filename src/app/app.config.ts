import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { APP_CONFIG, AppConfig } from './core/config/app-config';

/** Root providers, built from the configuration loaded at startup (main.ts). */
export function createAppConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: APP_CONFIG, useValue: config },
      provideRouter(routes),
      provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    ],
  };
}
