import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { PlanStore, RANDOM, TODAY } from '../../plan/plan-store';
import { Plan } from '../../plan/plan';
import {
  covered,
  day,
  leaveSuggested,
  LUNCH,
  open,
  picked,
  planOf,
  seededRandom,
} from '../../plan/testing';
import { installDialog, modalDialogs } from '../../testing';
import { displayAmount } from '../amount';
import { Recipe } from '../recipe';
import { RecipeStore } from '../recipe-store';
import { RECIPES } from '../recipes';
import { ownRecipe, QUICK_DAL, RECIPES_KEY, STEPS_VIEW_KEY, storeOwnRecipes } from '../testing';

const LIMIT_NOTE = 'At least 15 recipes stay suggested, so no more can be removed.';
const PLAN_NOTE = 'This recipe is in your plan. Undo its pick or start a new plan to delete it.';
const ACCEPTED_NOTE = 'This recipe is in your accepted plan. Start a new plan to delete it.';
const DELETE_LIMIT_NOTE = "At least 15 recipes stay suggested, so this recipe can't be deleted.";
const DELETE_TEXT =
  "It disappears from the Recipes page and won't be suggested again. This can't be undone.";

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
      ['/recipes/nicoise-salad', 'Niçoise salad'],
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

  it('shows the 15 ml vegetable oil of "Teriyaki chicken with rice" as "1 tbsp vegetable oil" and the 700 ml milk of "Mac and cheese" in ml', async () => {
    harness = await RouterTestingHarness.create('/recipes/teriyaki-chicken-with-rice');
    expect(headings().map(textOf)).toEqual(['Teriyaki chicken with rice']);
    expect(ingredientLines()).toContain('1 tbsp vegetable oil');
    expect(ingredientLines()).not.toContain('15 ml vegetable oil');
    await harness.navigateByUrl('/recipes/mac-and-cheese');
    expect(headings().map(textOf)).toEqual(['Mac and cheese']);
    expect(ingredientLines()).toContain('700 ml milk');
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

    await harness.navigateByUrl('/recipes/nicoise-salad');
    expect(headings().map(textOf), 'recipe page not shown').toEqual(['Niçoise salad']);
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
    harness = await RouterTestingHarness.create('/recipes/nicoise-salad');
    expect(headings().map(textOf), 'recipe page not shown').toEqual(['Niçoise salad']);
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
    await harness.navigateByUrl('/recipes/nicoise-salad');
    expect(headings().map(textOf)).toEqual(['Niçoise salad']);
    expect(ingredientLines()).toEqual(linesOf(recipeNamed('Niçoise salad')));
    expect(backLink().getAttribute('href')).toBe('/recipes/spaghetti-carbonara');
    await click(backLink());
    expect(router().url).toBe('/recipes/spaghetti-carbonara');
    expect(headings().map(textOf)).toEqual(['Spaghetti carbonara']);
    expect(ingredientLines()).toEqual(linesOf(recipeNamed('Spaghetti carbonara')));
  });

  it('links "Back" to the Recipes page after a reload of a recipe page opened from the Plan page, keeping the plan', async () => {
    harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/recipes/nicoise-salad');
    expect(backLink().getAttribute('href'), 'before the reload').toBe('/plan');
    const before = TestBed.inject(PlanStore).plan();

    // A fresh app on the same URL and localStorage, as a reload makes
    TestBed.resetTestingModule();
    configure();
    harness = await RouterTestingHarness.create('/recipes/nicoise-salad');
    expect(headings().map(textOf)).toEqual(['Niçoise salad']);
    expect(backLink().getAttribute('href')).toBe('/recipes');
    expect(TestBed.inject(PlanStore).plan()).toEqual(before);
  });

  it('links "Back", and "Done" on the last step, to the Recipes page rather than the form when opened from /add-recipe, for an own recipe and a built-in one', async () => {
    const { name, servings, ingredients } = QUICK_DAL;
    localStorage.setItem(RECIPES_KEY, JSON.stringify([{ name, servings, ingredients }]));
    harness = await RouterTestingHarness.create('/add-recipe');
    await harness.navigateByUrl('/recipes/quick-dal');
    expect(headings().map(textOf), 'Quick Dal not shown').toEqual(['Quick Dal']);
    expect(backLink().getAttribute('href'), '"Back" of Quick Dal').toBe('/recipes');
    await click(backLink());
    expect(router().url).toBe('/recipes');
    expect(textOf(page().querySelector('h1'))).toBe('Recipes');

    await harness.navigateByUrl('/add-recipe');
    await harness.navigateByUrl('/recipes/spaghetti-carbonara');
    expect(headings().map(textOf), 'Spaghetti carbonara not shown').toEqual([
      'Spaghetti carbonara',
    ]);
    expect(backLink().getAttribute('href'), '"Back" of Spaghetti carbonara').toBe('/recipes');
    await stepToLast(stepsOf('Spaghetti carbonara'));
    const done = doneLink();
    expect(done.getAttribute('href')).toBe('/recipes');
    await click(done);
    expect(router().url).toBe('/recipes');
    expect(textOf(page().querySelector('h1'))).toBe('Recipes');
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

    await harness.navigateByUrl('/recipes/nicoise-salad');
    const salad = stepsOf('Niçoise salad');
    expect(headings().map(textOf)).toEqual(['Niçoise salad']);
    expect(stepCounters()).toEqual([`Step 1 of ${salad.length}`]);
    expect(textOf(page())).toContain(salad[0]);
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
    const recipe = recipeNamed('Shakshuka with bread');
    const original = recipe.steps;
    recipe.steps = ['Simmer the sauce for 10 minutes.', 'Serve the shakshuka.'];
    try {
      harness = await RouterTestingHarness.create('/recipes/shakshuka-with-bread');
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
    const recipe = recipeNamed('Shakshuka with bread');
    const original = recipe.steps;
    recipe.steps = ['Chop the onion.', 'Simmer the sauce for 10 minutes.', 'Serve the shakshuka.'];
    try {
      harness = await RouterTestingHarness.create('/recipes/shakshuka-with-bread');
      expect(stepCounters()).toEqual(['Step 1 of 3']);
      await click(button('Next'));
      expect(stepCounters()).toEqual(['Step 2 of 3']);
      expect(controlsLabelled('Done')).toEqual([]);
      await click(button('Next'));
      expect(stepCounters()).toEqual(['Step 3 of 3']);
      expect(textOf(page())).toContain('Serve the shakshuka.');
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

  describe('"Step by step" and "All steps"', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('starts div.steps with a group "Show steps" of "Step by step", pressed, and "All steps", not pressed, followed by "Step 1 of N", step 1, "Previous" and "Next", when opened with no saved view', async () => {
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      const steps = stepsOf('Spaghetti carbonara');
      const block = page().querySelector('div.steps');
      expect(block, 'no div.steps').not.toBeNull();
      const group = viewGroup();
      expect(block!.firstElementChild, 'first in div.steps').toBe(group);
      expect(group.matches('div.view'), 'group is a div.view').toBe(true);
      expect(Array.from(group.children).map((child) => child.tagName)).toEqual([
        'BUTTON',
        'BUTTON',
      ]);
      expect(pressedStates()).toEqual([
        ['Step by step', 'true'],
        ['All steps', 'false'],
      ]);
      expect(group.closest('[aria-live]'), 'group inside the live region').toBeNull();
      expectStepView(1, steps);
      for (const shown of [
        page().querySelector<HTMLElement>('p.counter')!,
        elementShowing(steps[0]),
        button('Previous'),
        button('Next'),
      ]) {
        expect(group.compareDocumentPosition(shown), `"${textOf(shown)}" below the switch`).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }
      expect(button('Previous').disabled).toBe(true);
    });

    it('shows the N steps in order with exactly their texts in an ol.all below the switch, with "All steps" pressed, no counter, p.step, "Previous", "Next", "Done" or live region, "Back" still shown and all saved in fooplan.stepsView, on "All steps"', async () => {
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      const steps = stepsOf('Spaghetti carbonara');
      await click(viewButton('All steps'));

      expectAllStepsView(steps);
      const list = page().querySelector<HTMLElement>('div.steps ol.all');
      expect(list, 'no ol.all in div.steps').not.toBeNull();
      expect(viewGroup().compareDocumentPosition(list!), 'ol.all below the switch').toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      backLink();
      expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('all');
    });

    it('shows the step of step 3 again, "Step 3 of N", with steps saved in fooplan.stepsView, on "All steps" and then "Step by step"', async () => {
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      const steps = stepsOf('Spaghetti carbonara');
      await click(button('Next'));
      await click(button('Next'));
      expect(stepCounters(), 'before switching').toEqual([`Step 3 of ${steps.length}`]);

      await click(viewButton('All steps'));
      expectAllStepsView(steps, 'after "All steps"');
      await click(viewButton('Step by step'));
      expectStepView(3, steps);
      expect(button('Previous').disabled).toBe(false);
      button('Next');
      expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('steps');
    });

    it('changes nothing on a click on the pressed button: "Step by step" on step 3 keeps step 3 and fooplan.stepsView absent, and "All steps" in its view keeps the list, calls no setItem and keeps step 3', async () => {
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      const steps = stepsOf('Spaghetti carbonara');
      await click(button('Next'));
      await click(button('Next'));

      await click(viewButton('Step by step'));
      expectStepView(3, steps, '"Step by step" pressed');
      expect(localStorage.getItem(STEPS_VIEW_KEY), '"Step by step" pressed').toBeNull();

      await click(viewButton('All steps'));
      expectAllStepsView(steps, 'switched to "All steps"');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      await click(viewButton('All steps'));
      expectAllStepsView(steps, '"All steps" pressed');
      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('all');
      await click(viewButton('Step by step'));
      expectStepView(3, steps, 'switched back');
    });

    it('opens and reloads a recipe page in the "All steps" view with all saved in fooplan.stepsView, and in the step view with nothing saved', async () => {
      const steps = stepsOf('Spaghetti carbonara');
      localStorage.setItem(STEPS_VIEW_KEY, 'all');
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      expectAllStepsView(steps, 'opened');

      // A fresh app on the same URL and localStorage, as a reload makes
      TestBed.resetTestingModule();
      configure();
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      expectAllStepsView(steps, 'reloaded');

      TestBed.resetTestingModule();
      localStorage.clear();
      configure();
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      expectStepView(1, steps, 'nothing saved');
    });

    it('shows "Niçoise salad", opened after "Spaghetti carbonara" was switched to "All steps" on step 3, in the "All steps" view, and at "Step 1 of 7" with its step 1 on "Step by step"', async () => {
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      await click(button('Next'));
      await click(button('Next'));
      await click(viewButton('All steps'));
      expectAllStepsView(stepsOf('Spaghetti carbonara'), 'Spaghetti carbonara');

      await harness.navigateByUrl('/recipes/nicoise-salad');
      const salad = stepsOf('Niçoise salad');
      expect(headings().map(textOf)).toEqual(['Niçoise salad']);
      expectAllStepsView(salad, 'Niçoise salad opened');
      await click(viewButton('Step by step'));
      expect(stepCounters()).toEqual(['Step 1 of 7']);
      expectStepView(1, salad, '"Step by step" on Niçoise salad');
    });

    it('keeps the focus on "All steps" and on "Step by step" when the focused button is clicked', async () => {
      harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
      const steps = stepsOf('Spaghetti carbonara');
      const all = viewButton('All steps');
      all.focus();
      expect(document.activeElement, 'focus before "All steps"').toBe(all);
      await click(all);
      expectAllStepsView(steps);
      expect(document.activeElement, 'focus after "All steps"').toBe(all);

      const stepByStep = viewButton('Step by step');
      stepByStep.focus();
      expect(document.activeElement, 'focus before "Step by step"').toBe(stepByStep);
      await click(stepByStep);
      expectStepView(1, steps);
      expect(document.activeElement, 'focus after "Step by step"').toBe(stepByStep);
    });

    it('shows no group "Show steps" on the page of the own recipe "Quick Dal"', async () => {
      storeOwnRecipes(QUICK_DAL);
      harness = await RouterTestingHarness.create('/recipes/quick-dal');
      expect(headings().map(textOf), 'Quick Dal not shown').toEqual(['Quick Dal']);
      expect(viewGroups()).toEqual([]);
      expect(buttonsLabelled('Step by step')).toEqual([]);
      expect(buttonsLabelled('All steps')).toEqual([]);
      expect(page().querySelector('ol.all')).toBeNull();
    });

    describe('edge cases', () => {
      it('lists every step from step 1, not from the current one, on "All steps" on step 3', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        await click(button('Next'));
        await click(button('Next'));
        await click(viewButton('All steps'));
        expect(allSteps()).toEqual(steps);
        expect(stepCounters()).toEqual([]);
      });

      it('shows no "Done" and no "Previous", and every step, on "All steps" on the last step', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        await stepToLast(steps);
        doneLink();
        await click(viewButton('All steps'));
        expect(controlsLabelled('Done')).toEqual([]);
        expectAllStepsView(steps);
      });

      it('keeps the ingredient lines exactly the ingredients, apart from the steps listed in ol.all, in the "All steps" view', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const recipe = recipeNamed('Spaghetti carbonara');
        await click(viewButton('All steps'));
        expect(allSteps(), 'steps not listed').toEqual(stepsOf('Spaghetti carbonara'));
        expect(ingredientLines()).toEqual(linesOf(recipe));
        expect(page().querySelector('ul ol.all, ol.all ul')).toBeNull();
      });

      it('shows "Step N of N" with the last step and "Done" again on "All steps" and then "Step by step" on the last step', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        await stepToLast(steps);
        await click(viewButton('All steps'));
        await click(viewButton('Step by step'));
        expectStepView(steps.length, steps);
        doneLink();
        expect(buttonsLabelled('Next')).toEqual([]);
      });

      it('goes on to step 4 on "Next" after switching to "All steps" and back on step 3', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        await click(button('Next'));
        await click(button('Next'));
        await click(viewButton('All steps'));
        await click(viewButton('Step by step'));
        await click(button('Next'));
        expectStepView(4, steps);
      });

      it('calls no setItem and keeps step 3 on a click on the pressed "Step by step" with steps saved in fooplan.stepsView', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        await click(button('Next'));
        await click(button('Next'));
        await click(viewButton('All steps'));
        await click(viewButton('Step by step'));
        expect(localStorage.getItem(STEPS_VIEW_KEY), 'steps not saved').toBe('steps');

        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        await click(viewButton('Step by step'));
        expectStepView(3, steps);
        expect(setItem).not.toHaveBeenCalled();
      });

      it('keeps "Step N of N" and "Done" on a click on the pressed "Step by step" on the last step', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        await stepToLast(steps);
        await click(viewButton('Step by step'));
        expectStepView(steps.length, steps);
        doneLink();
        expect(localStorage.getItem(STEPS_VIEW_KEY)).toBeNull();
      });

      it('shows "Step 1 of N" with step 1 on "Step by step" on a page opened in the "All steps" view', async () => {
        localStorage.setItem(STEPS_VIEW_KEY, 'all');
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        expectAllStepsView(steps, 'opened');
        await click(viewButton('Step by step'));
        expectStepView(1, steps);
        expect(button('Previous').disabled).toBe(true);
      });

      it('opens "Spaghetti carbonara" in the step view at step 1, with steps saved, after "Step by step" was chosen on "Niçoise salad"', async () => {
        localStorage.setItem(STEPS_VIEW_KEY, 'all');
        harness = await RouterTestingHarness.create('/recipes/nicoise-salad');
        await click(viewButton('Step by step'));
        expectStepView(1, stepsOf('Niçoise salad'), 'Niçoise salad');

        await harness.navigateByUrl('/recipes/spaghetti-carbonara');
        expect(headings().map(textOf)).toEqual(['Spaghetti carbonara']);
        expectStepView(1, stepsOf('Spaghetti carbonara'));
        expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('steps');
      });

      it('opens "Niçoise salad" in the "All steps" view when reached through the Plan page after "All steps" was chosen on "Spaghetti carbonara"', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        await click(viewButton('All steps'));
        await harness.navigateByUrl('/plan');
        expect(textOf(page().querySelector('h1')), 'Plan page not shown').toBe('Plan');

        await harness.navigateByUrl('/recipes/nicoise-salad');
        expect(headings().map(textOf)).toEqual(['Niçoise salad']);
        expectAllStepsView(stepsOf('Niçoise salad'));
      });

      it('keeps the group "Show steps" and both its buttons as the same elements across "All steps" and "Step by step"', async () => {
        harness = await RouterTestingHarness.create('/recipes/spaghetti-carbonara');
        const steps = stepsOf('Spaghetti carbonara');
        const group = viewGroup();
        const [stepByStep, all] = [viewButton('Step by step'), viewButton('All steps')];

        await click(all);
        expectAllStepsView(steps);
        expect(viewGroup(), 'group after "All steps"').toBe(group);
        expect(viewButton('Step by step'), '"Step by step" after "All steps"').toBe(stepByStep);
        expect(viewButton('All steps'), '"All steps" after "All steps"').toBe(all);

        await click(stepByStep);
        expectStepView(1, steps);
        expect(viewGroup(), 'group after "Step by step"').toBe(group);
        expect(viewButton('Step by step'), '"Step by step" after "Step by step"').toBe(stepByStep);
        expect(viewButton('All steps'), '"All steps" after "Step by step"').toBe(all);
      });

      it('shows no group "Show steps" and no ol.all on the page of the own recipe "Quick Dal" with all saved, keeps all saved and opens "Spaghetti carbonara" afterwards in the "All steps" view', async () => {
        storeOwnRecipes(QUICK_DAL);
        localStorage.setItem(STEPS_VIEW_KEY, 'all');
        harness = await RouterTestingHarness.create('/recipes/quick-dal');
        expect(headings().map(textOf), 'Quick Dal not shown').toEqual(['Quick Dal']);
        expect(viewGroups()).toEqual([]);
        expect(page().querySelector('ol.all')).toBeNull();
        expect(page().querySelectorAll('li')).toHaveLength(QUICK_DAL.ingredients.length);
        expect(localStorage.getItem(STEPS_VIEW_KEY)).toBe('all');

        await harness.navigateByUrl('/recipes/spaghetti-carbonara');
        expect(headings().map(textOf)).toEqual(['Spaghetti carbonara']);
        expectAllStepsView(stepsOf('Spaghetti carbonara'));
      });
    });

    function expectStepView(current: number, steps: string[], context = 'step view') {
      expect(pressedStates(), context).toEqual([
        ['Step by step', 'true'],
        ['All steps', 'false'],
      ]);
      expect(stepCounters(), context).toEqual([`Step ${current} of ${steps.length}`]);
      expect(textOf(page().querySelector('p.step')), context).toBe(steps[current - 1]);
      expect(page().querySelector('ol.all'), `${context}: ol.all`).toBeNull();
    }

    function expectAllStepsView(steps: string[], context = '"All steps" view') {
      expect(pressedStates(), context).toEqual([
        ['Step by step', 'false'],
        ['All steps', 'true'],
      ]);
      expect(allSteps(), context).toEqual(steps);
      expect(page().querySelector('p.counter'), `${context}: p.counter`).toBeNull();
      expect(stepCounters(), context).toEqual([]);
      expect(page().querySelector('p.step'), `${context}: p.step`).toBeNull();
      expect(page().querySelector('[aria-live]'), `${context}: live region`).toBeNull();
      for (const label of ['Previous', 'Next', 'Done']) {
        expect(controlsLabelled(label), `${context}: "${label}"`).toEqual([]);
      }
    }

    function pressedStates(): [string, string | null][] {
      return Array.from(viewGroup().querySelectorAll('button')).map((viewButton) => [
        textOf(viewButton),
        viewButton.getAttribute('aria-pressed'),
      ]);
    }

    function viewButton(label: string): HTMLButtonElement {
      const found = Array.from(viewGroup().querySelectorAll('button')).filter(
        (candidate) => textOf(candidate) === label,
      );
      expect(found, `"${label}" buttons in the group "Show steps"`).toHaveLength(1);
      return found[0];
    }

    function viewGroup(): HTMLElement {
      const groups = viewGroups();
      expect(groups, 'groups "Show steps"').toHaveLength(1);
      return groups[0];
    }

    function viewGroups(): HTMLElement[] {
      return Array.from(page().querySelectorAll<HTMLElement>('[role="group"]')).filter(
        (group) => group.getAttribute('aria-label') === 'Show steps',
      );
    }

    function allSteps(): string[] {
      return Array.from(page().querySelectorAll('ol.all > li')).map(textOf);
    }
  });

  describe('own recipes', () => {
    it('shows a stored own recipe saved with an extra `steps` key as "Back", its name, servings, "Your recipe" in a p.own, its p.suggest and its ingredients, with no steps, "Previous", "Next" or "Done"', async () => {
      const { name, servings, ingredients } = QUICK_DAL;
      localStorage.setItem(
        RECIPES_KEY,
        JSON.stringify([{ name, servings, ingredients, steps: ['Cook the dal.', 'Serve it.'] }]),
      );
      harness = await RouterTestingHarness.create('/recipes/quick-dal');

      expect(router().url).toBe('/recipes/quick-dal');
      expect(backLink().getAttribute('href')).toBe('/recipes');
      expect(headings().map(textOf)).toEqual(['Quick Dal']);
      const servingsLine = page().querySelector('p.servings');
      expect(textOf(servingsLine)).toBe('4 servings');
      const own = servingsLine?.nextElementSibling ?? null;
      expect(own?.matches('p.own'), 'p.own after the servings').toBe(true);
      expect(textOf(own)).toBe('Your recipe');
      expect(own?.nextElementSibling?.matches('p.suggest'), 'p.suggest after p.own').toBe(true);
      expect(ingredientLines()).toEqual(linesOf(QUICK_DAL));
      expect(page().querySelector('.steps'), 'steps block').toBeNull();
      expect(stepCounters()).toEqual([]);
      expect(textOf(page())).not.toContain('Cook the dal.');
      expect(buttonsLabelled('Previous')).toEqual([]);
      expect(buttonsLabelled('Next')).toEqual([]);
      expect(controlsLabelled('Done')).toEqual([]);
    });

    it('shows "1 serving" on the page of an own recipe for 1 and "4 servings" on one for 4', async () => {
      const stored = [ownRecipe('Single Soup', 1), ownRecipe('Family Stew', 4)].map(
        ({ name, servings, ingredients }) => ({ name, servings, ingredients }),
      );
      localStorage.setItem(RECIPES_KEY, JSON.stringify(stored));

      harness = await RouterTestingHarness.create('/recipes/single-soup');
      expect(headings().map(textOf), 'Single Soup not shown').toEqual(['Single Soup']);
      expect(textOf(page().querySelector('p.servings'))).toBe('1 serving');
      await harness.navigateByUrl('/recipes/family-stew');
      expect(headings().map(textOf), 'Family Stew not shown').toEqual(['Family Stew']);
      expect(textOf(page().querySelector('p.servings'))).toBe('4 servings');
    });
  });

  describe('"Don\'t suggest" and "Suggest again"', () => {
    it('shows a "Don\'t suggest" button in a p.suggest between the servings and the ingredients, which turns into "Not suggested" and a focused "Suggest again", and back into a focused "Don\'t suggest", on clicks, removing the recipe at once without a dialog', async () => {
      harness = await RouterTestingHarness.create('/recipes/shakshuka-with-bread');
      const suggest = page().querySelector('p.servings')?.nextElementSibling;
      expect(suggest?.matches('p.suggest'), 'p.suggest after the servings').toBe(true);
      expect(suggest!.nextElementSibling?.tagName, 'after p.suggest').toBe('UL');
      expect(Array.from(suggest!.querySelectorAll('button')).map(textOf)).toEqual([
        "Don't suggest",
      ]);

      const dontSuggest = button("Don't suggest");
      dontSuggest.focus();
      await click(dontSuggest);
      expect(
        document.querySelector('dialog[open]'),
        'dialog open after "Don\'t suggest"',
      ).toBeNull();
      expect(TestBed.inject(PlanStore).removed()).toEqual(['Shakshuka with bread']);
      expect(
        Array.from(page().querySelector('p.suggest')!.children).map((child) => [
          child.tagName,
          textOf(child),
        ]),
      ).toEqual([
        ['SPAN', 'Not suggested'],
        ['BUTTON', 'Suggest again'],
      ]);
      expect(document.activeElement, 'focus after "Don\'t suggest"').toBe(button('Suggest again'));

      await click(button('Suggest again'));
      expect(document.activeElement, 'focus after "Suggest again"').toBe(button("Don't suggest"));
    });

    it('shows that at least 15 recipes stay suggested in a p.note instead of "Don\'t suggest" on the page of a suggested recipe while exactly 15 are suggested', async () => {
      leaveSuggested(TestBed.inject(PlanStore), 15, 'Shakshuka with bread');
      harness = await RouterTestingHarness.create('/recipes/shakshuka-with-bread');

      const notes = Array.from(page().querySelectorAll('p.note'));
      expect(notes.map(textOf)).toEqual([LIMIT_NOTE]);
      expect(page().querySelector('p.servings')?.nextElementSibling, 'after the servings').toBe(
        notes[0],
      );
      expect(page().querySelector('p.suggest')).toBeNull();
      expect(buttonsLabelled("Don't suggest")).toEqual([]);
    });

    it('shows "Not suggested" and "Suggest again", without the note, on the page of a removed recipe while exactly 15 are suggested', async () => {
      leaveSuggested(TestBed.inject(PlanStore), 15);
      expect(TestBed.inject(PlanStore).removed(), 'Penne arrabbiata not removed').toContain(
        'Penne arrabbiata',
      );
      harness = await RouterTestingHarness.create('/recipes/penne-arrabbiata');

      const suggest = page().querySelector('p.suggest');
      expect(suggest, 'no p.suggest').not.toBeNull();
      expect(Array.from(suggest!.children).map(textOf)).toEqual(['Not suggested', 'Suggest again']);
      expect(textOf(page())).not.toContain(LIMIT_NOTE);
    });
  });

  describe('"Edit" and "Delete"', () => {
    // jsdom lays out nothing, so the dialog's box is stubbed, and these points are placed around it
    const BOX = { left: 100, top: 100, right: 400, bottom: 300 } as DOMRect;
    const OUTSIDE = { clientX: 50, clientY: 50 };
    const INSIDE = { clientX: 250, clientY: 200 };
    let uninstallDialog: () => void;

    beforeAll(() => {
      uninstallDialog = installDialog();
    });

    afterAll(() => {
      uninstallDialog();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows a div.manage right after the ingredient list of the own recipe "Quick Dal" with a link "Edit" to /recipes/quick-dal/edit and then a button "Delete", and no div.manage on a built-in recipe\'s page', async () => {
      await openQuickDal();
      const manage = page().querySelector('article div.manage');
      expect(manage, 'no div.manage').not.toBeNull();
      expect(page().querySelector('article ul')?.nextElementSibling, 'after the ingredients').toBe(
        manage,
      );
      expect(
        Array.from(manage!.children).map((child) => [
          child.tagName,
          textOf(child),
          child.getAttribute('href') ?? child.getAttribute('type'),
        ]),
      ).toEqual([
        ['A', 'Edit', '/recipes/quick-dal/edit'],
        ['BUTTON', 'Delete', 'button'],
      ]);

      await harness.navigateByUrl('/recipes/spaghetti-carbonara');
      expect(headings().map(textOf)).toEqual(['Spaghetti carbonara']);
      expect(page().querySelector('div.manage')).toBeNull();
    });

    it('shows that "Quick Dal" is in the plan instead of "Delete" while it is picked in an unaccepted plan or as a dinner cooked extra there, "Delete" again once the pick is undone, and that it is in the accepted plan while picked there', async () => {
      await openQuickDal({
        plan: planOf([
          day(
            '2026-10-24',
            picked('Quick Dal', [
              'Shakshuka with bread',
              'Quick Dal',
              'Chickpea and spinach curry',
            ]),
            open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
          ),
        ]),
      });
      expectNote(PLAN_NOTE, 'picked for a lunch');
      TestBed.inject(PlanStore).clear(LUNCH);
      await harness.fixture.whenStable();
      expect(TestBed.inject(PlanStore).plan().days[0].lunch.recipe, 'pick not undone').toBeNull();
      expect(manageNotes()).toEqual([]);
      button('Delete');

      await reopenQuickDal({
        plan: planOf([
          day(
            '2026-10-24',
            open('Shakshuka with bread', 'Chickpea and spinach curry', 'Fish tacos'),
            picked('Quick Dal'),
            true,
          ),
          day(
            '2026-10-25',
            covered(),
            open('Spaghetti carbonara', 'Niçoise salad', 'Bean burritos'),
          ),
        ]),
      });
      expectNote(PLAN_NOTE, 'dinner cooked extra');

      await reopenQuickDal({
        plan: planOf([day('2026-10-24', picked('Quick Dal'), picked('Shakshuka with bread'))], {
          accepted: true,
        }),
      });
      expectNote(ACCEPTED_NOTE, 'accepted plan');
    });

    it('shows that at least 15 recipes stay suggested instead of "Delete" while "Quick Dal" is one of exactly 15 suggested, next to #21\'s note, and "Delete" while it is removed instead', async () => {
      storeOwnRecipes(QUICK_DAL);
      leaveSuggested(TestBed.inject(PlanStore), 15, 'Quick Dal');
      harness = await RouterTestingHarness.create('/recipes/quick-dal');
      expect(headings().map(textOf), 'Quick Dal not shown').toEqual(['Quick Dal']);
      expectNote(DELETE_LIMIT_NOTE, '15 suggested');
      expect(Array.from(page().querySelectorAll('p.note')).map(textOf)).toEqual([
        LIMIT_NOTE,
        DELETE_LIMIT_NOTE,
      ]);

      TestBed.resetTestingModule();
      localStorage.clear();
      configure();
      storeOwnRecipes(QUICK_DAL);
      leaveSuggested(TestBed.inject(PlanStore), 15);
      expect(TestBed.inject(PlanStore).removed(), 'Quick Dal not removed').toContain('Quick Dal');
      harness = await RouterTestingHarness.create('/recipes/quick-dal');
      expect(manageNotes()).toEqual([]);
      button('Delete');
    });

    it('opens a modal dialog "Delete Quick Dal?" with its text, "Keep recipe" focused and "Delete recipe" on "Delete", and closes it on Escape, a click on the backdrop or "Keep recipe", deleting nothing and putting the focus back on "Delete"', async () => {
      await openQuickDal({ removed: ['Quick Dal'] });
      const closings: [string, (dialog: HTMLDialogElement) => Promise<void>][] = [
        ['Escape', pressEscape],
        ['backdrop', (dialog) => pressAndRelease(dialog, OUTSIDE)],
        ['"Keep recipe"', (dialog) => click(buttonIn(dialog, 'Keep recipe'))],
      ];
      for (const [way, close] of closings) {
        const dialog = await openDeleteDialog();
        expect(modalDialogs.has(dialog), `${way}: opened with showModal()`).toBe(true);
        expect(textOf(dialog.querySelector('h2')), way).toBe('Delete Quick Dal?');
        expect(textOf(dialog.querySelector('p')), way).toBe(DELETE_TEXT);
        expect(Array.from(dialog.querySelectorAll('button')).map(textOf), way).toEqual([
          'Keep recipe',
          'Delete recipe',
        ]);
        expect(document.activeElement, `${way}: focus on opening`).toBe(
          buttonIn(dialog, 'Keep recipe'),
        );

        await close(dialog);
        expect(openDialogOrNull(), `${way}: still open`).toBeNull();
        expect(TestBed.inject(RecipeStore).own(), way).toEqual([QUICK_DAL]);
        expect(TestBed.inject(PlanStore).removed(), way).toEqual(['Quick Dal']);
        expect(document.activeElement, `${way}: focus after closing`).toBe(button('Delete'));
      }
    });

    it('deletes "Quick Dal" on "Delete recipe" and shows the Recipes page at /recipes without it, with it gone from fooplan.recipes and the removed recipes', async () => {
      await openQuickDal({ removed: ['Shakshuka with bread', 'Quick Dal'] });
      await click(buttonIn(await openDeleteDialog(), 'Delete recipe'));

      expect(router().url).toBe('/recipes');
      expect(headings().map(textOf)).toEqual(['Recipes']);
      const listed = Array.from(page().querySelectorAll('article h2')).map(textOf);
      expect(listed).toHaveLength(RECIPES.length);
      expect(listed).not.toContain('Quick Dal');
      expect(JSON.parse(localStorage.getItem(RECIPES_KEY) ?? 'null')).toEqual([]);
      expect(JSON.parse(localStorage.getItem('fooplan.removed') ?? 'null')).toEqual([
        'Shakshuka with bread',
      ]);
    });

    it('keeps showing "Quick Dal" and its ingredients, without an error, when RecipeStore.remove("Quick Dal") or replace("Quick Dal", …) with a new name is called while its page is shown', async () => {
      const changes: [string, (recipes: RecipeStore) => void][] = [
        ['remove', (recipes) => recipes.remove('Quick Dal')],
        [
          'replace',
          (recipes) =>
            recipes.replace('Quick Dal', {
              name: 'Daily Dal',
              servings: 2,
              ingredients: [{ name: 'rice', amount: 100, unit: 'g' }],
            }),
        ],
      ];
      for (const [label, change] of changes) {
        await openQuickDal();
        const recipes = TestBed.inject(RecipeStore);
        change(recipes);
        await harness.fixture.whenStable();
        // The change itself, so this can't pass with a store that ignored it
        expect(recipes.bySlug('quick-dal'), `${label}: Quick Dal still found`).toBeUndefined();
        expect(headings().map(textOf), label).toEqual(['Quick Dal']);
        expect(textOf(page().querySelector('p.servings')), label).toBe('4 servings');
        expect(ingredientLines(), label).toEqual(linesOf(QUICK_DAL));
        TestBed.resetTestingModule();
        localStorage.clear();
        configure();
      }
    });

    it('loads the plan as it was right after deleting "Quick Dal" through its page, where it was suggested for an open meal, remembered by another and shown', async () => {
      const plan = planOf([
        day(
          '2026-10-24',
          open('Shakshuka with bread', 'Quick Dal', 'Chickpea and spinach curry'),
          picked('Fish tacos', ['Fish tacos', 'Quick Dal', 'Bean burritos']),
        ),
      ]);
      await openQuickDal({ plan });
      expect(TestBed.inject(PlanStore).plan(), 'saved plan not loaded').toEqual(plan);
      await click(buttonIn(await openDeleteDialog(), 'Delete recipe'));
      const deleted = TestBed.inject(PlanStore).plan();
      expect(JSON.stringify(deleted), 'Quick Dal left in the plan').not.toContain('Quick Dal');

      // A fresh app on the same localStorage, as a reload makes
      TestBed.resetTestingModule();
      configure();
      expect(TestBed.inject(PlanStore).plan()).toEqual(deleted);
    });

    describe('edge cases', () => {
      it('names the delete dialog by its heading and describes it by its text, with tabindex -1', async () => {
        await openQuickDal();
        const dialog = await openDeleteDialog();
        expect(dialog.getAttribute('tabindex')).toBe('-1');
        expect(textsOf(dialog.getAttribute('aria-labelledby'))).toBe('Delete Quick Dal?');
        expect(textsOf(dialog.getAttribute('aria-describedby'))).toBe(DELETE_TEXT);
      });

      it('keeps the delete dialog open when the user presses inside it and releases on the backdrop, or presses the backdrop and releases inside', async () => {
        await openQuickDal();
        const dialog = await openDeleteDialog();
        await pressAndRelease(dialog.querySelector('p')!, INSIDE, dialog, OUTSIDE);
        expect(openDialogOrNull(), 'pressed inside').toBe(dialog);
        await pressAndRelease(dialog, OUTSIDE, dialog, INSIDE);
        expect(openDialogOrNull(), 'pressed on the backdrop').toBe(dialog);
        expect(TestBed.inject(RecipeStore).own()).toEqual([QUICK_DAL]);
      });
    });

    // Opens the page of "Quick Dal", saved as an own recipe, with this plan and these removed
    // recipes saved
    async function openQuickDal({ plan, removed }: { plan?: Plan; removed?: string[] } = {}) {
      storeOwnRecipes(QUICK_DAL);
      if (plan) {
        localStorage.setItem('fooplan.plan', JSON.stringify(plan));
      }
      if (removed) {
        localStorage.setItem('fooplan.removed', JSON.stringify(removed));
      }
      harness = await RouterTestingHarness.create('/recipes/quick-dal');
      expect(headings().map(textOf), 'Quick Dal not shown').toEqual(['Quick Dal']);
      if (plan) {
        expect(TestBed.inject(PlanStore).plan(), 'saved plan not loaded').toEqual(plan);
      }
    }

    async function reopenQuickDal(saved: { plan?: Plan; removed?: string[] }) {
      TestBed.resetTestingModule();
      localStorage.clear();
      configure();
      await openQuickDal(saved);
    }

    function expectNote(note: string, context: string) {
      expect(manageNotes(), context).toEqual([note]);
      expect(buttonsLabelled('Delete'), context).toEqual([]);
    }

    function manageNotes(): string[] {
      return Array.from(page().querySelectorAll('div.manage p.note')).map(textOf);
    }

    async function openDeleteDialog(): Promise<HTMLDialogElement> {
      await click(button('Delete'));
      const dialog = openDialogOrNull();
      expect(dialog, 'no open dialog').not.toBeNull();
      vi.spyOn(dialog!, 'getBoundingClientRect').mockReturnValue(BOX);
      return dialog!;
    }

    function openDialogOrNull(): HTMLDialogElement | null {
      return page().querySelector('dialog[open]');
    }

    function buttonIn(root: HTMLElement, label: string): HTMLButtonElement {
      const found = Array.from(root.querySelectorAll('button')).filter(
        (candidate) => textOf(candidate) === label,
      );
      expect(found, `"${label}" buttons`).toHaveLength(1);
      return found[0];
    }

    function textsOf(ids: string | null): string {
      return (ids ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => textOf(document.getElementById(id)))
        .join(' ');
    }

    // What the browser does on Escape when the page's keydown handlers let it: the modal dialog
    // gets "cancel" and closes unless that is cancelled
    async function pressEscape(dialog: HTMLDialogElement) {
      const target = document.activeElement ?? document.body;
      const keydown = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      if (
        target.dispatchEvent(keydown) &&
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
      ) {
        dialog.close();
      }
      await harness.fixture.whenStable();
    }

    // A press fires pointerdown on the pressed element, its release a click on the closest element
    // around both; a click on the backdrop targets the dialog itself, at a point outside its box
    async function pressAndRelease(
      pressed: HTMLElement,
      pressAt: { clientX: number; clientY: number },
      clicked = pressed,
      releaseAt = pressAt,
    ) {
      pressed.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, ...pressAt }),
      );
      await harness.fixture.whenStable();
      clicked.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, ...releaseAt }),
      );
      await harness.fixture.whenStable();
    }
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
    return steps!;
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
    return Array.from(page().querySelectorAll('ul > li')).map(textOf);
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
