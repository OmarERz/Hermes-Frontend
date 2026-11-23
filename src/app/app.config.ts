import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { firebaseConfig } from '../environments/firebase';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()), 

    provideFirebaseApp(() => initializeApp(firebaseConfig)),

    // 3. Servicios que activaste (Authentication y Firestore)
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ]
};
