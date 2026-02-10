import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';

import { AuthGuard } from './core/auth.guard';
import { EditorOrAdminGuard } from './core/editor-or-admin.guard';
import { AdminOnlyGuard } from './core/admin-only.guard';

export const routes: Routes = [
  // =========================
  // ✅ PUBLIC (sans AuthGuard)
  // =========================
  {
    path: 'login',
    component: LoginComponent,
    data: {
      title: 'Connexion – AquaManager',
      description:
        "Connectez-vous à AquaManager pour suivre vos aquariums, vos paramètres d’eau et vos tâches d’entretien.",
      robots: 'noindex',
    },
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
    data: { title: 'Inscription – AquaManager', robots: 'noindex' },
  },

  // ✅ Page appelée depuis le mail (OBLIGATOIREMENT publique)
  {
    path: 'auth/verification-email',
    loadComponent: () =>
      import('./pages/email/verify-email.component').then((m) => m.VerifyEmailComponent),
    data: { title: 'Vérification email – AquaManager', robots: 'noindex' },
  },

  // ✅ reset / forgot (public)
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./pages/email/reset-password.component').then((m) => m.ResetPasswordComponent),
    data: { title: 'Réinitialisation mot de passe – AquaManager', robots: 'noindex' },
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./pages/email/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    data: { title: 'Mot de passe oublié – AquaManager', robots: 'noindex' },
  },

  // ✅ Pages légales (publiques)
  {
    path: 'legal',
    loadComponent: () => import('./pages/legal/legal.component').then((m) => m.LegalComponent),
    data: { title: 'Mentions légales – AquaManager', robots: 'index,follow' },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/legal/privacy.component').then((m) => m.PrivacyComponent),
    data: { title: 'Politique de confidentialité – AquaManager', robots: 'index,follow' },
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/legal/terms.component').then((m) => m.TermsComponent),
    data: { title: 'CGU – AquaManager', robots: 'index,follow' },
  },

  // ✅ Pages publiques marketing (tu peux protéger si tu veux)
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'a-propos-gestion-aquarium',
    loadComponent: () => import('./pages/about/about.component').then((m) => m.AboutComponent),
  },

  // ✅ ARTICLES PUBLICS
  {
    path: 'articles',
    loadComponent: () =>
      import('./pages/articles/articles-page.component').then((m) => m.ArticlesPageComponent),
    data: { title: 'Articles – AquaManager', robots: 'index,follow' },
  },
  {
    path: 'articles/:slug',
    loadComponent: () =>
      import('./pages/articles/article-details-page.component').then(
        (m) => m.ArticleDetailsPageComponent,
      ),
  },

  // =========================
  // ✅ PROTÉGÉ (AuthGuard)
  // =========================

  // ✅ Accueil après login
  { path: '', component: HomeComponent, canActivate: [AuthGuard], pathMatch: 'full' },

  {
    path: 'aquariums',
    loadComponent: () =>
      import('./pages/aquariums/aquariums.component').then((m) => m.AquariumsComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'aquariums/:id',
    loadComponent: () =>
      import('./pages/aquariums/detail/aquarium-detail.component').then(
        (m) => m.AquariumDetailComponent,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/calendar.component').then((m) => m.CalendarComponent),
    canActivate: [AuthGuard],
  },

  // =========================
  // ✅ EDITOR + ADMIN
  // (Poissons / Plantes / Articles)
  // =========================
  {
    path: 'admin/species/fish',
    loadComponent: () =>
      import('./pages/profile/Fiche-poissons/admin-fish-cards.component').then(
        (m) => m.AdminFishCardsComponent,
      ),
    data: { title: 'Admin – Espèces (Poissons) – AquaManager', robots: 'noindex' },
    canActivate: [AuthGuard, EditorOrAdminGuard],
  },
  {
    path: 'admin/species/plant',
    loadComponent: () =>
      import('./pages/profile/Fiche-Plants/admin-plant-cards.component').then(
        (m) => m.AdminPlantCardsComponent,
      ),
    data: { title: 'Admin – Espèces (Plants) – AquaManager', robots: 'noindex' },
    canActivate: [AuthGuard, EditorOrAdminGuard],
  },
  {
    path: 'admin/articles',
    loadComponent: () =>
      import('./pages/profile/admin-articles/admin-articles-page.component').then(
        (m) => m.AdminArticlesPageComponent,
      ),
    canActivate: [AuthGuard, EditorOrAdminGuard],
    data: { title: 'Admin – Articles – AquaManager', robots: 'noindex' },
  },
  {
    path: 'admin/articles/:id/stats',
    loadComponent: () =>
      import('./pages/profile/admin-articles/stats/admin-article-stats.component').then(
        (m) => m.AdminArticleStatsComponent,
      ),
    canActivate: [AuthGuard, EditorOrAdminGuard],
    data: { title: 'Admin – Stats article – AquaManager', robots: 'noindex' },
  },
  {
    path: 'admin/articles/:id/edit',
    loadComponent: () =>
      import('./pages/profile/admin-articles/edit/admin-article-edit.component').then(
        (m) => m.AdminArticleEditComponent,
      ),
    canActivate: [AuthGuard, EditorOrAdminGuard],
    data: { title: 'Admin – Modifier article – AquaManager', robots: 'noindex' },
  },

  // =========================
  // ✅ ADMIN ONLY
  // (Metrics / Users)
  // =========================
  {
    path: 'admin/metrics',
    loadComponent: () =>
      import('./pages/profile/admin-metrics/admin-metrics.component').then(
        (m) => m.AdminMetricsComponent,
      ),
    canActivate: [AuthGuard, AdminOnlyGuard],
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./pages/profile/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
    data: { title: 'Admin – Utilisateurs – AquaManager', robots: 'noindex' },
    canActivate: [AuthGuard, AdminOnlyGuard],
  },
  {
    path: 'admin/users/:id',
    loadComponent: () =>
      import('./pages/profile/admin-users/fiche_user/admin-user-detail.component').then(
        (m) => m.AdminUserDetailComponent,
      ),
    canActivate: [AuthGuard, AdminOnlyGuard],
  },
  {
  path: 'species',
  loadComponent: () => import('./pages/fiches/species-page.component').then(m => m.SpeciesPageComponent),
},
{
  path: 'species/fish/:id',
  loadComponent: () =>
    import('./pages/fiches/details/fish-card-detail-page.component').then(m => m.FishCardDetailPageComponent),
},
{
  path: 'species/plant/:id',
  loadComponent: () =>
    import('./pages/fiches/details/plant-card-detail-page.component').then(m => m.PlantCardDetailPageComponent),
},



  // =========================
  // Redirects / 404
  // =========================
  { path: 'auth/connexion', redirectTo: 'login', pathMatch: 'full' },

  // ✅ 404 -> accueil (protégé)
  { path: '**', redirectTo: '' },
];
