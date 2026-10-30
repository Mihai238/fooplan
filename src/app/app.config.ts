import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SessionBackend } from './session-backend';
import { StorageBackend } from './storage';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: StorageBackend, useExisting: SessionBackend },
  ],
};
