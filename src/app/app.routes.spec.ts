import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { PlanStore } from './plan/plan-store';
import { RecipeStore } from './recipes/recipe-store';
import { RECIPES } from './recipes/recipes';
import { ownRecipe, QUICK_DAL, storeOwnRecipes } from './recipes/testing';

describe('routes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('opens the plan page at the root URL', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/plan');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Plan');
  });

  it('redirects an unknown URL to /plan', async () => {
    const harness = await RouterTestingHarness.create('/nope');
    expect(TestBed.inject(Router).url).toBe('/plan');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Plan');
  });

  it('shows the recipes at /recipes', async () => {
    const harness = await RouterTestingHarness.create('/recipes');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelectorAll('article').length).toBeGreaterThan(0);
  });

  it('shows the recipe at /recipes/<slug> when opened directly, and again after a reload', async () => {
    for (const [url, name] of [
      ['/recipes/spaghetti-carbonara', 'Spaghetti carbonara'],
      ['/recipes/nicoise-salad', 'Niçoise salad'],
    ]) {
      for (const open of ['opened', 'reloaded']) {
        const harness = await RouterTestingHarness.create(url);
        expect(TestBed.inject(Router).url, `${url} ${open}`).toBe(url);
        expect(
          harness.routeNativeElement!.querySelector('h1')?.textContent?.trim(),
          `${url} ${open}`,
        ).toBe(name);
        // A fresh app on the same URL, as a reload makes
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      }
    }
  });

  it('redirects an unknown recipe slug to /recipes, showing the recipes and no recipe page', async () => {
    const harness = await RouterTestingHarness.create('/recipes/pizza-hawaii');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Recipes');
    expect(harness.routeNativeElement!.querySelectorAll('article').length).toBeGreaterThan(0);
  });

  it('shows the Recipes page for /recipes/lasagne, a removed recipe, and the "Niçoise salad" recipe page for /recipes/nicoise-salad', async () => {
    const harness = await RouterTestingHarness.create('/recipes/lasagne');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Recipes');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const recipePage = await RouterTestingHarness.create('/recipes/nicoise-salad');
    expect(TestBed.inject(Router).url).toBe('/recipes/nicoise-salad');
    expect(recipePage.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Niçoise salad',
    );
  });

  it('shows the Recipes page for /recipes/lentil-soup, a removed soup, and the "Shakshuka with bread" recipe page for /recipes/shakshuka-with-bread', async () => {
    const harness = await RouterTestingHarness.create('/recipes/lentil-soup');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Recipes');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const recipePage = await RouterTestingHarness.create('/recipes/shakshuka-with-bread');
    expect(TestBed.inject(Router).url).toBe('/recipes/shakshuka-with-bread');
    expect(recipePage.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Shakshuka with bread',
    );
  });

  it('shows the Recipes page for the pages of the other removed soups, /recipes/pumpkin-soup, /recipes/tomato-soup-with-grilled-cheese and /recipes/potato-and-leek-soup', async () => {
    for (const url of [
      '/recipes/pumpkin-soup',
      '/recipes/tomato-soup-with-grilled-cheese',
      '/recipes/potato-and-leek-soup',
    ]) {
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url, url).toBe('/recipes');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim(), url).toBe(
        'Recipes',
      );
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    }
  });

  it('shows the recipe page of an own recipe named "Lentil soup" at /recipes/lentil-soup opened directly', async () => {
    storeOwnRecipes(ownRecipe('Lentil soup'));
    const recipePage = await RouterTestingHarness.create('/recipes/lentil-soup');
    expect(TestBed.inject(Router).url).toBe('/recipes/lentil-soup');
    expect(recipePage.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Lentil soup',
    );
    expect(TestBed.inject(RecipeStore).bySlug('lentil-soup')?.own, 'own recipe').toBe(true);
  });

  it('shows the recipe page of the own recipe "Quick Dal" at /recipes/quick-dal opened directly, and the Recipes page for /recipes/no-such-dal', async () => {
    storeOwnRecipes(QUICK_DAL);
    const recipePage = await RouterTestingHarness.create('/recipes/quick-dal');
    expect(TestBed.inject(Router).url).toBe('/recipes/quick-dal');
    expect(recipePage.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Quick Dal',
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/recipes/no-such-dal');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Recipes');
  });

  it('redirects a recipe slug in another case to /recipes', async () => {
    const harness = await RouterTestingHarness.create('/recipes/Spaghetti-Carbonara');
    expect(TestBed.inject(Router).url).toBe('/recipes');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Recipes');
  });

  it('leaves no history entry for an unknown recipe slug, so going back skips it', async () => {
    const harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/groceries');
    await harness.navigateByUrl('/recipes/pizza-hawaii');
    expect(TestBed.inject(Router).url, 'not redirected').toBe('/recipes');
    const location = TestBed.inject(Location);
    expect(location.path()).toBe('/recipes');
    location.back();
    await harness.fixture.whenStable();
    expect(location.path()).toBe('/groceries');
  });

  it('shows the Recipes page for /recipes/spaghetti-carbonara/edit, a built-in recipe, and /recipes/imaginary-stew/edit, no recipe', async () => {
    for (const url of ['/recipes/spaghetti-carbonara/edit', '/recipes/imaginary-stew/edit']) {
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url, url).toBe('/recipes');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim(), url).toBe(
        'Recipes',
      );
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    }
  });

  it('shows the Recipes page for the page and the edit form of "Grandma\'s Soup" once it is renamed to "Red Soup", and of "Quick Dal" once it is deleted', async () => {
    storeOwnRecipes(ownRecipe("Grandma's Soup"), QUICK_DAL);
    const harness = await RouterTestingHarness.create('/recipes/grandmas-soup');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      "Grandma's Soup",
    );
    TestBed.inject(RecipeStore).replace("Grandma's Soup", ownRecipe('Red Soup'));
    TestBed.inject(PlanStore).renameRecipe("Grandma's Soup", 'Red Soup');
    TestBed.inject(PlanStore).deleteRecipe('Quick Dal');
    expect(TestBed.inject(RecipeStore).bySlug('red-soup'), 'not renamed').toBeDefined();
    // The router ignores a navigation to the URL it is on
    await harness.navigateByUrl('/plan');

    for (const url of [
      '/recipes/grandmas-soup',
      '/recipes/grandmas-soup/edit',
      '/recipes/quick-dal',
      '/recipes/quick-dal/edit',
    ]) {
      await harness.navigateByUrl(url);
      expect(TestBed.inject(Router).url, url).toBe('/recipes');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim(), url).toBe(
        'Recipes',
      );
    }
  });

  describe('edge cases', () => {
    it('leaves no history entry for the edit form of a built-in recipe, so going back skips it', async () => {
      const harness = await RouterTestingHarness.create('/plan');
      await harness.navigateByUrl('/groceries');
      await harness.navigateByUrl('/recipes/spaghetti-carbonara/edit');
      expect(TestBed.inject(Router).url, 'not redirected').toBe('/recipes');
      const location = TestBed.inject(Location);
      expect(location.path()).toBe('/recipes');
      location.back();
      await harness.fixture.whenStable();
      expect(location.path()).toBe('/groceries');
    });
  });

  it("opens the recipe page of every recipe from its name's link on /recipes", async () => {
    const harness = await RouterTestingHarness.create('/recipes');
    const links = Array.from(
      harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('article h2 a'),
    ).map((link) => [link.getAttribute('href')!, link.textContent!.trim()]);
    expect(links, 'recipes linked').toHaveLength(RECIPES.length);
    for (const [href, name] of links) {
      await harness.navigateByUrl(href);
      expect(TestBed.inject(Router).url, name).toBe(href);
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim(), href).toBe(name);
    }
  });

  it('shows the grocery list at /groceries', async () => {
    const harness = await RouterTestingHarness.create('/groceries');
    expect(TestBed.inject(Router).url).toBe('/groceries');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Grocery list',
    );
  });
});
