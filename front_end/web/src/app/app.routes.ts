import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  { path: '', component: HomeComponent, canActivate: [AuthGuard] },

  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
  },

  {
    path: 'aquariums',
    loadComponent: () =>
      import('./pages/aquariums/aquariums.component').then(m => m.AquariumsComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'aquariums/:id',
    loadComponent: () =>
      import('./pages/aquariums/detail/aquarium-detail.component').then(m => m.AquariumDetailComponent),
    canActivate: [AuthGuard],
  },

  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard],
  },
  //{
  //  path: 'settings',
  //  loadComponent: () =>
  //    import('./pages/settings/settings.component').then(m => m.SettingsComponent),
  //  canActivate: [AuthGuard],
  //},
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar/calendar.component')
      .then(m => m.CalendarComponent)
  },

  { path: '**', redirectTo: '' },
];
 