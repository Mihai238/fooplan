import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { FakeSupabase, provideSupabase, sessionFor } from './auth/testing';
import { PlanStore } from './plan/plan-store';
import { loadStores } from './plan/testing';
import { RecipeStore } from './recipes/recipe-store';
import { RECIPES } from './recipes/recipes';
import { ownRecipe, QUICK_DAL, shownStep, storeOwnRecipes } from './recipes/testing';
import { LocalStorageBackend, StorageBackend } from './storage';
import { HeldBackend } from './testing';

describe('routes', () => {
  let fake: FakeSupabase;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideSupabase(fake)],
    });
    await loadStores();
  });

  it('opens the home page at the root URL', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Lunch and dinner, planned in a few minutes',
    );
  });

  it('redirects an unknown URL to the home page', async () => {
    const harness = await RouterTestingHarness.create('/nope');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Lunch and dinner, planned in a few minutes',
    );
  });

  it('shows the plan page at /plan', async () => {
    const harness = await RouterTestingHarness.create('/plan');
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
        await loadStores();
      }
    }
  });

  it('shows the recipe page of each of the 5 easy recipes of #29 at its slug, opened directly, with "Step 1 of" its step count and its first step', async () => {
    for (const [url, name] of [
      ['/recipes/hummus-plate-with-bread-and-vegetables', 'Hummus plate with bread and vegetables'],
      ['/recipes/avocado-toast-with-fried-egg', 'Avocado toast with fried egg'],
      ['/recipes/caprese-salad-with-bread', 'Caprese salad with bread'],
      ['/recipes/spinach-and-feta-omelette', 'Spinach and feta omelette'],
      ['/recipes/tuna-and-white-bean-salad-with-bread', 'Tuna and white bean salad with bread'],
    ]) {
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe(url);
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim(), url).toBe(name);
      const recipe = RECIPES.find((candidate) => candidate.name === name);
      const steps = recipe?.steps ?? [];
      expect(steps.length, `${url} steps`).toBeGreaterThan(0);
      const page = harness.routeNativeElement!;
      expect(page.querySelector('.counter')?.textContent?.trim(), url).toBe(
        `Step 1 of ${steps.length}`,
      );
      expect(page.querySelector('.step')?.textContent?.trim(), url).toBe(
        shownStep(steps[0], recipe!.ingredients),
      );
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      await loadStores();
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
    await loadStores();
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
    await loadStores();
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
      await loadStores();
    }
  });

  it('shows the recipe page of an own recipe named "Lentil soup" at /recipes/lentil-soup opened directly', async () => {
    storeOwnRecipes(ownRecipe('Lentil soup'));
    await loadStores();
    const recipePage = await RouterTestingHarness.create('/recipes/lentil-soup');
    expect(TestBed.inject(Router).url).toBe('/recipes/lentil-soup');
    expect(recipePage.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Lentil soup',
    );
    expect(TestBed.inject(RecipeStore).bySlug('lentil-soup')?.own, 'own recipe').toBe(true);
  });

  it('shows the recipe page of the own recipe "Quick Dal" at /recipes/quick-dal opened directly, and the Recipes page for /recipes/no-such-dal', async () => {
    storeOwnRecipes(QUICK_DAL);
    await loadStores();
    const recipePage = await RouterTestingHarness.create('/recipes/quick-dal');
    expect(TestBed.inject(Router).url).toBe('/recipes/quick-dal');
    expect(recipePage.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      'Quick Dal',
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    await loadStores();
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
      await loadStores();
    }
  });

  it('shows the Recipes page for the page and the edit form of "Grandma\'s Soup" once it is renamed to "Red Soup", and of "Quick Dal" once it is deleted', async () => {
    storeOwnRecipes(ownRecipe("Grandma's Soup"), QUICK_DAL);
    await loadStores();
    const harness = await RouterTestingHarness.create('/recipes/grandmas-soup');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
      "Grandma's Soup",
    );
    TestBed.inject(RecipeStore).replace("Grandma's Soup", ownRecipe('Red Soup'));
    TestBed.inject(PlanStore).recipeEdited("Grandma's Soup", 'Red Soup');
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

  describe('loading (#44)', () => {
    it('opens /recipes/quick-dal of a saved own recipe directly once the recipes are loaded, and shows /recipes for /recipes/no-such-dal, replacing the URL (#44 6)', async () => {
      storeOwnRecipes(QUICK_DAL);
      let backend = new HeldBackend();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter(routes), { provide: StorageBackend, useValue: backend }],
      });
      let harness = await RouterTestingHarness.create();
      // Imported beforehand, so that only the guard can hold the navigation up
      await import('./recipes/recipe-page/recipe-page');
      const opening = harness.navigateByUrl('/recipes/quick-dal');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(TestBed.inject(Router).url, 'before the recipes are loaded').toBe('/');

      backend.release();
      await opening;
      expect(TestBed.inject(Router).url).toBe('/recipes/quick-dal');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
        'Quick Dal',
      );

      TestBed.resetTestingModule();
      backend = new HeldBackend();
      TestBed.configureTestingModule({
        providers: [provideRouter(routes), { provide: StorageBackend, useValue: backend }],
      });
      harness = await RouterTestingHarness.create('/groceries');
      const refused = harness.navigateByUrl('/recipes/no-such-dal');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(TestBed.inject(Router).url, 'before the recipes are loaded').toBe('/groceries');
      backend.release();
      await refused;
      expect(TestBed.inject(Router).url).toBe('/recipes');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Recipes');
      const location = TestBed.inject(Location);
      location.back();
      await harness.fixture.whenStable();
      expect(location.path(), 'back from /recipes').toBe('/groceries');
    });

    it('reads nothing again when the recipe pages are opened once the stores are loaded (#44 6b)', async () => {
      storeOwnRecipes(QUICK_DAL);
      await loadStores();
      const read = vi.spyOn(LocalStorageBackend.prototype, 'read');

      const harness = await RouterTestingHarness.create('/recipes/quick-dal');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
        'Quick Dal',
      );
      await harness.navigateByUrl('/recipes/quick-dal/edit');
      expect(TestBed.inject(Router).url).toBe('/recipes/quick-dal/edit');
      await harness.navigateByUrl('/recipes/spaghetti-carbonara');
      expect(TestBed.inject(Router).url).toBe('/recipes/spaghetti-carbonara');
      expect(read).not.toHaveBeenCalled();
      read.mockRestore();
    });

    describe('edge cases', () => {
      it('opens the edit form /recipes/quick-dal/edit of a saved own recipe directly once the recipes are loaded (#44 6a)', async () => {
        storeOwnRecipes(QUICK_DAL);
        const backend = new HeldBackend();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [provideRouter(routes), { provide: StorageBackend, useValue: backend }],
        });
        const harness = await RouterTestingHarness.create();
        // Imported beforehand, so that only the guard can hold the navigation up
        await import('./recipes/recipe-form/recipe-form');
        const opening = harness.navigateByUrl('/recipes/quick-dal/edit');
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(TestBed.inject(Router).url, 'before the recipes are loaded').toBe('/');

        backend.release();
        await opening;
        expect(TestBed.inject(Router).url).toBe('/recipes/quick-dal/edit');
        expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
          'Edit recipe',
        );
      });
    });
  });

  describe('sign-in (#43)', () => {
    it('shows the Plan page instead of /sign-in with a session, leaving no history entry for /sign-in (#43 7)', async () => {
      fake.load(sessionFor('ana@example.com'));
      const harness = await RouterTestingHarness.create('/groceries');
      await harness.navigateByUrl('/sign-in');
      expect(TestBed.inject(Router).url).toBe('/plan');
      expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Plan');
      const location = TestBed.inject(Location);
      expect(location.path()).toBe('/plan');
      location.back();
      await harness.fixture.whenStable();
      expect(location.path(), 'back from /plan').toBe('/groceries');
    });

    describe('edge cases', () => {
      it('shows the sign-in page at /sign-in without a session (#43 7c)', async () => {
        fake.load(null);
        const harness = await RouterTestingHarness.create('/sign-in');
        expect(TestBed.inject(Router).url).toBe('/sign-in');
        expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe(
          'Sign in',
        );
      });

      it('waits for a saved session not yet returned when /sign-in is opened directly, then shows the Plan page and never the sign-in form (#43 7b)', async () => {
        const opening = RouterTestingHarness.create('/sign-in');
        await new Promise((resolve) => setTimeout(resolve));
        expect(document.querySelector('app-sign-in-page'), 'form before the session').toBeNull();
        fake.load(sessionFor('ana@example.com'));
        const harness = await opening;
        expect(TestBed.inject(Router).url).toBe('/plan');
        expect(harness.routeNativeElement!.querySelector('h1')?.textContent?.trim()).toBe('Plan');
      });
    });
  });
});
