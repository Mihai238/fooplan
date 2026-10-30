import { inject, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Router, Routes, UrlTree } from '@angular/router';
import { AuthStore } from './auth/auth-store';
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
  {
    path: 'sign-in',
    canActivate: [signedOut],
    loadComponent: () => import('./auth/sign-in-page/sign-in-page').then((m) => m.SignInPage),
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
// import resolves, so the store comes from the injector taken here. A link opened directly comes
// before the recipes are loaded; once they are, a navigation inside the app doesn't read them again.
// Returning a UrlTree, rather than navigating from here, replaces the refused URL instead of leaving
// it in the history
async function recipeGuard(
  route: ActivatedRouteSnapshot,
  allows: (recipe: Recipe | undefined) => boolean,
): Promise<true | UrlTree> {
  const router = inject(Router);
  const injector = inject(Injector);
  const { RecipeStore } = await import('./recipes/recipe-store');
  const recipes = injector.get(RecipeStore);
  if (!recipes.ready()) {
    // The app shows that the load failed instead of any page. Refusing a first navigation would set
    // the URL back to the base URL, so the link is let through and stays for a reload
    try {
      await recipes.load();
    } catch {
      return true;
    }
  }
  return allows(recipes.bySlug(route.paramMap.get('slug')!)) ? true : router.parseUrl('/recipes');
}

// The client reads the saved session asynchronously on start, so /sign-in opened directly waits for
// it rather than showing the form to a signed-in user
async function signedOut(): Promise<true | UrlTree> {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenLoaded();
  return auth.email() === null ? true : router.parseUrl('/plan');
}
