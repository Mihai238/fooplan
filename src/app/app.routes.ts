import { inject, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Router, Routes, UrlTree } from '@angular/router';
import type { Recipe } from './recipes/recipe';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
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
    path: 'recipes/:slug/edit',
    canActivate: [ownRecipe],
    loadComponent: () => import('./recipes/recipe-form/recipe-form').then((m) => m.RecipeForm),
  },
  {
    path: 'add-recipe',
    loadComponent: () => import('./recipes/recipe-form/recipe-form').then((m) => m.RecipeForm),
  },
  {
    path: 'groceries',
    loadComponent: () => import('./groceries/grocery-list/grocery-list').then((m) => m.GroceryList),
  },
  { path: '**', redirectTo: '' },
];

function knownRecipe(route: ActivatedRouteSnapshot): Promise<true | UrlTree> {
  return recipeGuard(route, (recipe) => recipe !== undefined);
}

function ownRecipe(route: ActivatedRouteSnapshot): Promise<true | UrlTree> {
  return recipeGuard(route, (recipe) => recipe?.own === true);
}

// Imported on demand to keep the recipes out of the initial bundle; inject() works only before the
// import resolves, so the store comes from the injector taken here. Returning a UrlTree, rather than
// navigating from here, replaces the refused URL instead of leaving it in the history
function recipeGuard(
  route: ActivatedRouteSnapshot,
  allows: (recipe: Recipe | undefined) => boolean,
): Promise<true | UrlTree> {
  const router = inject(Router);
  const injector = inject(Injector);
  return import('./recipes/recipe-store').then(({ RecipeStore }) =>
    allows(injector.get(RecipeStore).bySlug(route.paramMap.get('slug')!))
      ? true
      : router.parseUrl('/recipes'),
  );
}
