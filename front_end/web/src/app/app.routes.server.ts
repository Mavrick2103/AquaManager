import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'login', renderMode: RenderMode.Server },
  { path: 'register', renderMode: RenderMode.Server },
  { path: 'contact', renderMode: RenderMode.Server },
  { path: 'privacy', renderMode: RenderMode.Server },
  {
    path: 'articles/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'poissons/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'plantes/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'articles',
    renderMode: RenderMode.Server,
  },
  {
    path: 'species',
    renderMode: RenderMode.Server,
  },
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
