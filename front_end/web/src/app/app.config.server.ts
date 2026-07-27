import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

@Injectable()
class ServerApiInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler) {
    const publicApiUrl = 'https://aquamanager.fr/api';
    const internalApiUrl = process.env['SSR_API_URL'] || 'http://api:3000/api';
    const url = request.url.startsWith(publicApiUrl)
      ? `${internalApiUrl}${request.url.slice(publicApiUrl.length)}`
      : request.url;

    return next.handle(request.clone({ url }));
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ServerApiInterceptor,
      multi: true,
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
