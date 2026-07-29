import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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
