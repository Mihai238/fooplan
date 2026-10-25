import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { PlanStore, RANDOM, TODAY } from '../../plan/plan-store';
import { seededRandom } from '../../plan/testing';
import { displayAmount } from '../amount';
import { Recipe } from '../recipe';
import { RECIPES } from '../recipes';

// The recipe page is reached through the app's routes, as its recipe comes from the URL and its
// "Back" link from the navigation before it
describe('RecipePage', () => {
  let harness: RouterTestingHarness;

  beforeEach(() => {
    localStorage.clear();
    configure();
  });

  it("shows the recipe's name as the heading, its servings and every ingredient with its displayed amount, unit and name", async () => {
    for (const [url, name] of [
      ['/recipes/spaghetti-carbonara', 'Spaghetti carbonara'],
      ['/recipes/shepherds-pie', "Shepherd's pie"],
    ]) {
      harness = await RouterTestingHarness.create(url);
      const recipe = recipeNamed(name);
      expect(router().url, `${name}: URL`).toBe(url);
      expect(headings().map(textOf), `${name}: heading`).toEqual([name]);
      expect(textOf(page()), `${name}: servings`).toContain(`${recipe.servings} servings`);
      expect(ingredientLines(), `${name}: ingredients`).toEqual(linesOf(recipe));
      TestBed.resetTestingModule();
      configure();
    }
  });

  it('shows the 15 ml vegetable oil of "Teriyaki chicken with rice" as "1 tbsp vegetable oil" and the 900 ml of "Fish and chips" in ml', async () => {
    harness = await RouterTestingHarness.create('/recipes/teriyaki-chicken-with-rice');
    expect(headings().map(textOf)).toEqual(['Teriyaki chicken with rice']);
    expect(ingredientLines()).toContain('1 tbsp vegetable oil');
    expect(ingredientLines()).not.toContain('15 ml vegetable oil');
    await harness.navigateByUrl('/recipes/fish-and-chips');
    expect(headings().map(textOf)).toEqual(['Fish and chips']);
    expect(ingredientLines()).toContain('900 ml vegetable oil');
  });

  it('links "Back" to the Plan page when opened from it, which shows the plan unchanged', async () => {
    harness = await RouterTestingHarness.create('/plan');
    const suggestion = page().querySelector<HTMLButtonElement>('button.suggestion');
    expect(suggestion, 'no suggestion on the Plan page').not.toBeNull();
    const picked = textOf(suggestion);
    suggestion!.click();
    await harness.fixture.whenStable();
    const before = TestBed.inject(PlanStore).plan();
    const saved = localStorage.getItem('fooplan.plan');

    await harness.navigateByUrl('/recipes/shepherds-pie');
    expect(headings().map(textOf), 'recipe page not shown').toEqual(["Shepherd's pie"]);
    const back = backLink();
    expect(back.getAttribute('href')).toBe('/plan');
    await click(back);
    expect(router().url).toBe('/plan');
    expect(textOf(page().querySelector('h1'))).toBe('Plan');
    expect(TestBed.inject(PlanStore).plan()).toBe(before);
    expect(localStorage.getItem('fooplan.plan')).toBe(saved);
    expect(Array.from(page().querySelectorAll('p.recipe')).map(textOf)).toEqual([picked]);
  });

  it('links "Back" to the Recipes page when opened directly', async () => {
    harness = await RouterTestingHarness.create('/recipes/shepherds-pie');
    expect(headings().map(textOf), 'recipe page not shown').toEqual(["Shepherd's pie"]);
    const back = backLink();
    expect(back.getAttribute('href')).toBe('/recipes');
    await click(back);
    expect(router().url).toBe('/recipes');
    expect(page().querySelectorAll('article').length).toBe(RECIPES.length);
  });

  it('links "Back" to the Recipes page when opened from it after the Plan page', async () => {
    harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/recipes');
    await harness.navigateByUrl('/recipes/nicoise-salad');
    expect(headings().map(textOf), 'recipe page not shown').toEqual(['Niçoise salad']);
    expect(backLink().getAttribute('href')).toBe('/recipes');
    await click(backLink());
    expect(router().url).toBe('/recipes');
  });

  it('shows the other recipe and links "Back" to the first when opened from another recipe page', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    await harness.navigateByUrl('/recipes/shepherds-pie');
    expect(headings().map(textOf)).toEqual(["Shepherd's pie"]);
    expect(ingredientLines()).toEqual(linesOf(recipeNamed("Shepherd's pie")));
    expect(backLink().getAttribute('href')).toBe('/recipes/spaghetti-carbonara');
    await click(backLink());
    expect(router().url).toBe('/recipes/spaghetti-carbonara');
    expect(headings().map(textOf)).toEqual(['Spaghetti carbonara']);
    expect(ingredientLines()).toEqual(linesOf(recipeNamed('Spaghetti carbonara')));
  });

  it('links "Back" to the Recipes page after a reload of a recipe page opened from the Plan page, keeping the plan', async () => {
    harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/recipes/shepherds-pie');
    expect(backLink().getAttribute('href'), 'before the reload').toBe('/plan');
    const before = TestBed.inject(PlanStore).plan();

    // A fresh app on the same URL and localStorage, as a reload makes
    TestBed.resetTestingModule();
    configure();
    harness = await RouterTestingHarness.create('/recipes/shepherds-pie');
    expect(headings().map(textOf)).toEqual(["Shepherd's pie"]);
    expect(backLink().getAttribute('href')).toBe('/recipes');
    expect(TestBed.inject(PlanStore).plan()).toEqual(before);
  });

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
  }

  async function click(target: HTMLElement) {
    target.click();
    await harness.fixture.whenStable();
  }

  function backLink(): HTMLAnchorElement {
    const links = Array.from(page().querySelectorAll<HTMLAnchorElement>('a')).filter(
      (link) => textOf(link) === 'Back',
    );
    expect(links, '"Back" links').toHaveLength(1);
    expect(links[0].hasAttribute('href'), '"Back" without href').toBe(true);
    return links[0];
  }

  function recipeNamed(name: string): Recipe {
    const recipe = RECIPES.find((candidate) => candidate.name === name);
    expect(recipe, `no recipe "${name}"`).toBeDefined();
    return recipe!;
  }

  function linesOf(recipe: Recipe): string[] {
    return recipe.ingredients.map((ingredient) => {
      const shown = displayAmount(ingredient);
      return `${shown.amount} ${shown.unit} ${ingredient.name}`;
    });
  }

  function ingredientLines(): string[] {
    return Array.from(page().querySelectorAll('li')).map(textOf);
  }

  function headings(): HTMLElement[] {
    return Array.from(page().querySelectorAll('h1'));
  }

  function page(): HTMLElement {
    expect(harness.routeNativeElement, 'nothing routed').not.toBeNull();
    return harness.routeNativeElement!;
  }

  function router(): Router {
    return TestBed.inject(Router);
  }

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});
