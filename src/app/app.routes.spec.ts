import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { RECIPES } from './recipes/recipes';
import { QUICK_DAL, storeOwnRecipes } from './recipes/testing';

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
