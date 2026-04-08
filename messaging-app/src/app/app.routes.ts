import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'fibre-planner',
    loadComponent: () =>
      import('./pages/fibre-planner/fibre-planner.component').then((m) => m.FibrePlannerComponent),
  },
  {
    path: 'task-manager',
    loadComponent: () =>
      import('./pages/task-manager/task-manager.component').then((m) => m.TaskManagerComponent),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/analytics/analytics.component').then((m) => m.AnalyticsComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
