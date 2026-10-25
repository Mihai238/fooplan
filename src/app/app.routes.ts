import { inject, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Router, Routes, UrlTree } from '@angular/router';

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
  {
    path: 'recipes/:slug',
    canActivate: [knownRecipe],
    loadComponent: () => import('./recipes/recipe-page/recipe-page').then((m) => m.RecipePage),
  },
  {
    path: 'add-recipe',
    loadComponent: () => import('./recipes/recipe-form/recipe-form').then((m) => m.RecipeForm),
  },
  {
    path: 'groceries',
    loadComponent: () => import('./groceries/grocery-list/grocery-list').then((m) => m.GroceryList),
  },
  { path: '**', redirectTo: 'plan' },
];

// Imported on demand to keep the recipes out of the initial bundle; inject() works only before the
// import resolves, so the store comes from the injector taken here. Returning a UrlTree, rather than
// navigating from here, replaces the unknown URL instead of leaving it in the history
function knownRecipe(route: ActivatedRouteSnapshot): Promise<true | UrlTree> {
  const router = inject(Router);
  const injector = inject(Injector);
  return import('./recipes/recipe-store').then(({ RecipeStore }) =>
    injector.get(RecipeStore).bySlug(route.paramMap.get('slug')!)
      ? true
      : router.parseUrl('/recipes'),
  );
}
