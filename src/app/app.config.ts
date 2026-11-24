import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { APP_CONFIG, AppConfig } from './core/config/app-config';
import { AppTitleStrategy } from './core/navigation/title-strategy';

/** Root providers, built from the configuration loaded at startup (main.ts). */
export function createAppConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: APP_CONFIG, useValue: config },
      provideRouter(routes),
      { provide: TitleStrategy, useClass: AppTitleStrategy },
      provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    ],
  };
}
