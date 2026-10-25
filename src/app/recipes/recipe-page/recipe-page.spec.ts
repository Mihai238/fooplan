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
    const picked = textOf(suggestion!.querySelector('span.name'));
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

  it('shows "Step 1 of N" with the first step below the ingredients when opened, with "Previous" disabled', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    expect(stepCounters()).toEqual([`Step 1 of ${steps.length}`]);
    const ingredients = page().querySelector('ul')!;
    for (const shown of [elementShowing(steps[0]), button('Previous'), button('Next')]) {
      expect(
        ingredients.compareDocumentPosition(shown),
        `"${textOf(shown)}" below the ingredients`,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);
  });

  it('shows only the current step, never the others, on every step', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    for (let current = 0; current < steps.length; current++) {
      expect(stepCounters()).toEqual([`Step ${current + 1} of ${steps.length}`]);
      const text = textOf(page());
      expect(text).toContain(steps[current]);
      steps.forEach((step, index) => {
        if (index !== current) {
          expect(text, `step ${index + 1} on step ${current + 1}`).not.toContain(step);
        }
      });
      if (current < steps.length - 1) await click(button('Next'));
    }
  });

  it('stays on step 1 when the disabled "Previous" is clicked', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    expect(button('Previous').disabled).toBe(true);
    await click(button('Previous'));
    expect(stepCounters()).toEqual([`Step 1 of ${steps.length}`]);
    expect(textOf(page())).toContain(steps[0]);
    expect(button('Previous').disabled).toBe(true);
  });

  it('starts at step 1 of the other recipe when another recipe is opened on step 3', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const carbonara = stepsOf('Spaghetti carbonara');
    await click(button('Next'));
    await click(button('Next'));
    expect(stepCounters()).toEqual([`Step 3 of ${carbonara.length}`]);

    await harness.navigateByUrl('/recipes/shepherds-pie');
    const pie = stepsOf("Shepherd's pie");
    expect(headings().map(textOf)).toEqual(["Shepherd's pie"]);
    expect(stepCounters()).toEqual([`Step 1 of ${pie.length}`]);
    expect(textOf(page())).toContain(pie[0]);
    expect(button('Previous').disabled).toBe(true);
  });

  it('shows step 2 after "Next" and step 1 again after "Previous"', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    await click(button('Next'));
    expect(stepCounters()).toEqual([`Step 2 of ${steps.length}`]);
    expect(textOf(page())).toContain(steps[1]);
    expect(textOf(page())).not.toContain(steps[0]);
    expect(button('Previous').disabled).toBe(false);

    await click(button('Previous'));
    expect(stepCounters()).toEqual([`Step 1 of ${steps.length}`]);
    expect(textOf(page())).toContain(steps[0]);
    expect(textOf(page())).not.toContain(steps[1]);
    expect(button('Previous').disabled).toBe(true);
  });

  it('moves the focus to "Next" when "Previous" becomes disabled under it', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    await click(button('Next'));
    const previous = button('Previous');
    previous.focus();
    expect(document.activeElement, 'focus before the click').toBe(previous);
    await click(previous);
    expect(stepCounters()).toEqual([`Step 1 of ${steps.length}`]);
    expect(document.activeElement).toBe(button('Next'));
  });

  it('moves the focus to "Next" when "Previous" becomes disabled under it in a recipe of two steps', async () => {
    const recipe = recipeNamed('Lentil soup');
    const original = recipe.steps;
    recipe.steps = ['Simmer the lentils for 25 minutes.', 'Serve the soup.'];
    try {
      harness = await RouterTestingHarness.create('/recipes/lentil-soup');
      await click(button('Next'));
      const previous = button('Previous');
      previous.focus();
      expect(document.activeElement, 'focus before the click').toBe(previous);
      await click(previous);
      expect(stepCounters()).toEqual(['Step 1 of 2']);
      expect(document.activeElement).toBe(button('Next'));
    } finally {
      recipe.steps = original;
    }
  });

  it('moves the focus to "Done" when it replaces the focused "Next" on the last step', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    for (let step = 1; step < steps.length - 1; step++) await click(button('Next'));
    const next = button('Next');
    next.focus();
    expect(document.activeElement, 'focus before the click').toBe(next);
    await click(next);
    expect(stepCounters()).toEqual([`Step ${steps.length} of ${steps.length}`]);
    expect(document.activeElement).toBe(doneLink());
  });

  it('shows the step text in a polite live region that stays in place across "Next"', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    const region = elementShowing(steps[0]).closest('[aria-live="polite"]');
    expect(region, 'step 1 outside a polite live region').not.toBeNull();
    await click(button('Next'));
    // A region added along with its new text isn't announced
    expect(elementShowing(steps[1]).closest('[aria-live="polite"]')).toBe(region);
  });

  it('turns "Next" into a "Done" link on the last step, linked like "Back", which returns to the Plan page it was opened from', async () => {
    harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    await stepToLast(steps);
    expect(buttonsLabelled('Next')).toEqual([]);
    const done = doneLink();
    expect(done.getAttribute('href')).toBe(backLink().getAttribute('href'));
    expect(done.getAttribute('href')).toBe('/plan');
    await click(done);
    expect(router().url).toBe('/plan');
    expect(textOf(page().querySelector('h1'))).toBe('Plan');
  });

  it('shows no "Done" before the last step', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    for (let current = 1; current < steps.length; current++) {
      expect(controlsLabelled('Done'), `"Done" on step ${current}`).toEqual([]);
      await click(button('Next'));
    }
    expect(stepCounters()).toEqual([`Step ${steps.length} of ${steps.length}`]);
    expect(controlsLabelled('Done')).toHaveLength(1);
  });

  it('shows "Step N of N" with the last step and no "Next" on the last step', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    await stepToLast(steps);
    expect(stepCounters()).toEqual([`Step ${steps.length} of ${steps.length}`]);
    expect(textOf(page())).toContain(steps.at(-1));
    expect(buttonsLabelled('Next')).toEqual([]);
    expect(button('Previous').disabled).toBe(false);
    doneLink();
  });

  it('reaches "Done" after two clicks on "Next" in a recipe of three steps', async () => {
    const recipe = recipeNamed('Lentil soup');
    const original = recipe.steps;
    recipe.steps = ['Rinse the lentils.', 'Simmer them for 25 minutes.', 'Serve the soup.'];
    try {
      harness = await RouterTestingHarness.create('/recipes/lentil-soup');
      expect(stepCounters()).toEqual(['Step 1 of 3']);
      await click(button('Next'));
      expect(stepCounters()).toEqual(['Step 2 of 3']);
      expect(controlsLabelled('Done')).toEqual([]);
      await click(button('Next'));
      expect(stepCounters()).toEqual(['Step 3 of 3']);
      expect(textOf(page())).toContain('Serve the soup.');
      expect(buttonsLabelled('Next')).toEqual([]);
      doneLink();
    } finally {
      recipe.steps = original;
    }
  });

  it('turns "Done" back into "Next" when "Previous" is clicked on the last step', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    const steps = stepsOf('Spaghetti carbonara');
    await stepToLast(steps);
    doneLink();
    await click(button('Previous'));
    expect(stepCounters()).toEqual([`Step ${steps.length - 1} of ${steps.length}`]);
    expect(textOf(page())).toContain(steps.at(-2));
    expect(controlsLabelled('Done')).toEqual([]);
    expect(button('Next').disabled).toBe(false);
  });

  it('links "Done" to the Recipes page, like "Back", when opened directly', async () => {
    harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
    await stepToLast(stepsOf('Spaghetti carbonara'));
    const done = doneLink();
    expect(done.getAttribute('href')).toBe(backLink().getAttribute('href'));
    expect(done.getAttribute('href')).toBe('/recipes');
    await click(done);
    expect(router().url).toBe('/recipes');
    expect(page().querySelectorAll('article').length).toBe(RECIPES.length);
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

  async function stepToLast(steps: string[]) {
    for (let step = 1; step < steps.length; step++) await click(button('Next'));
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

  function doneLink(): HTMLAnchorElement {
    const controls = controlsLabelled('Done');
    expect(controls, '"Done" links and buttons').toHaveLength(1);
    expect(controls[0].tagName, '"Done" element').toBe('A');
    expect(controls[0].hasAttribute('href'), '"Done" without href').toBe(true);
    return controls[0] as HTMLAnchorElement;
  }

  function controlsLabelled(label: string): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>('a, button')).filter(
      (control) => textOf(control) === label,
    );
  }

  function button(label: string): HTMLButtonElement {
    const buttons = buttonsLabelled(label);
    expect(buttons, `"${label}" buttons`).toHaveLength(1);
    return buttons[0];
  }

  function buttonsLabelled(label: string): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll('button')).filter(
      (button) => textOf(button) === label,
    );
  }

  function stepsOf(name: string): string[] {
    const steps = recipeNamed(name).steps;
    expect(steps?.length ?? 0, `steps of "${name}"`).toBeGreaterThanOrEqual(3);
    return steps;
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

  function stepCounters(): string[] {
    return textOf(page()).match(/Step \d+ of \d+/g) ?? [];
  }

  // The innermost element, so the live region around the step is found from it
  function elementShowing(text: string): HTMLElement {
    const shown = Array.from(page().querySelectorAll<HTMLElement>('*')).filter((element) =>
      textOf(element).includes(text),
    );
    expect(shown, `"${text}" not shown`).not.toEqual([]);
    return shown.at(-1)!;
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
