import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'recipes' },
  {
    path: 'recipes',
    loadComponent: () => import('./recipes/recipe-list/recipe-list').then((m) => m.RecipeList),
  },
  { path: '**', redirectTo: 'recipes' },
];
