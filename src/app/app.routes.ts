import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plan' },
  {
    path: 'plan',
    loadComponent: () => import('./plan/plan-page/plan-page').then((m) => m.PlanPage),
  },
  {
    path: 'recipes',
    loadComponent: () => import('./recipes/recipe-list/recipe-list').then((m) => m.RecipeList),
  },
  { path: '**', redirectTo: 'plan' },
];
