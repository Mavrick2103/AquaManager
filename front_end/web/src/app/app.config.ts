import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import {
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';

import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthInterceptor } from './core/auth.interceptor';

import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

    provideAnimations(),

    provideCharts(withDefaultRegisterables()),

    // ✅ DatePipe + i18n Angular
    { provide: LOCALE_ID, useValue: 'fr-FR' },

    // ✅ Angular Material Datepicker
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    provideNativeDateAdapter(),
    MatDatepickerModule,
    MatNativeDateModule,
  ],
};