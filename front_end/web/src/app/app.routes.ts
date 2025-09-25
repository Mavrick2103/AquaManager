import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { AuthGuard } from './core/auth.guard'; // ✅ fonction guard

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard], // ✅ fonction
  },
  {
    path: 'aquariums',
    loadComponent: () =>
      import('./pages/aquariums/aquariums.component').then(m => m.AquariumsComponent),
    canActivate: [AuthGuard], // ✅ fonction
  },
  
  { path: '**', redirectTo: '' },
];
