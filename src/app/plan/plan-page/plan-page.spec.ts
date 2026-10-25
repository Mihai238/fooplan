import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { groceryList, itemKey } from '../../groceries/groceries';
import { recipeSlug } from '../../recipes/recipe-slug';
import { RECIPES } from '../../recipes/recipes';
import { QUICK_DAL, storeOwnRecipes } from '../../recipes/testing';
import { installDialog, modalDialogs, TABBABLE } from '../../testing';
import { Plan } from '../plan';
import { PlanStore, RANDOM, TODAY } from '../plan-store';
import {
  covered,
  day as planDay,
  eatingOut,
  KID_FRIENDLY,
  leaveSuggested,
  NOT_KID_FRIENDLY,
  open,
  picked,
  planOf,
  seededRandom,
} from '../testing';
import { PlanPage } from './plan-page';

const ARROWS = ['One more day', 'One day fewer', 'One more person', 'One person fewer'] as const;

// jsdom lays out nothing, so a dialog's box is stubbed, and these points are placed around it
const BOX = { left: 100, top: 100, right: 400, bottom: 300 } as DOMRect;
const OUTSIDE = { clientX: 50, clientY: 50 };
const PADDING = { clientX: 110, clientY: 110 };
const INSIDE = { clientX: 250, clientY: 200 };

describe('PlanPage', () => {
  let fixture: ComponentFixture<PlanPage>;
  let element: HTMLElement;
  let store: PlanStore;
  let today: string;
  let uninstallDialog: () => void;

  beforeAll(() => {
    uninstallDialog = installDialog();
  });

  afterAll(() => {
    uninstallDialog();
  });

  beforeEach(async () => {
    localStorage.clear();
    // A Saturday
    today = '2026-10-24';
    await createPage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the "Plan" heading and the default 5 days for 2 people on first open', () => {
    expect(textOf(element.querySelector('h1'))).toBe('Plan');
    expect(textOf(stepper('Days'))).toBe('5');
    expect(textOf(stepper('People'))).toBe('2');
    expect(days()).toHaveLength(5);
  });

  it('shows 3 days starting today, each with a lunch and a dinner, when the user sets 3 days', async () => {
    await click(arrow('One day fewer'));
    await click(arrow('One day fewer'));
    expect(days().map((day) => textOf(day.querySelector('h2')))).toEqual([
      'Sat 24 Oct',
      'Sun 25 Oct',
      'Mon 26 Oct',
    ]);
    for (const day of days()) {
      const meals = Array.from(day.querySelectorAll('article.meal'));
      expect(meals.map((meal) => textOf(meal.querySelector('h3')))).toEqual(['Lunch', 'Dinner']);
    }
    expect(textOf(stepper('People'))).toBe('2');
  });

  describe('Days and People steppers', () => {
    it("shows the days and people values as text that can't be edited, each between a down and an up arrow button, and no text or number field", () => {
      for (const [name, shown, down, up] of [
        ['Days', '5', 'One day fewer', 'One more day'],
        ['People', '2', 'One person fewer', 'One more person'],
      ] as const) {
        const value = stepper(name);
        expect(textOf(value), name).toBe(shown);
        expect(value.matches('input, textarea, select'), `${name} is a field`).toBe(false);
        expect(value.closest('[contenteditable]:not([contenteditable="false"])'), name).toBeNull();
        expect(value.querySelector('input, textarea, select, button'), name).toBeNull();
        expect(follows(value, arrow(down)), `${name}: down arrow before the value`).toBe(true);
        expect(follows(arrow(up), value), `${name}: up arrow after the value`).toBe(true);
      }
      expect(
        element.querySelectorAll('input:not([type="checkbox"]), textarea, select'),
      ).toHaveLength(0);
      expect(
        element.querySelectorAll('[contenteditable]:not([contenteditable="false"])'),
      ).toHaveLength(0);
    });

    it('makes the plan 4 days when the user clicks "One more day" at 3 days, and 3 again with "One day fewer"', async () => {
      await setDays(3);
      await click(arrow('One more day'));
      expect(store.plan().days).toHaveLength(4);
      expect(days()).toHaveLength(4);
      expect(textOf(stepper('Days'))).toBe('4');
      await click(arrow('One day fewer'));
      expect(store.plan().days).toHaveLength(3);
      expect(days()).toHaveLength(3);
      expect(textOf(stepper('Days'))).toBe('3');
    });

    it('drops the last day and keeps the picks of the others when the user clicks "One day fewer"', async () => {
      const first = await pickFirstSuggestion(0);
      await pickFirstSuggestion(9);
      await click(arrow('One day fewer'));
      expect(days().map((day) => textOf(day.querySelector('h2')))).toEqual([
        'Sat 24 Oct',
        'Sun 25 Oct',
        'Mon 26 Oct',
        'Tue 27 Oct',
      ]);
      expect(Array.from(element.querySelectorAll('p.recipe')).map(textOf)).toEqual([first]);
    });

    it('adds an open day at the end and keeps the picks of the others when the user clicks "One more day"', async () => {
      await setDays(3);
      const first = await pickFirstSuggestion(0);
      await click(arrow('One more day'));
      expect(days().map((day) => textOf(day.querySelector('h2')))).toEqual([
        'Sat 24 Oct',
        'Sun 25 Oct',
        'Mon 26 Oct',
        'Tue 27 Oct',
      ]);
      expect(Array.from(element.querySelectorAll('p.recipe')).map(textOf)).toEqual([first]);
      for (const index of [6, 7]) {
        expect(suggestionsOf(meal(index)), `meal ${index} of the new day`).toHaveLength(3);
      }
    });

    it('disables "One more day" at 5 days and "One day fewer" at 1 day', async () => {
      expect(arrow('One more day').disabled, 'up at 5 days').toBe(true);
      expect(arrow('One day fewer').disabled, 'down at 5 days').toBe(false);
      await setDays(1);
      expect(arrow('One day fewer').disabled, 'down at 1 day').toBe(true);
      expect(arrow('One more day').disabled, 'up at 1 day').toBe(false);
    });

    it('changes nothing when the user clicks "One more day" at 5 days or "One day fewer" at 1 day', async () => {
      let before = store.plan();
      await click(arrow('One more day'));
      expect(store.plan(), 'up at 5 days').toBe(before);
      expect(textOf(stepper('Days'))).toBe('5');
      await setDays(1);
      before = store.plan();
      await click(arrow('One day fewer'));
      expect(store.plan(), 'down at 1 day').toBe(before);
      expect(textOf(stepper('Days'))).toBe('1');
    });

    it('enables "One day fewer" when the user goes from 1 to 2 days, and disables it again on the way back', async () => {
      await setDays(1);
      await click(arrow('One more day'));
      expect(arrow('One day fewer').disabled, 'at 2 days').toBe(false);
      await click(arrow('One day fewer'));
      expect(arrow('One day fewer').disabled, 'back at 1 day').toBe(true);
    });

    it('disables "One more day" when the user goes from 4 to 5 days', async () => {
      await setDays(4);
      expect(arrow('One more day').disabled, 'at 4 days').toBe(false);
      await click(arrow('One more day'));
      expect(textOf(stepper('Days'))).toBe('5');
      expect(arrow('One more day').disabled, 'at 5 days').toBe(true);
    });

    it("moves the focus to the stepper's value when the focused arrow becomes disabled at a limit, and leaves it on the arrow otherwise", async () => {
      await setDays(3);
      arrow('One more day').focus();
      await click(arrow('One more day'));
      expect(document.activeElement, 'up at 4 days').toBe(arrow('One more day'));
      await click(arrow('One more day'));
      expect(document.activeElement, 'up at 5 days').toBe(stepper('Days'));

      await setDays(2);
      arrow('One day fewer').focus();
      await click(arrow('One day fewer'));
      expect(document.activeElement, 'down at 1 day').toBe(stepper('Days'));

      await setPeople(2);
      arrow('One person fewer').focus();
      await click(arrow('One person fewer'));
      expect(document.activeElement, 'down at 1 person').toBe(stepper('People'));
    });

    it('disables "One person fewer" at 1 person, and makes the plan for 3 people when the user clicks "One more person" at 2', async () => {
      await setPeople(1);
      expect(arrow('One person fewer').disabled, 'down at 1 person').toBe(true);
      await setPeople(2);
      expect(arrow('One person fewer').disabled, 'down at 2 people').toBe(false);
      await click(arrow('One more person'));
      expect(store.plan().people).toBe(3);
      expect(textOf(stepper('People'))).toBe('3');
    });

    it('changes nothing when the user clicks "One person fewer" at 1 person', async () => {
      await setPeople(1);
      const before = store.plan();
      await click(arrow('One person fewer'));
      expect(store.plan()).toBe(before);
      expect(textOf(stepper('People'))).toBe('1');
    });

    it('enables "One person fewer" when the user goes from 1 to 2 people, and disables it again on the way back', async () => {
      await setPeople(1);
      await click(arrow('One more person'));
      expect(arrow('One person fewer').disabled, 'at 2 people').toBe(false);
      await click(arrow('One person fewer'));
      expect(arrow('One person fewer').disabled, 'back at 1 person').toBe(true);
    });

    it('keeps "One more person" enabled with no upper limit, making 100 people from 99', async () => {
      await setPeople(99);
      expect(arrow('One more person').disabled).toBe(false);
      await click(arrow('One more person'));
      expect(store.plan().people).toBe(100);
      expect(textOf(stepper('People'))).toBe('100');
      expect(arrow('One more person').disabled).toBe(false);
    });

    it('raises and lowers the focused days and people values by 1 with ArrowUp and ArrowDown', async () => {
      await setDays(3);
      for (const [name, count] of [
        ['Days', () => store.plan().days.length],
        ['People', () => store.plan().people],
      ] as const) {
        const value = stepper(name);
        value.focus();
        const start = count();
        await keydown(value, 'ArrowUp');
        expect(count(), `${name} after ArrowUp`).toBe(start + 1);
        expect(textOf(stepper(name))).toBe(String(start + 1));
        await keydown(value, 'ArrowDown');
        expect(count(), `${name} after ArrowDown`).toBe(start);
        expect(textOf(stepper(name))).toBe(String(start));
        await keydown(value, 'ArrowDown');
        expect(count(), `${name} after a second ArrowDown`).toBe(start - 1);
      }
    });

    it('changes nothing on ArrowUp at 5 days, ArrowDown at 1 day or ArrowDown at 1 person', async () => {
      for (const [setup, name, key] of [
        [() => setDays(5), 'Days', 'ArrowUp'],
        [() => setDays(1), 'Days', 'ArrowDown'],
        [() => setPeople(1), 'People', 'ArrowDown'],
      ] as const) {
        await setup();
        const before = store.plan();
        const value = stepper(name);
        value.focus();
        await keydown(value, key);
        expect(store.plan(), `${key} on ${name} at ${textOf(value)}`).toBe(before);
      }
    });

    it('changes nothing on digits, letters, Home, End, PageUp, PageDown or Tab on the value, and leaves those keys to the browser', async () => {
      await setDays(3);
      for (const name of ['Days', 'People'] as const) {
        const before = store.plan();
        const value = stepper(name);
        value.focus();
        for (const key of [
          '1',
          '4',
          '9',
          'a',
          'x',
          '+',
          '-',
          'Home',
          'End',
          'PageUp',
          'PageDown',
          'Tab',
        ]) {
          expect(await keydown(value, key), `${key} on ${name} handled by the page`).toBe(false);
          expect(store.plan(), `${key} on ${name}`).toBe(before);
        }
        expect(textOf(stepper(name))).toBe(name === 'Days' ? '3' : '2');
      }
    });

    it('keeps ArrowUp and ArrowDown on the value from scrolling the page, also at a limit', async () => {
      await setDays(3);
      for (const name of ['Days', 'People'] as const) {
        const value = stepper(name);
        value.focus();
        for (const key of ['ArrowUp', 'ArrowDown']) {
          expect(await keydown(value, key), `${key} on ${name} left to the browser`).toBe(true);
        }
      }
      await setDays(5);
      expect(await keydown(stepper('Days'), 'ArrowUp'), 'ArrowUp at 5 days').toBe(true);
      await setPeople(1);
      expect(await keydown(stepper('People'), 'ArrowDown'), 'ArrowDown at 1 person').toBe(true);
    });

    it('makes each stepper a focusable spinbutton named "Days" or "People" with its value and limits, and names every arrow button', () => {
      const daysValue = stepper('Days');
      expect(daysValue.getAttribute('tabindex')).toBe('0');
      expect(daysValue.getAttribute('aria-valuenow')).toBe('5');
      expect(daysValue.getAttribute('aria-valuemin')).toBe('1');
      expect(daysValue.getAttribute('aria-valuemax')).toBe('5');
      const peopleValue = stepper('People');
      expect(peopleValue.getAttribute('tabindex')).toBe('0');
      expect(peopleValue.getAttribute('aria-valuenow')).toBe('2');
      expect(peopleValue.getAttribute('aria-valuemin')).toBe('1');
      expect(peopleValue.hasAttribute('aria-valuemax'), 'people has a maximum').toBe(false);
      expect(element.querySelectorAll('[role="spinbutton"]')).toHaveLength(2);
      for (const name of ARROWS) {
        expect(element.querySelectorAll(`button[aria-label="${name}"]`), name).toHaveLength(1);
      }
    });

    it('updates aria-valuenow when the user changes days or people', async () => {
      await click(arrow('One day fewer'));
      expect(stepper('Days').getAttribute('aria-valuenow')).toBe('4');
      await click(arrow('One more person'));
      expect(stepper('People').getAttribute('aria-valuenow')).toBe('3');
      stepper('Days').focus();
      await keydown(stepper('Days'), 'ArrowDown');
      expect(stepper('Days').getAttribute('aria-valuenow')).toBe('3');
      stepper('People').focus();
      await keydown(stepper('People'), 'ArrowDown');
      expect(stepper('People').getAttribute('aria-valuenow')).toBe('2');
    });

    it('shows "1 day for 3 people" and no steppers once the plan is accepted', async () => {
      expect(
        element.querySelectorAll('[role="spinbutton"]'),
        'steppers while planning',
      ).toHaveLength(2);
      await click(arrow('One more person'));
      await acceptOneDayPlan();
      expect(textOf(element.querySelector('.summary'))).toBe('1 day for 3 people');
      expect(element.querySelectorAll('[role="spinbutton"]')).toHaveLength(0);
      for (const name of ARROWS) {
        expect(element.querySelector(`button[aria-label="${name}"]`), name).toBeNull();
      }
    });
  });

  it('shows the picked recipe and no suggestions for a meal once the user picks one of its three suggestions', async () => {
    expect(suggestionsOf(meal(0)), 'suggestions of the first meal').toHaveLength(3);
    const recipe = recipeOf(suggestionsOf(meal(0))[1]);
    await click(suggestionsOf(meal(0))[1]);
    expect(textOf(meal(0).querySelector('p.recipe'))).toBe(recipe);
    expect(suggestionsOf(meal(0))).toEqual([]);
  });

  it('shows three other suggestions when the user clicks "Other suggestions"', async () => {
    const before = suggestionsOf(meal(0)).map(recipeOf);
    expect(before, 'suggestions of the first meal').toHaveLength(3);
    await click(button(meal(0), 'Other suggestions'));
    const after = suggestionsOf(meal(0)).map(recipeOf);
    expect(after).toHaveLength(3);
    expect(after.filter((name) => before.includes(name))).toEqual([]);
  });

  it('offers "Undo" and no "Clear" on a picked meal of a plan in progress', async () => {
    await pickFirstSuggestion(0);
    expect(buttonTexts(meal(0))).toContain('Undo');
    expect(buttonTexts(meal(0))).not.toContain('Clear');
  });

  it('offers "Undo" neither on an open meal nor on any meal once the plan is accepted', async () => {
    await setDays(1);
    await pickFirstSuggestion(0);
    expect(buttonTexts(meal(0)), 'picked meal').toContain('Undo');
    expect(buttonTexts(meal(1)), 'open meal').not.toContain('Undo');
    await pickFirstSuggestion(1);
    await click(button(element, 'Accept plan'));
    expect(buttonTexts(), 'plan not accepted').not.toContain('Accept plan');
    expect(buttonTexts()).not.toContain('Undo');
  });

  it('shows the same three suggestions in the same order, and not while the meal is picked, when the user picks one and clicks "Undo"', async () => {
    const before = suggestionsOf(meal(0)).map(recipeOf);
    expect(before, 'suggestions of the first meal').toHaveLength(3);
    await click(suggestionsOf(meal(0))[1]);
    expect(textOf(meal(0).querySelector('p.recipe'))).toBe(before[1]);
    expect(buttonTexts(meal(0)), 'buttons of the picked meal').toEqual(['Undo']);

    await click(button(meal(0), 'Undo'));
    expect(meal(0).querySelector('p.recipe')).toBeNull();
    expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(before);
  });

  it('disables "Accept plan" while a meal is open and enables it once every meal has a recipe', async () => {
    await setDays(1);
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await pickFirstSuggestion(0);
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await pickFirstSuggestion(1);
    expect(button(element, 'Accept plan').disabled).toBe(false);
  });

  it('shows "Leftovers: <recipe>" without suggestions or buttons for the next lunch when the user turns on "Cook extra for tomorrow\'s lunch"', async () => {
    await setDays(2);
    const recipe = await pickFirstSuggestion(1);
    const label = element.querySelector('article.meal label.cook-extra');
    expect(textOf(label)).toBe("Cook extra for tomorrow's lunch");
    expect(label?.querySelector('input[type="checkbox"]#cook-extra-0')).not.toBeNull();
    expect(input('cook-extra-0').checked).toBe(false);

    await setCookExtra(0, true);
    expect(input('cook-extra-0').checked).toBe(true);
    expect(textOf(meal(2).querySelector('p.recipe'))).toBe(`Leftovers: ${recipe}`);
    expect(suggestionsOf(meal(2))).toEqual([]);
    expect(meal(2).querySelectorAll('button')).toHaveLength(0);
  });

  it('offers "Cook extra" only on a picked dinner that is not on the last day', async () => {
    await setDays(2);
    await pickFirstSuggestion(0);
    expect(element.querySelector('#cook-extra-0'), 'open dinner').toBeNull();
    await pickFirstSuggestion(1);
    expect(meal(1).querySelector('input#cook-extra-0'), 'picked dinner').not.toBeNull();
    await pickFirstSuggestion(3);
    expect(element.querySelector('#cook-extra-1'), 'dinner on the last day').toBeNull();
    expect(meal(3).querySelector('label.cook-extra')).toBeNull();
    for (const index of [0, 2]) {
      expect(meal(index).querySelector('label.cook-extra'), `lunch ${index}`).toBeNull();
    }
  });

  it('enables "Accept plan" when the only unfilled lunch is covered by leftovers', async () => {
    await setDays(2);
    await pickFirstSuggestion(0);
    await pickFirstSuggestion(1);
    await pickFirstSuggestion(3);
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await setCookExtra(0, true);
    expect(button(element, 'Accept plan').disabled).toBe(false);
  });

  it('shows "Cook extra" of an accepted plan as a note on its dinner only, without the option', async () => {
    await setDays(3);
    await pickFirstSuggestion(0);
    const recipe = await pickFirstSuggestion(1);
    await setCookExtra(0, true);
    for (const index of [3, 4, 5]) {
      await pickFirstSuggestion(index);
    }
    await click(button(element, 'Accept plan'));
    expect(buttonTexts(), 'plan not accepted').not.toContain('Accept plan');

    expect(element.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(element.querySelectorAll('label.cook-extra')).toHaveLength(0);
    expect(Array.from(element.querySelectorAll('p.note')).map(textOf)).toEqual([
      "Cooking extra for tomorrow's lunch",
    ]);
    expect(meal(1).querySelector('p.note')).not.toBeNull();
    expect(textOf(meal(2).querySelector('p.recipe'))).toBe(`Leftovers: ${recipe}`);
  });

  it('shows an accepted plan read-only, without day, people, pick, "Undo", "Other suggestions" or "Accept plan" controls', async () => {
    const recipes = await acceptOneDayPlan();
    expect(Array.from(element.querySelectorAll('p.recipe')).map(textOf)).toEqual(recipes);
    expect(element.querySelectorAll('input')).toHaveLength(0);
    expect(element.querySelectorAll('button.suggestion')).toHaveLength(0);
    expect(buttonTexts()).not.toContain('Undo');
    expect(buttonTexts()).not.toContain('Other suggestions');
    expect(buttonTexts()).not.toContain('Accept plan');
  });

  it('offers "New plan" both while planning and for an accepted plan', async () => {
    expect(buttonTexts()).toContain('New plan');
    await acceptOneDayPlan();
    expect(buttonTexts()).toContain('New plan');
  });

  describe('recipe links', () => {
    it("links a picked meal's recipe name to its recipe page, which a click opens at /recipes/<slug>", async () => {
      await openWith(planWithOpenDinner());
      const link = recipeLink(meal(0));
      expect(textOf(link)).toBe('Beef stroganoff with rice');
      expect(link.getAttribute('href')).toBe('/recipes/beef-stroganoff-with-rice');
      await click(link);
      expect(router().url).toBe('/recipes/beef-stroganoff-with-rice');
    });

    it('links the recipe name in "Leftovers: <recipe>" to its recipe page, which a click opens', async () => {
      await openWith(planWithLeftovers(false));
      expect(textOf(meal(2).querySelector('p.recipe'))).toBe(
        'Leftovers: Beef stroganoff with rice',
      );
      const link = recipeLink(meal(2));
      expect(textOf(link)).toBe('Beef stroganoff with rice');
      expect(link.getAttribute('href')).toBe('/recipes/beef-stroganoff-with-rice');
      await click(link);
      expect(router().url).toBe('/recipes/beef-stroganoff-with-rice');
    });

    it('offers a "Recipe" link named "Recipe for <name>" with each suggestion, which opens its recipe page, while a click on the suggestion itself still picks it', async () => {
      await openWith(planWithOpenDinner());
      const links = recipeLinksOf(meal(1));
      expect(links.map(nameOf)).toEqual([
        'Recipe for Niçoise salad',
        'Recipe for Oven-baked salmon with potatoes and green beans',
        'Recipe for Spaghetti carbonara',
      ]);
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/recipes/nicoise-salad',
        '/recipes/oven-baked-salmon-with-potatoes-and-green-beans',
        '/recipes/spaghetti-carbonara',
      ]);
      await click(links[0]);
      expect(router().url).toBe('/recipes/nicoise-salad');

      await click(suggestionsOf(meal(1))[0]);
      expect(textOf(meal(1).querySelector('p.recipe'))).toBe('Niçoise salad');
      expect(store.plan().days[0].dinner.recipe).toBe('Niçoise salad');
    });

    it('picks nothing and keeps the suggestions when the user clicks a suggestion\'s "Recipe" link', async () => {
      await openWith(planWithOpenDinner());
      const before = store.plan();
      const saved = localStorage.getItem('fooplan.plan');
      const links = recipeLinksOf(meal(1));
      expect(links, '"Recipe" links of the open dinner').toHaveLength(3);
      await click(links[1]);
      expect(router().url, 'link not followed').toBe(
        '/recipes/oven-baked-salmon-with-potatoes-and-green-beans',
      );
      expect(store.plan()).toBe(before);
      expect(localStorage.getItem('fooplan.plan')).toBe(saved);
      expect(meal(1).querySelector('p.recipe')).toBeNull();
      expect(suggestionsOf(meal(1)).map(recipeOf)).toEqual([
        'Niçoise salad',
        'Oven-baked salmon with potatoes and green beans',
        'Spaghetti carbonara',
      ]);
    });

    it('keeps each suggestion a button that holds no link and is in none, with its "Recipe" link after it and before the next suggestion', async () => {
      await openWith(planWithOpenDinner());
      const suggestions = suggestionsOf(meal(1));
      const links = recipeLinksOf(meal(1));
      expect(suggestions, 'suggestions of the open dinner').toHaveLength(3);
      expect(links, '"Recipe" links of the open dinner').toHaveLength(3);
      suggestions.forEach((suggestion, i) => {
        const name = recipeOf(suggestion);
        expect(suggestion.closest('a'), `${name} in a link`).toBeNull();
        expect(suggestion.querySelector('a'), `${name} holds a link`).toBeNull();
        expect(links[i].closest('button'), `"Recipe" link of ${name} in a button`).toBeNull();
        expect(follows(links[i], suggestion), `"Recipe" link of ${name} after it`).toBe(true);
        const next = suggestions[i + 1] ?? button(meal(1), 'Other suggestions');
        expect(follows(next, links[i]), `"Recipe" link of ${name} before what follows`).toBe(true);
      });
      expect(
        Array.from(meal(1).querySelectorAll('a')).map(textOf),
        'links of the open dinner',
      ).toEqual(['Recipe', 'Recipe', 'Recipe']);
    });

    it('gives the 30 "Recipe" links of a 5-day plan the visible text "Recipe" and 30 different names, each "Recipe for" its suggestion', () => {
      expect(days(), 'days of the plan').toHaveLength(5);
      const names: string[] = [];
      for (let index = 0; index < 10; index++) {
        const suggestions = suggestionsOf(meal(index));
        const links = recipeLinksOf(meal(index));
        expect(suggestions, `suggestions of meal ${index}`).toHaveLength(3);
        expect(links.map(nameOf), `"Recipe" links of meal ${index}`).toEqual(
          suggestions.map((suggestion) => `Recipe for ${recipeOf(suggestion)}`),
        );
        for (const link of links) {
          expect(link.getAttribute('href'), nameOf(link)).toMatch(
            /^\/recipes\/[a-z0-9]+(-[a-z0-9]+)*$/,
          );
        }
        names.push(...links.map(nameOf));
      }
      expect(new Set(names).size).toBe(30);
    });

    it('moves the "Recipe" links to the new suggestions when the user clicks "Other suggestions"', async () => {
      await click(button(meal(0), 'Other suggestions'));
      const suggestions = suggestionsOf(meal(0)).map(recipeOf);
      expect(suggestions, 'suggestions of the first meal').toHaveLength(3);
      expect(recipeLinksOf(meal(0)).map(nameOf)).toEqual(
        suggestions.map((name) => `Recipe for ${name}`),
      );
    });

    it("links each recipe name of an accepted plan, its leftovers' too, to its recipe page, which a click opens", async () => {
      await openWith(planWithLeftovers(true));
      expect(
        [0, 1, 2, 3].map((index) => {
          const link = recipeLink(meal(index));
          return [textOf(link), link.getAttribute('href')];
        }),
      ).toEqual([
        [
          'Oven-baked salmon with potatoes and green beans',
          '/recipes/oven-baked-salmon-with-potatoes-and-green-beans',
        ],
        ['Beef stroganoff with rice', '/recipes/beef-stroganoff-with-rice'],
        ['Beef stroganoff with rice', '/recipes/beef-stroganoff-with-rice'],
        ['Niçoise salad', '/recipes/nicoise-salad'],
      ]);
      await click(recipeLink(meal(3)));
      expect(router().url).toBe('/recipes/nicoise-salad');
    });

    it('shows an accepted plan with its recipe links but without "Recipe" links, suggestions, "Undo" or "Other suggestions", and following a link changes nothing', async () => {
      await openWith(planWithLeftovers(true));
      const before = store.plan();
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.days a'));
      expect(links.map(textOf)).toEqual([
        'Oven-baked salmon with potatoes and green beans',
        'Beef stroganoff with rice',
        'Beef stroganoff with rice',
        'Niçoise salad',
      ]);
      expect(element.querySelectorAll('button.suggestion')).toHaveLength(0);
      expect(buttonTexts()).not.toContain('Undo');
      expect(buttonTexts()).not.toContain('Other suggestions');
      await click(links[0]);
      expect(router().url, 'link not followed').toBe(
        '/recipes/oven-baked-salmon-with-potatoes-and-green-beans',
      );
      expect(store.plan()).toBe(before);
    });

    function planWithOpenDinner(): Plan {
      return {
        days: [
          planDay(
            '2026-10-24',
            picked('Beef stroganoff with rice'),
            open(
              'Niçoise salad',
              'Oven-baked salmon with potatoes and green beans',
              'Spaghetti carbonara',
            ),
          ),
        ],
        people: 2,
        accepted: false,
        ticked: [],
        added: [],
        shown: [
          'Beef stroganoff with rice',
          'Niçoise salad',
          'Oven-baked salmon with potatoes and green beans',
          'Spaghetti carbonara',
        ],
        kidFriendly: false,
      };
    }

    // The dinner of the first day covers the lunch of the second; a plan in progress leaves the
    // last dinner open
    function planWithLeftovers(accepted: boolean): Plan {
      return {
        days: [
          planDay(
            '2026-10-24',
            picked('Oven-baked salmon with potatoes and green beans'),
            picked('Beef stroganoff with rice'),
            true,
          ),
          planDay(
            '2026-10-25',
            covered(),
            accepted
              ? picked('Niçoise salad')
              : open('Niçoise salad', 'Shakshuka with bread', 'Chickpea and spinach curry'),
          ),
        ],
        people: 2,
        accepted,
        ticked: [],
        added: [],
        shown: accepted
          ? [
              'Oven-baked salmon with potatoes and green beans',
              'Beef stroganoff with rice',
              'Niçoise salad',
            ]
          : [
              'Oven-baked salmon with potatoes and green beans',
              'Beef stroganoff with rice',
              'Niçoise salad',
              'Shakshuka with bread',
              'Chickpea and spinach curry',
            ],
        kidFriendly: false,
      };
    }
  });

  describe('cooking time', () => {
    const OPEN_SHAKSHUKA = open(
      'Shakshuka with bread',
      'Niçoise salad',
      'Oven-baked salmon with potatoes and green beans',
    );

    it('shows a suggestion as a span.name with the recipe and a span.minutes with its time, read as "Shakshuka with bread 30 minutes" without an aria-label', async () => {
      await openWith(
        planOf([planDay('2026-10-24', OPEN_SHAKSHUKA, picked('Spaghetti carbonara'))]),
      );
      const shakshuka = suggestionsOf(meal(0))[0];
      expect(Array.from(shakshuka.children).map(partOf)).toEqual([
        ['span.name', 'Shakshuka with bread'],
        ['span.minutes', '30 minutes'],
      ]);
      expect(textOf(shakshuka)).toBe('Shakshuka with bread 30 minutes');
      expect(shakshuka.hasAttribute('aria-label')).toBe(false);
    });

    it('keeps the time of a suggestion inside its button, out of its "Recipe" link, which stays "Recipe for Shakshuka with bread"', async () => {
      await openWith(
        planOf([planDay('2026-10-24', OPEN_SHAKSHUKA, picked('Spaghetti carbonara'))]),
      );
      const option = suggestionsOf(meal(0))[0].closest<HTMLElement>('.option');
      expect(option, 'no option around the "Shakshuka with bread" suggestion').not.toBeNull();
      const times = Array.from(option!.querySelectorAll('.minutes'));
      expect(times.map(textOf), 'times of the "Shakshuka with bread" option').toEqual([
        '30 minutes',
      ]);
      expect(times[0].closest('button.suggestion')).toBe(suggestionsOf(meal(0))[0]);
      const [link] = recipeLinksOf(option!);
      expect(link.querySelector('.minutes')).toBeNull();
      expect(nameOf(link)).toBe('Recipe for Shakshuka with bread');
    });

    it('picks "Shakshuka with bread" when the user clicks the time in its suggestion', async () => {
      await openWith(
        planOf([planDay('2026-10-24', OPEN_SHAKSHUKA, picked('Spaghetti carbonara'))]),
      );
      const time = suggestionsOf(meal(0))[0].querySelector<HTMLElement>('span.minutes');
      expect(time, 'no time in the "Shakshuka with bread" suggestion').not.toBeNull();
      await click(time!);
      expect(store.plan().days[0].lunch.recipe).toBe('Shakshuka with bread');
      expect(textOf(meal(0).querySelector('p.recipe'))).toBe('Shakshuka with bread');
    });

    it('shows a p.minutes "20 minutes" right after the p.recipe of a picked "Spaghetti carbonara"', async () => {
      await openWith(
        planOf([planDay('2026-10-24', OPEN_SHAKSHUKA, picked('Spaghetti carbonara'))]),
      );
      const name = meal(1).querySelector('p.recipe');
      expect(textOf(name)).toBe('Spaghetti carbonara');
      expect(partOf(name?.nextElementSibling)).toEqual(['p.minutes', '20 minutes']);
    });

    it('shows the suggestions "Tuna and white bean salad with bread 10 minutes", "Avocado toast with fried egg 15 minutes" and "Spinach and feta omelette 15 minutes", and the picked "Tuna and white bean salad with bread" linking to /recipes/tuna-and-white-bean-salad-with-bread with a p.minutes "10 minutes"', async () => {
      await openWith(
        planOf([
          planDay(
            '2026-10-24',
            open(
              'Tuna and white bean salad with bread',
              'Avocado toast with fried egg',
              'Spinach and feta omelette',
            ),
            picked('Spaghetti carbonara'),
          ),
        ]),
      );
      expect(suggestionsOf(meal(0)).map(textOf)).toEqual([
        'Tuna and white bean salad with bread 10 minutes',
        'Avocado toast with fried egg 15 minutes',
        'Spinach and feta omelette 15 minutes',
      ]);

      await click(suggestionsOf(meal(0))[0]);
      const link = recipeLink(meal(0));
      expect(textOf(link)).toBe('Tuna and white bean salad with bread');
      expect(link.getAttribute('href')).toBe('/recipes/tuna-and-white-bean-salad-with-bread');
      expect(partOf(meal(0).querySelector('p.recipe')?.nextElementSibling)).toEqual([
        'p.minutes',
        '10 minutes',
      ]);
    });

    it("puts no link in or around a picked meal's time, and keeps the time out of the recipe name's link", async () => {
      await openWith(
        planOf([planDay('2026-10-24', OPEN_SHAKSHUKA, picked('Spaghetti carbonara'))]),
      );
      const time = meal(1).querySelector('p.minutes');
      expect(time, 'no time below "Spaghetti carbonara"').not.toBeNull();
      expect(time!.closest('a'), 'time in a link').toBeNull();
      expect(time!.querySelector('a'), 'time holds a link').toBeNull();
      expect(textOf(recipeLink(meal(1)))).toBe('Spaghetti carbonara');
    });

    it('shows a picked dinner that is not on the last day as its name, its time, "Cook extra" and "Undo", in this order', async () => {
      await openWith(goulashPlan({ cookExtra: false, accepted: false }));
      expect(childrenAfterHeading(meal(1))).toEqual([
        ['p.recipe', 'Potato goulash'],
        ['p.minutes', '45 minutes'],
        ['label.cook-extra', "Cook extra for tomorrow's lunch"],
        ['button.link', 'Undo'],
      ]);
    });

    it('shows no time on a leftovers lunch, but keeps it on the dinner cooked extra for it', async () => {
      await openWith(goulashPlan({ cookExtra: true, accepted: false }));
      expect(textOf(meal(2).querySelector('p.recipe'))).toBe('Leftovers: Potato goulash');
      expect(meal(2).querySelectorAll('.minutes')).toHaveLength(0);
      expect(textOf(meal(2))).not.toMatch(/\d+ minutes/);
      expect(textOf(meal(1).querySelector('.minutes'))).toBe('45 minutes');
    });

    it('shows a dinner cooked extra of an accepted plan as its name, its time and the note, the leftovers lunch without a time, and no control or linked time', async () => {
      await openWith(goulashPlan({ cookExtra: true, accepted: true }));
      expect(childrenAfterHeading(meal(1))).toEqual([
        ['p.recipe', 'Potato goulash'],
        ['p.minutes', '45 minutes'],
        ['p.note', "Cooking extra for tomorrow's lunch"],
      ]);
      expect(textOf(meal(2).querySelector('p.recipe'))).toBe('Leftovers: Potato goulash');
      expect(meal(2).querySelectorAll('.minutes')).toHaveLength(0);
      expect(element.querySelectorAll('section.day button, section.day input')).toHaveLength(0);
      const times = Array.from(element.querySelectorAll('.minutes'));
      expect(times.filter((time) => time.closest('a') !== null)).toEqual([]);
    });

    it('brings back the suggestions with "Shakshuka with bread 30 minutes" when the user clicks "Undo" on a picked "Shakshuka with bread"', async () => {
      await openWith(
        planOf([
          planDay(
            '2026-10-24',
            picked('Shakshuka with bread', [
              'Niçoise salad',
              'Shakshuka with bread',
              'Oven-baked salmon with potatoes and green beans',
            ]),
            picked('Spaghetti carbonara'),
          ),
        ]),
      );
      await click(button(meal(0), 'Undo'));
      expect(suggestionsOf(meal(0)), 'suggestions after "Undo"').toHaveLength(3);
      expect(suggestionsOf(meal(0)).map(textOf)).toContain('Shakshuka with bread 30 minutes');
    });

    it('shows the times of a plan saved without them as soon as it loads, keeps the plan, and saves no time when the user picks', async () => {
      const saved = planOf(
        [
          planDay(
            '2026-10-24',
            picked('Shakshuka with bread'),
            open(
              'Niçoise salad',
              'Oven-baked salmon with potatoes and green beans',
              'Spaghetti carbonara',
            ),
          ),
        ],
        { people: 3 },
      );
      await openWith(saved);
      const name = meal(0).querySelector('p.recipe');
      expect(textOf(name)).toBe('Shakshuka with bread');
      expect(partOf(name?.nextElementSibling)).toEqual(['p.minutes', '30 minutes']);
      expect(store.plan()).toEqual(saved);
      expect(textOf(stepper('People'))).toBe('3');
      expect(suggestionsOf(meal(1)).map(recipeOf)).toEqual([
        'Niçoise salad',
        'Oven-baked salmon with potatoes and green beans',
        'Spaghetti carbonara',
      ]);

      await click(suggestionsOf(meal(1))[0]);
      expect(store.plan().days[0].dinner.recipe, 'dinner not picked').toBe('Niçoise salad');
      expect(localStorage.getItem('fooplan.plan')).not.toMatch(/"minutes"/);
    });

    it('keeps "30 minutes" on a picked "Shakshuka with bread" when the user raises People from 2 to 3', async () => {
      await openWith(
        planOf([
          planDay('2026-10-24', picked('Shakshuka with bread'), picked('Spaghetti carbonara')),
        ]),
      );
      await click(arrow('One more person'));
      expect(textOf(stepper('People'))).toBe('3');
      expect(textOf(meal(0).querySelector('.minutes'))).toBe('30 minutes');
    });

    it('shows a suggestion of the own recipe "Quick Dal" as its span.name alone, read as "Quick Dal", and no time once picked', async () => {
      storeOwnRecipes(QUICK_DAL);
      await openWith(
        planOf([
          planDay(
            '2026-10-24',
            open('Quick Dal', 'Shakshuka with bread', 'Niçoise salad'),
            picked('Spaghetti carbonara'),
          ),
        ]),
      );
      const dal = suggestionsOf(meal(0))[0];
      expect(Array.from(dal.children).map(partOf)).toEqual([['span.name', 'Quick Dal']]);
      expect(dal.textContent).toBe('Quick Dal');

      await click(dal);
      expect(store.plan().days[0].lunch.recipe, '"Quick Dal" not picked').toBe('Quick Dal');
      expect(textOf(meal(0).querySelector('p.recipe'))).toBe('Quick Dal');
      expect(meal(0).querySelector('p.minutes')).toBeNull();
      expect(textOf(meal(0))).not.toMatch(/minutes/);
    });

    // The first day's dinner, "Potato goulash", isn't on the last day; cooked extra, it covers
    // the second day's lunch
    function goulashPlan({ cookExtra, accepted }: { cookExtra: boolean; accepted: boolean }): Plan {
      return planOf(
        [
          planDay(
            '2026-10-24',
            picked('Oven-baked salmon with potatoes and green beans'),
            picked('Potato goulash'),
            cookExtra,
          ),
          planDay(
            '2026-10-25',
            cookExtra ? covered() : picked('Bean burritos'),
            accepted
              ? picked('Niçoise salad')
              : open('Niçoise salad', 'Shakshuka with bread', 'Chickpea and spinach curry'),
          ),
        ],
        { accepted },
      );
    }

    function childrenAfterHeading(article: HTMLElement): [string, string][] {
      const children = Array.from(article.children);
      expect(children[0]?.tagName, 'first child of the meal').toBe('H3');
      return children.slice(1).map(partOf);
    }

    function partOf(node: Element | null | undefined): [string, string] {
      if (!node) {
        return ['(none)', ''];
      }
      const classes = Array.from(node.classList).map((name) => `.${name}`);
      return [node.tagName.toLowerCase() + classes.join(''), textOf(node)];
    }
  });

  describe('"×" to stop suggesting a recipe', () => {
    const SHAKSHUKA_ROW = ['Shakshuka with bread', 'Niçoise salad', 'Chickpea and spinach curry'];
    const SHAKSHUKA_LUNCH = planOf([
      planDay('2026-10-24', open(...SHAKSHUKA_ROW), picked('Spaghetti carbonara')),
    ]);
    const SHAKSHUKA_TWICE = planOf([
      planDay(
        '2026-10-24',
        open(...SHAKSHUKA_ROW),
        open('Fish tacos', 'Shakshuka with bread', 'Potato goulash'),
      ),
    ]);
    const DONT_SUGGEST_TEXT =
      'Another recipe takes its place, and it won\'t be suggested again. "Suggest again" on the Recipes page brings it back.';

    it('shows the suggestion button, the "Recipe" link and a "×" button named "Don\'t suggest Shakshuka with bread" with the title "Don\'t suggest", in this order, in the row of a suggested "Shakshuka with bread"', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const row = suggestionsOf(meal(0))[0].closest<HTMLElement>('div.option');
      expect(row, 'no div.option around the "Shakshuka with bread" suggestion').not.toBeNull();
      expect(
        Array.from(row!.children).map((child) => [child.tagName.toLowerCase(), nameOf(child)]),
      ).toEqual([
        ['button', 'Shakshuka with bread 30 minutes'],
        ['a', 'Recipe for Shakshuka with bread'],
        ['button', "Don't suggest Shakshuka with bread"],
      ]);
      const cross = row!.children[2];
      expect(cross.getAttribute('title')).toBe("Don't suggest");
      const hidden = Array.from(cross.querySelectorAll('[aria-hidden="true"]'));
      expect(hidden.map(textOf)).toEqual(['×']);
    });

    it('gives every suggestion row of an open meal one "×" named after its recipe, and none to a picked meal or a leftovers lunch', async () => {
      await openWith(
        planOf([
          planDay(
            '2026-10-24',
            picked('Chickpea and spinach curry'),
            picked('Potato goulash'),
            true,
          ),
          planDay(
            '2026-10-25',
            covered(),
            open('Niçoise salad', 'Shakshuka with bread', 'Fish tacos'),
          ),
        ]),
      );
      for (const index of [0, 1, 2]) {
        expect(crossesOf(meal(index)), `"×" buttons of meal ${index}`).toEqual([]);
      }
      const rows = Array.from(meal(3).querySelectorAll<HTMLElement>('div.option'));
      expect(rows.map((row) => crossesOf(row).map(nameOf))).toEqual([
        ["Don't suggest Niçoise salad"],
        ["Don't suggest Shakshuka with bread"],
        ["Don't suggest Fish tacos"],
      ]);
      expect(crossesOf(element)).toHaveLength(3);
    });

    it('opens a modal "Don\'t suggest Shakshuka with bread?" dialog with its text and "Keep suggesting", focused, before "Don\'t suggest", without the browser\'s confirm box, keeping the row and removing nothing, when the user clicks "Don\'t suggest Shakshuka with bread"', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      expect(openDialogOrNull(), 'dialog open before the click').toBeNull();
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      expect(modalDialogs.has(dialog), 'opened with showModal()').toBe(true);
      expect(confirm).not.toHaveBeenCalled();
      expect(textOf(dialog.querySelector('h2'))).toBe("Don't suggest Shakshuka with bread?");
      expect(Array.from(dialog.querySelectorAll('p')).map(textOf)).toEqual([DONT_SUGGEST_TEXT]);
      expect(buttonTexts(dialog)).toEqual(['Keep suggesting', "Don't suggest"]);
      expect(document.activeElement).toBe(button(dialog, 'Keep suggesting'));
      expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(SHAKSHUKA_ROW);
      expect(store.removed()).toEqual([]);
    });

    it('builds the "Don\'t suggest" dialog like the "New plan" one: tabindex -1, the heading h2#dont-suggest-title, the text p#dont-suggest-text, and its buttons in a div.actions, "Keep suggesting" .secondary and "Don\'t suggest" .primary without .danger', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      expect(dialog.getAttribute('tabindex')).toBe('-1');
      expect(dialog.querySelector('h2')?.id).toBe('dont-suggest-title');
      expect(dialog.querySelector('p')?.id).toBe('dont-suggest-text');
      const actions = dialog.querySelectorAll('div.actions');
      expect(actions, 'div.actions in the dialog').toHaveLength(1);
      expect(
        Array.from(actions[0].children).map((child) => [
          child.tagName.toLowerCase(),
          textOf(child),
          Array.from(child.classList).sort(),
        ]),
      ).toEqual([
        ['button', 'Keep suggesting', ['secondary']],
        ['button', "Don't suggest", ['primary']],
      ]);
    });

    it('saves nothing while the "Don\'t suggest" dialog is open, and shows the page with the dialog closed and "Shakshuka with bread" still suggested on a reload', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const saved = { ...localStorage };
      await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      expect({ ...localStorage }).toEqual(saved);

      await reload();
      expect(openDialogOrNull()).toBeNull();
      expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(SHAKSHUKA_ROW);
      expect(store.removed()).toEqual([]);
      expect({ ...localStorage }).toEqual(saved);
    });

    it('names the "Don\'t suggest" dialog "Don\'t suggest Shakshuka with bread?" after its heading and describes it by its text', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      expect(labelOf(dialog)).toBe("Don't suggest Shakshuka with bread?");
      expect(textOfIdRefs(dialog, 'aria-describedby')).toBe(DONT_SUGGEST_TEXT);
    });

    it('already heads and names the "Don\'t suggest" dialog "Don\'t suggest Shakshuka with bread?" when it opens, also when reopened from the "Shakshuka with bread" row after "Keep suggesting" in the dialog of "Niçoise salad"', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const showModal = HTMLDialogElement.prototype.showModal;
      const openedAs: [string, string][] = [];
      vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
        this: HTMLDialogElement,
      ) {
        openedAs.push([textOf(this.querySelector('h2')), labelOf(this)]);
        showModal.call(this);
      });
      const first = await openDontSuggestDialog(dontSuggest(meal(0), 'Niçoise salad'));
      await click(button(first, 'Keep suggesting'));
      await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      expect(openedAs).toEqual([
        ["Don't suggest Niçoise salad?", "Don't suggest Niçoise salad?"],
        ["Don't suggest Shakshuka with bread?", "Don't suggest Shakshuka with bread?"],
      ]);
    });

    it('closes, keeps the row with its other suggestions in their places, removes nothing and puts the focus back on "Don\'t suggest Shakshuka with bread" when the user clicks "Keep suggesting", presses Escape or clicks the backdrop', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const before = store.plan();
      const savedRemoved = localStorage.getItem('fooplan.removed');
      const closings: [string, (dialog: HTMLDialogElement) => Promise<unknown>][] = [
        ['"Keep suggesting"', (dialog) => click(button(dialog, 'Keep suggesting'))],
        ['Escape', () => pressKey('Escape')],
        ['backdrop', () => clickBackdrop()],
      ];
      for (const [way, close] of closings) {
        const cross = dontSuggest(meal(0), 'Shakshuka with bread');
        await close(await openDontSuggestDialog(cross));
        expect(openDialogOrNull(), way).toBeNull();
        expect(suggestionsOf(meal(0)).map(recipeOf), way).toEqual(SHAKSHUKA_ROW);
        expect(store.removed(), way).toEqual([]);
        expect(store.plan(), way).toBe(before);
        expect(localStorage.getItem('fooplan.removed'), way).toBe(savedRemoved);
        expect(document.activeElement, `${way}: focus`).toBe(cross);
      }
    });

    it('stays open and removes nothing when the user clicks the heading, the text or the padding of the "Don\'t suggest" dialog, presses inside it and releases on the backdrop, or presses the backdrop and releases inside it', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      // The text sits at 0,0 in jsdom, outside the dialog's box: only the click's target tells it
      // from the backdrop
      for (const node of Array.from(dialog.querySelectorAll<HTMLElement>('h2, p'))) {
        await pressAndRelease(node, { clientX: 0, clientY: 0 });
        expect(openDialogOrNull(), `closed by a click on "${textOf(node)}"`).toBe(dialog);
      }
      await pressAndRelease(dialog, PADDING);
      expect(openDialogOrNull(), 'closed by a click on the padding').toBe(dialog);
      await pressAndRelease(dialog.querySelector('p')!, INSIDE, dialog, OUTSIDE);
      expect(openDialogOrNull(), 'closed by a press inside').toBe(dialog);
      await pressAndRelease(dialog, OUTSIDE, dialog, INSIDE);
      expect(openDialogOrNull(), 'closed by a release inside').toBe(dialog);
      expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(SHAKSHUKA_ROW);
      expect(store.removed()).toEqual([]);
    });

    it('keeps the "Don\'t suggest" dialog open on a click on the backdrop without a press after a press on the backdrop without a click and Escape', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const cross = dontSuggest(meal(0), 'Shakshuka with bread');
      await press(await openDontSuggestDialog(cross), OUTSIDE);
      await pressKey('Escape');
      expect(openDialogOrNull(), 'open after Escape').toBeNull();
      const dialog = await openDontSuggestDialog(cross);
      await release(dialog, OUTSIDE);
      expect(openDialogOrNull()).toBe(dialog);
      expect(store.removed()).toEqual([]);
    });

    it('closes, shows another recipe in the row in place of "Shakshuka with bread" with the two other suggestions unchanged, removes "Shakshuka with bread", keeps the picked dinner and puts the focus on the row\'s "×", named after the new suggestion, when the user clicks "Don\'t suggest" in the dialog of the focused "Don\'t suggest Shakshuka with bread"', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const cross = dontSuggest(meal(0), 'Shakshuka with bread');
      cross.focus();
      await confirmDontSuggest(cross);

      expect(openDialogOrNull()).toBeNull();
      const recipes = suggestionsOf(meal(0)).map(recipeOf);
      expect(recipes).toHaveLength(3);
      expect(recipes[0]).not.toBe('Shakshuka with bread');
      expect(recipes.slice(1)).toEqual(['Niçoise salad', 'Chickpea and spinach curry']);
      expect(store.removed()).toEqual(['Shakshuka with bread']);
      expect(JSON.parse(localStorage.getItem('fooplan.removed') ?? 'null')).toEqual([
        'Shakshuka with bread',
      ]);
      expect(textOf(meal(1).querySelector('p.recipe'))).toBe('Spaghetti carbonara');
      expect(document.activeElement, 'focus after "Don\'t suggest"').toBe(
        dontSuggest(meal(0), recipes[0]),
      );
    });

    it('shows a replacement in the last row of the last day and puts the focus on its "×" when the user confirms from that row', async () => {
      const last = meal(9);
      const before = suggestionsOf(last).map(recipeOf);
      expect(before, 'suggestions of the last dinner').toHaveLength(3);
      await confirmDontSuggest(dontSuggest(last, before[2]));

      const after = suggestionsOf(last).map(recipeOf);
      expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
      expect(after[2]).not.toBe(before[2]);
      expect(store.removed()).toEqual([before[2]]);
      expect(document.activeElement).toBe(dontSuggest(last, after[2]));
    });

    it('keeps the picks and the leftovers when the user confirms "Don\'t suggest Shakshuka with bread"', async () => {
      await openWith(
        planOf([
          planDay('2026-10-24', open(...SHAKSHUKA_ROW), picked('Spaghetti carbonara'), true),
          planDay('2026-10-25', covered(), picked('Potato goulash')),
        ]),
      );
      await confirmDontSuggest(dontSuggest(meal(0), 'Shakshuka with bread'));

      expect(store.removed()).toEqual(['Shakshuka with bread']);
      expect(suggestionsOf(meal(0)).map(recipeOf)).not.toContain('Shakshuka with bread');
      expect(Array.from(element.querySelectorAll('p.recipe')).map(textOf)).toEqual([
        'Spaghetti carbonara',
        'Leftovers: Spaghetti carbonara',
        'Potato goulash',
      ]);
    });

    it('puts the focus on the row\'s "×", named after the new suggestion, when the user confirms "Don\'t suggest" in the dialog of a "Don\'t suggest Shakshuka with bread" clicked without having the focus', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement, 'focus before the click').toBe(document.body);
      await confirmDontSuggest(dontSuggest(meal(0), 'Shakshuka with bread'));

      const replacement = recipeOf(suggestionsOf(meal(0))[0]);
      expect(replacement).not.toBe('Shakshuka with bread');
      expect(document.activeElement).toBe(dontSuggest(meal(0), replacement));
    });

    it('removes every "×" and moves the focus to the row\'s suggestion when the user confirms "Don\'t suggest" from a focused "×" at exactly 16 recipes suggested', async () => {
      leaveSuggested(store, 16);
      await fixture.whenStable();
      const removed = store.removed().length;
      const cross = crossesOf(element)[0];
      expect(cross, 'no "×" button at 16 recipes suggested').toBeDefined();
      const row = cross.closest('div.option')!;
      cross.focus();
      await confirmDontSuggest(cross);
      expect(openDialogOrNull()).toBeNull();
      expect(store.removed()).toHaveLength(removed + 1);
      expect(crossesOf(element), '"×" buttons at 15').toEqual([]);
      expect(document.activeElement).toBe(row.querySelector('button.suggestion'));
    });

    it('also moves the focus to the row\'s suggestion at exactly 16 recipes suggested when the "×" was clicked without having the focus', async () => {
      leaveSuggested(store, 16);
      await fixture.whenStable();
      const cross = crossesOf(element)[0];
      expect(cross, 'no "×" button at 16 recipes suggested').toBeDefined();
      const row = cross.closest('div.option')!;
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement, 'focus before the click').toBe(document.body);
      await confirmDontSuggest(cross);
      expect(crossesOf(element), '"×" buttons at 15').toEqual([]);
      expect(document.activeElement).toBe(row.querySelector('button.suggestion'));
    });

    it('shows a replacement in both rows of a plan suggesting "Shakshuka with bread" in two meals, and puts the focus on the first meal\'s row\'s "×", when the user confirms from the first meal', async () => {
      await openWith(SHAKSHUKA_TWICE);
      await confirmDontSuggest(dontSuggest(meal(0), 'Shakshuka with bread'));

      const lunch = suggestionsOf(meal(0)).map(recipeOf);
      const dinner = suggestionsOf(meal(1)).map(recipeOf);
      expect(lunch[0]).not.toBe('Shakshuka with bread');
      expect(lunch.slice(1)).toEqual(['Niçoise salad', 'Chickpea and spinach curry']);
      expect(dinner[1]).not.toBe('Shakshuka with bread');
      expect([dinner[0], dinner[2]]).toEqual(['Fish tacos', 'Potato goulash']);
      expect(store.removed()).toEqual(['Shakshuka with bread']);
      expect(document.activeElement).toBe(dontSuggest(meal(0), lunch[0]));
    });

    it('puts the focus on the second meal\'s row\'s "×" when the user confirms from the second of two meals suggesting "Shakshuka with bread"', async () => {
      await openWith(SHAKSHUKA_TWICE);
      await confirmDontSuggest(dontSuggest(meal(1), 'Shakshuka with bread'));

      const dinner = suggestionsOf(meal(1)).map(recipeOf);
      expect(dinner[1]).not.toBe('Shakshuka with bread');
      expect(suggestionsOf(meal(0)).map(recipeOf)).not.toContain('Shakshuka with bread');
      expect(document.activeElement).toBe(dontSuggest(meal(1), dinner[1]));
    });

    it('keeps the focus on the two buttons of the "Don\'t suggest" dialog when the user presses Tab or Shift+Tab repeatedly', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      for (const shiftKey of [false, true]) {
        button(dialog, 'Keep suggesting').focus();
        const focused: string[] = [];
        for (let i = 0; i < 4; i++) {
          await pressKey('Tab', shiftKey);
          focused.push(textOf(document.activeElement));
        }
        expect(focused, shiftKey ? 'Shift+Tab' : 'Tab').toEqual([
          "Don't suggest",
          'Keep suggesting',
          "Don't suggest",
          'Keep suggesting',
        ]);
      }
      expect(openDialogOrNull()).toBe(dialog);
      expect(store.removed()).toEqual([]);
    });

    it('moves the focus to "Keep suggesting" on Tab and to "Don\'t suggest" on Shift+Tab after a click on the text of the "Don\'t suggest" dialog', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      const text = dialog.querySelector('p')!;
      for (const [shiftKey, expected] of [
        [false, 'Keep suggesting'],
        [true, "Don't suggest"],
      ] as const) {
        await pressAndRelease(text, INSIDE);
        expect(document.activeElement, 'focus after a click on the text').toBe(dialog);
        await pressKey('Tab', shiftKey);
        expect(textOf(document.activeElement), shiftKey ? 'Shift+Tab' : 'Tab').toBe(expected);
      }
      expect(openDialogOrNull()).toBe(dialog);
    });

    it('moves the focus between the buttons of the "Don\'t suggest" dialog itself on every Tab, as Safari\'s own Tab skips buttons', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      for (const [shiftKey, from, to] of [
        [false, 'Keep suggesting', "Don't suggest"],
        [true, "Don't suggest", 'Keep suggesting'],
      ] as const) {
        const key = shiftKey ? 'Shift+Tab' : 'Tab';
        button(dialog, from).focus();
        expect(await pressKey('Tab', shiftKey), `${key} from "${from}" left to the browser`).toBe(
          true,
        );
        expect(textOf(document.activeElement), key).toBe(to);
      }
    });

    it('heads the dialog "Don\'t suggest Niçoise salad?" when the user clicks "Keep suggesting" in the dialog of "Shakshuka with bread" and then the "×" of the "Niçoise salad" row', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const first = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      await click(button(first, 'Keep suggesting'));
      const dialog = await openDontSuggestDialog(dontSuggest(meal(0), 'Niçoise salad'));
      expect(element.querySelectorAll('dialog[open]'), 'open dialogs').toHaveLength(1);
      expect(textOf(dialog.querySelector('h2'))).toBe("Don't suggest Niçoise salad?");
      expect(labelOf(dialog)).toBe("Don't suggest Niçoise salad?");
    });

    it('removes "Niçoise salad", not "Shakshuka with bread", and puts the focus on the "Niçoise salad" row\'s "×" when the user confirms in the dialog reopened from that row after "Keep suggesting"', async () => {
      await openWith(SHAKSHUKA_LUNCH);
      const first = await openDontSuggestDialog(dontSuggest(meal(0), 'Shakshuka with bread'));
      await click(button(first, 'Keep suggesting'));
      await confirmDontSuggest(dontSuggest(meal(0), 'Niçoise salad'));

      const recipes = suggestionsOf(meal(0)).map(recipeOf);
      expect(store.removed()).toEqual(['Niçoise salad']);
      expect(recipes[0]).toBe('Shakshuka with bread');
      expect(recipes[1]).not.toBe('Niçoise salad');
      expect(recipes[2]).toBe('Chickpea and spinach curry');
      expect(document.activeElement).toBe(dontSuggest(meal(0), recipes[1]));
    });

    it('shows "×" buttons while planning, and no "Don\'t suggest" button once the plan is accepted or on a picked meal and a leftovers lunch', async () => {
      expect(crossesOf(element).length, '"×" buttons while planning').toBeGreaterThan(0);
      await acceptOneDayPlan();
      expect(store.plan().accepted, 'plan not accepted').toBe(true);
      expect(crossesOf(element), 'accepted plan').toEqual([]);

      await openWith(
        planOf([
          planDay(
            '2026-10-24',
            picked('Chickpea and spinach curry'),
            picked('Potato goulash'),
            true,
          ),
          planDay(
            '2026-10-25',
            covered(),
            open('Niçoise salad', 'Shakshuka with bread', 'Fish tacos'),
          ),
        ]),
      );
      for (const index of [0, 1, 2]) {
        expect(crossesOf(meal(index)), `"×" buttons of meal ${index}`).toEqual([]);
      }
    });

    // The "×" buttons of the rows, not the "Don't suggest" button of the dialog
    function crossesOf(root: HTMLElement): HTMLButtonElement[] {
      return Array.from(root.querySelectorAll('button')).filter(
        (candidate) =>
          !candidate.closest('dialog') && nameOf(candidate).startsWith("Don't suggest"),
      );
    }

    function dontSuggest(root: HTMLElement, recipe: string): HTMLButtonElement {
      const found = crossesOf(root).filter((cross) => nameOf(cross) === `Don't suggest ${recipe}`);
      expect(found, `"Don't suggest ${recipe}" buttons`).toHaveLength(1);
      return found[0];
    }

    async function confirmDontSuggest(cross: HTMLButtonElement) {
      const dialog = await openDontSuggestDialog(cross);
      await click(button(dialog, "Don't suggest"));
    }

    // Stubs the box of the dialog the click opened, as the "New plan" dialog tests do
    async function openDontSuggestDialog(cross: HTMLButtonElement): Promise<HTMLDialogElement> {
      await click(cross);
      const dialog = openDialog();
      vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(BOX);
      return dialog;
    }
  });

  describe('"Kid-friendly" checkbox', () => {
    const NOTE =
      "Fewer than 15 kid-friendly recipes are suggested, so the plan can't be kid-friendly.";

    it('shows the heading "Plan", the Days stepper, the People stepper, an enabled unchecked checkbox named "Kid-friendly" and "New plan" in the toolbar, in this order, and no note; checks it when the user presses Space on it, keeping the focus on it, suggests none of the 11 recipes that are not kid-friendly and saves the plan as kid-friendly', async () => {
      const toolbar = element.querySelector<HTMLElement>('div.toolbar');
      expect(toolbar, 'no toolbar').not.toBeNull();
      const checkbox = kidFriendly();
      const controls = [
        toolbar!.querySelector('h1')!,
        stepper('Days'),
        stepper('People'),
        checkbox,
        button(toolbar!, 'New plan'),
      ];
      expect(textOf(controls[0])).toBe('Plan');
      expect(
        controls.filter((control) => !toolbar!.contains(control)),
        'outside the toolbar',
      ).toEqual([]);
      controls.slice(1).forEach((control, i) => {
        expect(follows(control, controls[i]), `control ${i + 1} after control ${i}`).toBe(true);
      });
      expect(checkbox.type).toBe('checkbox');
      expect(textOf(checkbox.closest('label.kid-friendly'))).toBe('Kid-friendly');
      expect(checkbox.checked).toBe(false);
      expect(checkbox.disabled).toBe(false);
      expect(element.querySelector('p.note')).toBeNull();

      await pressSpace(checkbox);
      expect(kidFriendly().checked).toBe(true);
      expect(document.activeElement).toBe(kidFriendly());
      expect(store.plan().kidFriendly).toBe(true);
      expectNoStrongFlavours('turned on');
      expect(JSON.parse(localStorage.getItem('fooplan.plan') ?? 'null')).toMatchObject({
        kidFriendly: true,
      });
    });

    it('suggests none of the 11 recipes that are not kid-friendly with kid-friendly on when the user clicks "Other suggestions", raises Days from 2 to 3, picks a suggestion and clicks "Undo" on a meal that showed "Penne arrabbiata"', async () => {
      await openWith(
        planOf(
          [
            planDay(
              '2026-10-24',
              picked('Mac and cheese', [
                'Penne arrabbiata',
                'Mac and cheese',
                'Spaghetti pomodoro',
              ]),
              open('Spaghetti carbonara', 'Potato goulash', 'Tuna pasta bake'),
            ),
            planDay(
              '2026-10-25',
              open('Fish tacos', 'Shakshuka with bread', 'Greek salad with feta and bread'),
              open('Chicken curry with rice', 'Teriyaki chicken with rice', 'Fish tacos'),
            ),
          ],
          { kidFriendly: false },
        ),
      );
      await click(kidFriendly());
      expect(store.plan().kidFriendly, 'not turned on').toBe(true);

      await click(button(meal(1), 'Other suggestions'));
      expectNoStrongFlavours('"Other suggestions"');
      await click(arrow('One more day'));
      expect(days(), 'days').toHaveLength(3);
      expectNoStrongFlavours('3 days');
      await pickFirstSuggestion(1);
      expectNoStrongFlavours('picked');
      await click(button(meal(0), 'Undo'));
      expect(suggestionsOf(meal(0)), 'lunch not reopened').toHaveLength(3);
      expectNoStrongFlavours('"Undo"');
    });

    it('shows "×" buttons with kid-friendly on while 16 kid-friendly recipes are suggested, none once the user removes one and 15 are left, and the "×" buttons again when the user unticks "Kid-friendly"', async () => {
      leaveSuggested(store, 27, ...KID_FRIENDLY.slice(0, 16), ...NOT_KID_FRIENDLY);
      await fixture.whenStable();
      await click(kidFriendly());
      expect(crosses().length, '"×" buttons at 16 kid-friendly suggested').toBeGreaterThan(0);

      await click(crosses()[0]);
      await click(button(openDialog(), "Don't suggest"));
      expect(KID_FRIENDLY.filter((name) => !store.removed().includes(name))).toHaveLength(15);
      expect(crosses(), '"×" buttons at 15 kid-friendly suggested').toEqual([]);
      expect(store.canRemove()).toBe(false);

      await click(kidFriendly());
      expect(kidFriendly().checked, 'still checked').toBe(false);
      expect(store.canRemove()).toBe(true);
      expect(crosses().length, '"×" buttons once off').toBeGreaterThan(0);
    });

    it('disables the checkbox, described by p.note#kid-friendly-note between the toolbar and the days, while kid-friendly is off and 14 kid-friendly recipes are suggested, enables it without the note once one is brought back, and keeps it enabled once the user ticks it with 15 suggested', async () => {
      leaveSuggested(store, 25, ...KID_FRIENDLY.slice(0, 14), ...NOT_KID_FRIENDLY);
      await fixture.whenStable();
      expect(kidFriendly().disabled).toBe(true);
      expect(kidFriendly().getAttribute('aria-describedby')).toBe('kid-friendly-note');
      const note = element.querySelector('p.note#kid-friendly-note');
      expect(note, 'no note').not.toBeNull();
      expect(textOf(note)).toBe(NOTE);
      expect(element.querySelector('div.toolbar')!.nextElementSibling, 'after the toolbar').toBe(
        note,
      );
      expect(note!.nextElementSibling, 'before the days').toBe(element.querySelector('.days'));

      store.restoreRecipe(KID_FRIENDLY[14]);
      await fixture.whenStable();
      expect(kidFriendly().disabled, 'disabled at 15').toBe(false);
      expect(element.querySelector('#kid-friendly-note'), 'note at 15').toBeNull();

      await click(kidFriendly());
      expect(kidFriendly().checked, 'not checked').toBe(true);
      expect(kidFriendly().disabled, 'disabled once on').toBe(false);
    });

    it('shows "1 day for 2 people, kid-friendly" and no checkbox once the user accepts a complete 1-day plan with kid-friendly on, and "1 day for 2 people" with it off', async () => {
      await click(kidFriendly());
      await acceptOneDayPlan();
      expect(store.plan().accepted, 'not accepted').toBe(true);
      expect(textOf(element.querySelector('.summary'))).toBe('1 day for 2 people, kid-friendly');
      expect(element.querySelector('#kid-friendly')).toBeNull();

      localStorage.clear();
      await reload();
      await acceptOneDayPlan();
      expect(textOf(element.querySelector('.summary'))).toBe('1 day for 2 people');
    });

    it('says "The new plan starts today, for 5 days and 2 people, kid-friendly." in the "New plan" dialog with kid-friendly on and a picked meal, and starts the new plan kid-friendly, checked and without the 11 recipes that are not kid-friendly; says "… for 5 days and 2 people." with it off and starts the new plan not kid-friendly', async () => {
      await click(kidFriendly());
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      expect(textOf(openDialog().querySelector('#new-plan-next'))).toBe(
        'The new plan starts today, for 5 days and 2 people, kid-friendly.',
      );
      await click(button(openDialog(), 'Start new plan'));
      expect(openDialogOrNull(), 'dialog still open').toBeNull();
      expect(store.plan().kidFriendly).toBe(true);
      expect(kidFriendly().checked).toBe(true);
      expectNoStrongFlavours('new plan');

      await click(kidFriendly());
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      expect(textOf(openDialog().querySelector('#new-plan-next'))).toBe(
        'The new plan starts today, for 5 days and 2 people.',
      );
      await click(button(openDialog(), 'Start new plan'));
      expect(store.plan().kidFriendly).toBe(false);
    });

    it('replaces "Penne arrabbiata" suggested by a saved kid-friendly plan with a kid-friendly recipe when the page opens and saves the plan, and keeps it for a saved plan that is not kid-friendly', async () => {
      const savedDays = [
        planDay(
          '2026-10-24',
          open('Penne arrabbiata', 'Spaghetti pomodoro', 'Mac and cheese'),
          picked('Spaghetti carbonara'),
        ),
      ];
      localStorage.setItem(
        'fooplan.plan',
        JSON.stringify(planOf(savedDays, { kidFriendly: true })),
      );
      await reload();
      const shown = suggestionsOf(meal(0)).map(recipeOf);
      expect(KID_FRIENDLY).toContain(shown[0]);
      expect(shown.slice(1)).toEqual(['Spaghetti pomodoro', 'Mac and cheese']);
      expect(
        JSON.parse(localStorage.getItem('fooplan.plan') ?? 'null').days[0].lunch.suggestions,
        'not saved',
      ).toEqual(shown);

      const notKidFriendly = JSON.stringify(planOf(savedDays, { kidFriendly: false }));
      localStorage.setItem('fooplan.plan', notKidFriendly);
      await reload();
      expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual([
        'Penne arrabbiata',
        'Spaghetti pomodoro',
        'Mac and cheese',
      ]);
      expect(localStorage.getItem('fooplan.plan')).toBe(notKidFriendly);
    });

    describe('edge cases', () => {
      it('keeps the dinner picked as "Pad thai with chicken" when the user ticks "Kid-friendly", and every suggestion when the user unticks it', async () => {
        await openWith(
          planOf(
            [
              planDay(
                '2026-10-24',
                open('Penne arrabbiata', 'Spaghetti pomodoro', 'Mac and cheese'),
                picked('Pad thai with chicken'),
              ),
            ],
            { kidFriendly: false },
          ),
        );
        await click(kidFriendly());
        expect(kidFriendly().checked, 'not checked').toBe(true);
        expect(textOf(meal(1).querySelector('p.recipe')), 'ticked').toBe('Pad thai with chicken');
        const shown = suggestionsOf(meal(0)).map(recipeOf);

        await click(kidFriendly());
        expect(kidFriendly().checked, 'still checked').toBe(false);
        expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(shown);
        expect(textOf(meal(1).querySelector('p.recipe')), 'unticked').toBe('Pad thai with chicken');
      });

      it('gives the enabled checkbox no aria-describedby and shows no note on a fresh plan, nor with exactly 15 kid-friendly recipes suggested while kid-friendly is off', async () => {
        for (const step of ['fresh plan', '15 kid-friendly suggested']) {
          if (step !== 'fresh plan') {
            leaveSuggested(store, 26, ...KID_FRIENDLY.slice(0, 15), ...NOT_KID_FRIENDLY);
            await fixture.whenStable();
          }
          expect(kidFriendly().disabled, step).toBe(false);
          expect(kidFriendly().hasAttribute('aria-describedby'), step).toBe(false);
          expect(element.querySelector('#kid-friendly-note'), step).toBeNull();
        }
      });

      it('opens a saved kid-friendly plan with the checkbox unchecked and disabled and the note shown while only 14 kid-friendly recipes are suggested', async () => {
        localStorage.setItem('fooplan.removed', JSON.stringify(KID_FRIENDLY.slice(14)));
        const saved = planOf(
          [
            planDay(
              '2026-10-24',
              open(...KID_FRIENDLY.slice(0, 3)),
              open(...KID_FRIENDLY.slice(3, 6)),
            ),
          ],
          { kidFriendly: true },
        );
        localStorage.setItem('fooplan.plan', JSON.stringify(saved));
        await reload();

        expect(store.plan(), 'saved plan not loaded').toEqual({ ...saved, kidFriendly: false });
        expect(kidFriendly().checked, 'unchecked').toBe(false);
        expect(kidFriendly().disabled, 'disabled').toBe(true);
        expect(kidFriendly().getAttribute('aria-describedby')).toBe('kid-friendly-note');
        expect(textOf(element.querySelector('p.note#kid-friendly-note'))).toBe(NOTE);
      });

      it('shows neither the checkbox nor the note once the user accepts a plan that is not kid-friendly while 14 kid-friendly recipes are suggested', async () => {
        leaveSuggested(store, 25, ...KID_FRIENDLY.slice(0, 14), ...NOT_KID_FRIENDLY);
        await fixture.whenStable();
        expect(kidFriendly().disabled, 'disabled before accepting').toBe(true);

        await acceptOneDayPlan();
        expect(store.plan().accepted, 'not accepted').toBe(true);
        expect(element.querySelector('#kid-friendly')).toBeNull();
        expect(element.querySelector('#kid-friendly-note')).toBeNull();
      });

      it('says "The new plan starts today, for 5 days and 2 people." in the "New plan" dialog of a saved accepted kid-friendly plan while only 14 kid-friendly recipes are suggested, and starts the new plan not kid-friendly', async () => {
        localStorage.setItem('fooplan.removed', JSON.stringify(KID_FRIENDLY.slice(14)));
        await openWith(
          planOf([planDay('2026-10-24', picked('Spaghetti pomodoro'), picked('Mac and cheese'))], {
            accepted: true,
            kidFriendly: true,
          }),
        );
        expect(textOf(element.querySelector('.summary'))).toBe('1 day for 2 people, kid-friendly');

        await click(button(element, 'New plan'));
        expect(textOf(openDialog().querySelector('#new-plan-next'))).toBe(
          'The new plan starts today, for 5 days and 2 people.',
        );
        await click(button(openDialog(), 'Start new plan'));
        expect(store.plan().kidFriendly).toBe(false);
      });
    });

    function kidFriendly(): HTMLInputElement {
      const found = element.querySelector<HTMLInputElement>('input#kid-friendly');
      expect(found, 'no #kid-friendly checkbox').not.toBeNull();
      return found!;
    }

    function crosses(): HTMLButtonElement[] {
      return Array.from(element.querySelectorAll<HTMLButtonElement>('button.dont-suggest'));
    }

    function expectNoStrongFlavours(step: string) {
      const shown = Array.from(element.querySelectorAll<HTMLButtonElement>('button.suggestion'));
      expect(
        shown.map(recipeOf).filter((name) => NOT_KID_FRIENDLY.includes(name)),
        step,
      ).toEqual([]);
    }

    // jsdom gives Space on a checkbox no default action, so the toggle and its change event, which
    // the browser fires, are fired here
    async function pressSpace(checkbox: HTMLInputElement) {
      checkbox.focus();
      checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      checkbox.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
    }
  });

  describe('"Eat out"', () => {
    const SHAKSHUKA_ROW = ['Shakshuka with bread', 'Niçoise salad', 'Chickpea and spinach curry'];
    const OPEN_MEAL = [
      'h3',
      'div.option',
      'div.option',
      'div.option',
      'button.link "Other suggestions"',
      'button.link "Eat out"',
    ];
    const EATING_OUT = ['h3', 'p.recipe', 'button.link "Undo"'];

    it('ends the article of an open meal with "Other suggestions" and then "Eat out", in this order after its three div.option rows, and shows no "Eat out" on a picked meal, a leftovers lunch or any meal of an accepted plan', async () => {
      await openWith(
        planOf([
          planDay('2026-10-24', picked('Spaghetti carbonara'), picked('Potato goulash'), true),
          planDay('2026-10-25', covered(), open(...SHAKSHUKA_ROW)),
        ]),
      );
      expect(shapesOf(meal(3))).toEqual(OPEN_MEAL);
      expect(button(meal(3), 'Eat out').getAttribute('type')).toBe('button');
      for (const index of [0, 1, 2]) {
        expect(buttonTexts(meal(index)), `meal ${index}`).not.toContain('Eat out');
      }

      await openWith(
        planOf([planDay('2026-10-24', picked('Spaghetti carbonara'), picked('Potato goulash'))], {
          accepted: true,
        }),
      );
      expect(buttonTexts()).not.toContain('Eat out');
    });

    it('shows, in this order, a p.recipe "Eating out" without a link and "Undo", and nothing else, and stores the lunch eating out with its three suggestions as offered, when the user clicks "Eat out" on an open lunch', async () => {
      await openWith(
        planOf([planDay('2026-10-24', open(...SHAKSHUKA_ROW), picked('Spaghetti carbonara'))]),
      );
      await click(button(meal(0), 'Eat out'));
      expect(shapesOf(meal(0))).toEqual(EATING_OUT);
      const recipe = meal(0).querySelector('p.recipe');
      expect(textOf(recipe)).toBe('Eating out');
      expect(recipe!.querySelector('a')).toBeNull();
      expect(meal(0).querySelector('p.minutes')).toBeNull();
      expect(meal(0).querySelector('label.cook-extra')).toBeNull();
      expect(store.plan().days[0].lunch).toStrictEqual(eatingOut(SHAKSHUKA_ROW));
    });

    it('shows "Eating out" and "Undo" and no "Cook extra for tomorrow\'s lunch" when the user clicks "Eat out" on the open dinner of day 1 of a two-day plan', async () => {
      await openWith(
        planOf([
          planDay('2026-10-24', picked('Spaghetti carbonara'), open(...SHAKSHUKA_ROW)),
          planDay(
            '2026-10-25',
            open('Fish tacos', 'Potato goulash', 'Penne arrabbiata'),
            open('Mac and cheese', 'Bean burritos', 'Chicken quesadillas'),
          ),
        ]),
      );
      await click(button(meal(1), 'Eat out'));
      expect(shapesOf(meal(1))).toEqual(EATING_OUT);
      expect(textOf(meal(1).querySelector('p.recipe'))).toBe('Eating out');
      expect(meal(1).querySelector('label.cook-extra')).toBeNull();
      expect(textOf(meal(1))).not.toContain("Cook extra for tomorrow's lunch");
    });

    it('shows the three suggestions the lunch showed before "Eat out", in their order, "Other suggestions" and "Eat out" when the user clicks "Undo" on it', async () => {
      await openWith(
        planOf([planDay('2026-10-24', open(...SHAKSHUKA_ROW), picked('Spaghetti carbonara'))]),
      );
      await click(button(meal(0), 'Eat out'));
      await click(button(meal(0), 'Undo'));
      expect(shapesOf(meal(0))).toEqual(OPEN_MEAL);
      expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(SHAKSHUKA_ROW);
    });

    it('enables "Accept plan" for a one-day plan with the lunch eating out once the dinner is picked, not before, and shows "1 day for 2 people" and the lunch as "Eating out" alone once the user accepts it', async () => {
      await openWith(
        planOf([
          planDay(
            '2026-10-24',
            open(...SHAKSHUKA_ROW),
            open('Fish tacos', 'Potato goulash', 'Penne arrabbiata'),
          ),
        ]),
      );
      await click(button(meal(0), 'Eat out'));
      expect(button(element, 'Accept plan').disabled, 'dinner open').toBe(true);
      await click(suggestionsOf(meal(1))[0]);
      expect(button(element, 'Accept plan').disabled, 'dinner picked').toBe(false);

      await click(button(element, 'Accept plan'));
      expect(textOf(element.querySelector('p.summary'))).toBe('1 day for 2 people');
      expect(shapesOf(meal(0))).toEqual(['h3', 'p.recipe']);
      expect(textOf(meal(0).querySelector('p.recipe'))).toBe('Eating out');
    });

    it('shows "Leftovers: Potato goulash" without "Undo" or "Eat out" for a lunch eating out when the user ticks "Cook extra" on the dinner before it, and three suggestion rows, "Other suggestions" and "Eat out" when the user unticks it', async () => {
      await openWith(
        planOf([
          planDay('2026-10-24', picked('Spaghetti carbonara'), picked('Potato goulash')),
          planDay(
            '2026-10-25',
            open(...SHAKSHUKA_ROW),
            open('Fish tacos', 'Penne arrabbiata', 'Mac and cheese'),
          ),
        ]),
      );
      await click(button(meal(2), 'Eat out'));
      await setCookExtra(0, true);
      expect(textOf(meal(2).querySelector('p.recipe'))).toBe('Leftovers: Potato goulash');
      expect(buttonTexts(meal(2))).toEqual([]);

      await setCookExtra(0, false);
      expect(shapesOf(meal(2))).toEqual(OPEN_MEAL);
      expect(store.plan().days[1].lunch.eatOut).toBeUndefined();
    });

    describe('edge cases', () => {
      it('still shows the lunch eating out with "Undo" after a reload', async () => {
        await openWith(
          planOf([planDay('2026-10-24', open(...SHAKSHUKA_ROW), picked('Spaghetti carbonara'))]),
        );
        await click(button(meal(0), 'Eat out'));
        await reload();
        expect(shapesOf(meal(0))).toEqual(EATING_OUT);
        expect(textOf(meal(0).querySelector('p.recipe'))).toBe('Eating out');
        expect(store.plan().days[0].lunch).toStrictEqual(eatingOut(SHAKSHUKA_ROW));
      });

      it('shows the three suggestions a saved lunch eating out showed, in their order, when the user clicks "Undo" after a reload', async () => {
        await openWith(
          planOf([planDay('2026-10-24', eatingOut(SHAKSHUKA_ROW), picked('Spaghetti carbonara'))]),
        );
        await click(button(meal(0), 'Undo'));
        expect(shapesOf(meal(0))).toEqual(OPEN_MEAL);
        expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(SHAKSHUKA_ROW);
      });
    });

    // The tag, the classes and, for a button, its text of each child, in their order
    function shapesOf(article: HTMLElement): string[] {
      return Array.from(article.children).map((child) => {
        const shape = [child.tagName.toLowerCase(), ...Array.from(child.classList)].join('.');
        return child.tagName === 'BUTTON' ? `${shape} "${textOf(child)}"` : shape;
      });
    }
  });

  describe('"New plan" dialog', () => {
    beforeEach(() => {
      const dialog = element.querySelector('dialog[aria-labelledby="new-plan-title"]');
      expect(dialog, 'no dialog').not.toBeNull();
      vi.spyOn(dialog!, 'getBoundingClientRect').mockReturnValue(BOX);
    });

    it('opens a modal "Start a new plan?" dialog with "Keep this plan" and "Start new plan", without the browser\'s confirm box, for a plan with a picked meal', async () => {
      await pickFirstSuggestion(0);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      expect(openDialogOrNull(), 'dialog open before "New plan"').toBeNull();
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      expect(modalDialogs.has(dialog), 'opened with showModal()').toBe(true);
      expect(confirm).not.toHaveBeenCalled();
      expect(textOf(dialog.querySelector('h1, h2, h3'))).toBe('Start a new plan?');
      expect(buttonTexts(dialog).sort()).toEqual(['Keep this plan', 'Start new plan']);
    });

    it('names the dialog "Start a new plan?" after its title', async () => {
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      expect(labelOf(openDialog())).toBe('Start a new plan?');
    });

    it('says the dates and "3 of 10 meals picked" for an unaccepted 5-day plan with 3 picked meals, and nothing about acceptance, ticks or added items', async () => {
      for (const index of [0, 1, 2]) {
        await pickFirstSuggestion(index);
      }
      await click(button(element, 'New plan'));
      const lost = lostParagraph();
      expect(lost).toContain('Sat 24 Oct – Wed 28 Oct');
      expect(lost).toContain('3 of 10 meals picked');
      const text = textOf(openDialog());
      expect(text).not.toMatch(/accepted/i);
      expect(text).not.toMatch(/tick/i);
      expect(text).not.toMatch(/added/i);
    });

    it('says the single date and "1 of 2 meals picked" for a 1-day plan', async () => {
      await setDays(1);
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      const lost = lostParagraph();
      expect(lost).toContain('Sat 24 Oct');
      expect(lost).not.toContain('–');
      expect(lost).toContain('1 of 2 meals picked');
    });

    it('also says "This plan is accepted", "Your grocery list ticks will be cleared" and "Your added grocery items will be removed" for an accepted plan with ticks and added items', async () => {
      await acceptOneDayPlan();
      store.toggleTicked(itemKey(groceryList(store.plan(), RECIPES)[0]));
      store.addItem('Toilet paper');
      await fixture.whenStable();
      await click(button(element, 'New plan'));
      const lost = lostParagraph();
      expect(lost).toContain('This plan is accepted');
      expect(lost).toContain('Your grocery list ticks will be cleared');
      expect(lost).toContain('Your added grocery items will be removed');
    });

    it('says "This plan is accepted" but nothing about ticks or added items for an accepted plan with neither', async () => {
      await acceptOneDayPlan();
      await click(button(element, 'New plan'));
      expect(lostParagraph()).toContain('This plan is accepted');
      const text = textOf(openDialog());
      expect(text).not.toMatch(/tick/i);
      expect(text).not.toMatch(/added/i);
    });

    it('says "Your added grocery items will be removed" but nothing about ticks for an accepted plan with an added item and no ticks', async () => {
      await acceptOneDayPlan();
      store.addItem('Toilet paper');
      await fixture.whenStable();
      await click(button(element, 'New plan'));
      expect(lostParagraph()).toContain('Your added grocery items will be removed');
      expect(textOf(openDialog())).not.toMatch(/tick/i);
    });

    it('says the new plan starts today for the default 5 days and the current people, with the focus on "Keep this plan"', async () => {
      await setDays(3);
      await setPeople(3);
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      expect(textOf(dialog)).toContain('The new plan starts today, for 5 days and 3 people');
      expect(document.activeElement).toBe(button(dialog, 'Keep this plan'));
    });

    it('says "1 person" in the singular for a plan for 1 person', async () => {
      await setPeople(1);
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      expect(textOf(openDialog())).toContain('The new plan starts today, for 5 days and 1 person');
    });

    it('closes, keeps the plan and puts the focus back on "New plan" when the user clicks "Keep this plan"', async () => {
      await expectKept(() => click(button(openDialog(), 'Keep this plan')));
    });

    it('closes, keeps the plan and puts the focus back on "New plan" when the user presses Escape', async () => {
      await expectKept(() => pressKey('Escape'));
    });

    it('closes, keeps the plan and puts the focus back on "New plan" when the user clicks the backdrop', async () => {
      await expectKept(() => clickBackdrop());
    });

    it("stays open and keeps the plan when the user clicks the dialog's title or text", async () => {
      await pickFirstSuggestion(0);
      const before = store.plan();
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      // The text sits at 0,0 in jsdom, outside the dialog's box: only the click's target tells it
      // from the backdrop
      for (const node of Array.from(dialog.querySelectorAll<HTMLElement>('h1, h2, h3, p'))) {
        await pressAndRelease(node, { clientX: 0, clientY: 0 });
        expect(openDialogOrNull(), `closed by a click on "${textOf(node)}"`).toBe(dialog);
      }
      expect(store.plan()).toBe(before);
    });

    it("stays open and keeps the plan when the user clicks the dialog's padding", async () => {
      await pickFirstSuggestion(0);
      const before = store.plan();
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      await pressAndRelease(dialog, PADDING);
      expect(openDialogOrNull()).toBe(dialog);
      expect(store.plan()).toBe(before);
    });

    it('stays open and keeps the plan when the user presses inside the dialog and releases on the backdrop', async () => {
      await pickFirstSuggestion(0);
      const before = store.plan();
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      await pressAndRelease(dialog.querySelector('p')!, INSIDE, dialog, OUTSIDE);
      expect(openDialogOrNull()).toBe(dialog);
      expect(store.plan()).toBe(before);
    });

    it('stays open and keeps the plan when the user presses the backdrop and releases inside the dialog', async () => {
      await pickFirstSuggestion(0);
      const before = store.plan();
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      await pressAndRelease(dialog, OUTSIDE, dialog, INSIDE);
      expect(openDialogOrNull()).toBe(dialog);
      expect(store.plan()).toBe(before);
    });

    it('stays open on a click on the backdrop without a press after a press on the backdrop without a click and Escape', async () => {
      await pickFirstSuggestion(0);
      const before = store.plan();
      await click(button(element, 'New plan'));
      await press(openDialog(), OUTSIDE);
      await pressKey('Escape');
      expect(openDialogOrNull()).toBeNull();
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      await release(dialog, OUTSIDE);
      expect(openDialogOrNull()).toBe(dialog);
      expect(store.plan()).toBe(before);
    });

    it('closes and shows an empty 5-day plan from today for the same people, with no ticks or added items, when the user clicks "Start new plan" on an accepted plan', async () => {
      await setPeople(3);
      await acceptOneDayPlan();
      store.toggleTicked(itemKey(groceryList(store.plan(), RECIPES)[0]));
      store.addItem('Toilet paper');
      await fixture.whenStable();
      await click(button(element, 'New plan'));
      today = '2026-10-26';
      await click(button(openDialog(), 'Start new plan'));
      expect(openDialogOrNull()).toBeNull();
      expectEmptyPlanFrom26Oct();
      expect(textOf(stepper('People'))).toBe('3');
      expect(store.plan()).toMatchObject({ people: 3, accepted: false, ticked: [], added: [] });
      expect(button(element, 'Accept plan').disabled).toBe(true);
    });

    it('starts an empty 5-day plan from today for the same people when the user clicks "Start new plan" on a plan in progress', async () => {
      await setDays(3);
      await setPeople(4);
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      today = '2026-10-26';
      await click(button(openDialog(), 'Start new plan'));
      expect(openDialogOrNull()).toBeNull();
      expectEmptyPlanFrom26Oct();
      expect(textOf(stepper('People'))).toBe('4');
    });

    it("starts the new plan right away, without the dialog or the browser's confirm box, for an unaccepted plan with no filled meal", async () => {
      await setDays(3);
      await setPeople(4);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
      today = '2026-10-26';
      await click(button(element, 'New plan'));
      expect(openDialogOrNull()).toBeNull();
      expect(showModal).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expectEmptyPlanFrom26Oct();
      expect(textOf(stepper('People'))).toBe('4');
    });

    it('says "5 of 10 meals picked" for a 5-day plan with 2 picked meals and 3 eating out, and starts a plan with every meal open with three suggestions when the user clicks "Start new plan"', async () => {
      await pickFirstSuggestion(0);
      await pickFirstSuggestion(1);
      for (const index of [2, 3, 4]) {
        await click(button(meal(index), 'Eat out'));
      }
      await click(button(element, 'New plan'));
      expect(lostParagraph()).toContain('5 of 10 meals picked');

      today = '2026-10-26';
      await click(button(openDialog(), 'Start new plan'));
      expectEmptyPlanFrom26Oct();
      expect(textOf(element.querySelector('.days'))).not.toContain('Eating out');
      const meals = store.plan().days.flatMap((planned) => [planned.lunch, planned.dinner]);
      expect(meals.filter((planned) => planned.eatOut !== undefined)).toEqual([]);
    });

    describe('edge cases', () => {
      it('opens the dialog with "1 of 10 meals picked" for an unaccepted plan whose only filled meal is eating out', async () => {
        await click(button(meal(0), 'Eat out'));
        await click(button(element, 'New plan'));
        expect(lostParagraph()).toContain('1 of 10 meals picked');
      });
    });

    it('keeps the focus on the two buttons when the user presses Tab or Shift+Tab repeatedly', async () => {
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      for (const shiftKey of [false, true]) {
        button(dialog, 'Keep this plan').focus();
        const focused: string[] = [];
        for (let i = 0; i < 4; i++) {
          await pressKey('Tab', shiftKey);
          focused.push(textOf(document.activeElement));
        }
        expect(focused, shiftKey ? 'Shift+Tab' : 'Tab').toEqual([
          'Start new plan',
          'Keep this plan',
          'Start new plan',
          'Keep this plan',
        ]);
      }
      expect(openDialogOrNull()).toBe(dialog);
    });

    it("moves the focus to the first button on Tab and to the last on Shift+Tab after a click on the dialog's text", async () => {
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      const text = dialog.querySelector('p')!;
      for (const [shiftKey, expected] of [
        [false, 'Keep this plan'],
        [true, 'Start new plan'],
      ] as const) {
        await pressAndRelease(text, INSIDE);
        expect(document.activeElement, 'focus after a click on the text').toBe(dialog);
        await pressKey('Tab', shiftKey);
        expect(textOf(document.activeElement), shiftKey ? 'Shift+Tab' : 'Tab').toBe(expected);
      }
      expect(openDialogOrNull()).toBe(dialog);
    });

    it("moves the focus between the buttons itself on every Tab, as Safari's own Tab skips buttons", async () => {
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      for (const [shiftKey, from, to] of [
        [false, 'Keep this plan', 'Start new plan'],
        [true, 'Start new plan', 'Keep this plan'],
      ] as const) {
        const key = shiftKey ? 'Shift+Tab' : 'Tab';
        button(dialog, from).focus();
        expect(await pressKey('Tab', shiftKey), `${key} from "${from}" left to the browser`).toBe(
          true,
        );
        expect(textOf(document.activeElement), key).toBe(to);
      }
    });

    async function expectKept(keep: () => Promise<unknown>) {
      await setDays(3);
      await pickFirstSuggestion(0);
      const before = store.plan();
      const shown = textOf(element.querySelector('.days'));
      await click(button(element, 'New plan'));
      await keep();
      expect(openDialogOrNull()).toBeNull();
      expect(store.plan()).toBe(before);
      expect(textOf(element.querySelector('.days'))).toBe(shown);
      expect(textOf(stepper('Days'))).toBe('3');
      expect(document.activeElement).toBe(button(element, 'New plan'));
    }

    function expectEmptyPlanFrom26Oct() {
      expect(days().map((day) => textOf(day.querySelector('h2')))).toEqual([
        'Mon 26 Oct',
        'Tue 27 Oct',
        'Wed 28 Oct',
        'Thu 29 Oct',
        'Fri 30 Oct',
      ]);
      expect(textOf(stepper('Days'))).toBe('5');
      expect(element.querySelectorAll('p.recipe')).toHaveLength(0);
      for (const article of Array.from(element.querySelectorAll<HTMLElement>('article.meal'))) {
        expect(suggestionsOf(article)).toHaveLength(3);
      }
    }

    function lostParagraph(): string {
      const paragraphs = Array.from(openDialog().querySelectorAll('p')).map(textOf);
      const lost = paragraphs.find((text) => text.includes('Sat 24 Oct'));
      expect(
        lost,
        `no paragraph with the plan's dates in ${JSON.stringify(paragraphs)}`,
      ).toBeDefined();
      return lost!;
    }
  });

  describe('today and past days', () => {
    const NAMES = RECIPES.map((recipe) => recipe.name);
    const AROUND_TODAY = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
    const AROUND_TODAY_MARKS = [
      'Fri 23 Oct past',
      'Sat 24 Oct past',
      'Sun 25 Oct today',
      'Mon 26 Oct',
      'Tue 27 Oct',
    ];
    const BLOCKING = '[inert], [disabled], [aria-disabled], [tabindex="-1"]';

    beforeEach(() => {
      // A Sunday
      today = '2026-10-25';
    });

    it('marks the first of the 5 cards, "Sun 25 Oct", as today with aria-current="date" on its heading, and no card as past, when the page opens on a cleared localStorage', async () => {
      await reopen();
      expect(marks()).toEqual([
        'Sun 25 Oct today',
        'Mon 26 Oct',
        'Tue 27 Oct',
        'Wed 28 Oct',
        'Thu 29 Oct',
      ]);
      expectCurrent('Sun 25 Oct');
    });

    it("adds no element, text or attribute to today's card beyond its class and its heading's aria-current", async () => {
      await openWith(openPlan(...AROUND_TODAY));
      const card = cardOf('Sun 25 Oct');
      expect(card.classList.contains('today'), 'class "today"').toBe(true);
      expectNothingAdded(card, ['aria-current']);
    });

    it('marks the only card of a one-day plan for today as today and no card as past', async () => {
      await openWith(openPlan('2026-10-25'));
      expect(marks()).toEqual(['Sun 25 Oct today']);
      expectCurrent('Sun 25 Oct');
    });

    it('marks 23 and 24 Oct as past, 25 Oct as today with aria-current="date" on its heading, and 26 and 27 Oct as neither for a saved unaccepted plan from 23 to 27 Oct', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      expect(marks()).toEqual(AROUND_TODAY_MARKS);
      expectCurrent('Sun 25 Oct');
    });

    it('adds no element, text or attribute to a past card beyond its class, none for screen readers either', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      for (const heading of ['Fri 23 Oct', 'Sat 24 Oct']) {
        const card = cardOf(heading);
        expect(card.classList.contains('past'), `${heading}: class "past"`).toBe(true);
        expectNothingAdded(card, []);
      }
    });

    it('marks 30 and 31 Oct as past and 1 Nov as today for a plan from 30 Oct to 3 Nov on 1 Nov', async () => {
      today = '2026-11-01';
      await openWith(
        openPlan('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'),
      );
      expect(marks()).toEqual([
        'Fri 30 Oct past',
        'Sat 31 Oct past',
        'Sun 1 Nov today',
        'Mon 2 Nov',
        'Tue 3 Nov',
      ]);
      expectCurrent('Sun 1 Nov');
    });

    it('marks 30 and 31 Dec as past and 1 Jan as today for a plan from 30 Dec 2026 to 3 Jan 2027 on 1 Jan 2027', async () => {
      today = '2027-01-01';
      await openWith(
        openPlan('2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'),
      );
      expect(marks()).toEqual([
        'Wed 30 Dec past',
        'Thu 31 Dec past',
        'Fri 1 Jan today',
        'Sat 2 Jan',
        'Sun 3 Jan',
      ]);
      expectCurrent('Fri 1 Jan');
    });

    it('marks all 5 cards as past and none as today for a saved unaccepted plan from 20 to 24 Oct', async () => {
      await openWith(
        openPlan('2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'),
      );
      expect(marks()).toEqual([
        'Tue 20 Oct past',
        'Wed 21 Oct past',
        'Thu 22 Oct past',
        'Fri 23 Oct past',
        'Sat 24 Oct past',
      ]);
      expectCurrent(null);
    });

    it('marks the only card of a one-day plan for yesterday as past and none as today', async () => {
      await openWith(openPlan('2026-10-24'));
      expect(marks()).toEqual(['Sat 24 Oct past']);
      expectCurrent(null);
    });

    it('marks every card as past for a plan from 26 to 30 Oct of the year before', async () => {
      await openWith(
        openPlan('2025-10-26', '2025-10-27', '2025-10-28', '2025-10-29', '2025-10-30'),
      );
      expect(marks()).toEqual([
        'Sun 26 Oct past',
        'Mon 27 Oct past',
        'Tue 28 Oct past',
        'Wed 29 Oct past',
        'Thu 30 Oct past',
      ]);
      expectCurrent(null);
    });

    it('marks no card as past or today for a saved unaccepted plan from 26 to 30 Oct', async () => {
      await openWith(
        openPlan('2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'),
      );
      expect(marks()).toEqual([
        'Mon 26 Oct',
        'Tue 27 Oct',
        'Wed 28 Oct',
        'Thu 29 Oct',
        'Fri 30 Oct',
      ]);
      expectCurrent(null);
    });

    it('marks no card as past or today for a plan from 1 to 3 Jan of the year after', async () => {
      await openWith(openPlan('2027-01-01', '2027-01-02', '2027-01-03'));
      expect(marks()).toEqual(['Fri 1 Jan', 'Sat 2 Jan', 'Sun 3 Jan']);
      expectCurrent(null);
    });

    it('marks 24 Oct as past, 25 Oct as today with aria-current="date" on its heading, and 26 Oct as neither for a saved accepted plan from 24 to 26 Oct', async () => {
      await openWith(pickedPlan(['2026-10-24', '2026-10-25', '2026-10-26'], true));
      expect(marks()).toEqual(['Sat 24 Oct past', 'Sun 25 Oct today', 'Mon 26 Oct']);
      expectCurrent('Sun 25 Oct');
    });

    it('keeps 24 Oct past and 25 Oct today when the user accepts a complete plan from 24 to 26 Oct', async () => {
      await openWith(pickedPlan(['2026-10-24', '2026-10-25', '2026-10-26'], false));
      expect(marks(), 'before accepting').toEqual([
        'Sat 24 Oct past',
        'Sun 25 Oct today',
        'Mon 26 Oct',
      ]);
      await click(button(element, 'Accept plan'));
      expect(store.plan().accepted, 'plan not accepted').toBe(true);
      expect(marks(), 'after accepting').toEqual([
        'Sat 24 Oct past',
        'Sun 25 Oct today',
        'Mon 26 Oct',
      ]);
      expectCurrent('Sun 25 Oct');
    });

    it('marks every card as past and none as today for a saved accepted plan from 22 to 24 Oct', async () => {
      await openWith(pickedPlan(['2026-10-22', '2026-10-23', '2026-10-24'], true));
      expect(marks()).toEqual(['Thu 22 Oct past', 'Fri 23 Oct past', 'Sat 24 Oct past']);
      expectCurrent(null);
    });

    it('picks the first suggestion of the 23 Oct lunch with "Undo", keeping its card past, and brings back its three suggestions on "Undo"', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      const suggested = suggestionsOf(meal(0)).map(recipeOf);
      const recipe = await pickFirstSuggestion(0);
      expect(textOf(meal(0).querySelector('p.recipe'))).toBe(recipe);
      expect(buttonTexts(meal(0))).toContain('Undo');
      expect(marks()[0]).toBe('Fri 23 Oct past');
      await click(button(meal(0), 'Undo'));
      expect(suggestionsOf(meal(0)).map(recipeOf)).toEqual(suggested);
      expect(marks()[0]).toBe('Fri 23 Oct past');
    });

    it('shows other suggestions on "Other suggestions" and stops suggesting a recipe on its "×" in the past 23 Oct lunch, keeping its card past', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      const before = suggestionsOf(meal(0)).map(recipeOf);
      await click(button(meal(0), 'Other suggestions'));
      const others = suggestionsOf(meal(0)).map(recipeOf);
      expect(others).toHaveLength(3);
      expect(others.filter((name) => before.includes(name))).toEqual([]);
      expect(marks()[0], 'after "Other suggestions"').toBe('Fri 23 Oct past');

      const dontSuggest = meal(0).querySelector<HTMLButtonElement>('button.dont-suggest');
      expect(dontSuggest, 'no "×" button').not.toBeNull();
      await click(dontSuggest!);
      await click(button(openDialog(), "Don't suggest"));
      expect(store.removed()).toEqual([others[0]]);
      expect(suggestionsOf(meal(0)).map(recipeOf)).not.toContain(others[0]);
      expect(marks()[0], 'after "×"').toBe('Fri 23 Oct past');
    });

    it('covers the past 24 Oct lunch with leftovers when the user turns on "Cook extra" on the picked past 23 Oct dinner, keeping both cards past', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      const recipe = await pickFirstSuggestion(1);
      await setCookExtra(0, true);
      expect(textOf(meal(2).querySelector('p.recipe'))).toBe(`Leftovers: ${recipe}`);
      expect(marks().slice(0, 2)).toEqual(['Fri 23 Oct past', 'Sat 24 Oct past']);
    });

    it('picks and undoes a meal of today\'s card and opens a recipe from its "Recipe" link, keeping the card today', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      const suggested = suggestionsOf(meal(4)).map(recipeOf);
      const recipe = await pickFirstSuggestion(4);
      expect(textOf(meal(4).querySelector('p.recipe'))).toBe(recipe);
      expect(marks()[2], 'after the pick').toBe('Sun 25 Oct today');
      await click(button(meal(4), 'Undo'));
      expect(suggestionsOf(meal(4)).map(recipeOf)).toEqual(suggested);
      expect(marks()[2], 'after "Undo"').toBe('Sun 25 Oct today');

      await click(recipeLinksOf(meal(4))[0]);
      expect(router().url).toBe(`/recipes/${recipeSlug(suggested[0])}`);
      expectCurrent('Sun 25 Oct');
    });

    it('makes no element of the past or today\'s cards, nor any card, inert, disabled, aria-disabled or tabindex="-1"', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      expect(marks(), 'cards not marked').toEqual(AROUND_TODAY_MARKS);
      for (const heading of ['Fri 23 Oct', 'Sat 24 Oct', 'Sun 25 Oct']) {
        const blocked = Array.from(cardOf(heading).querySelectorAll(BLOCKING));
        expect(
          blocked.map((node) => node.outerHTML),
          heading,
        ).toEqual([]);
      }
      for (const card of days()) {
        expect(card.matches(BLOCKING), textOf(card.querySelector('h2'))).toBe(false);
      }
    });

    it("keeps every recipe link of the past and today's cards of an accepted plan in the tab order, with nothing inert, disabled or aria-disabled", async () => {
      await openWith(pickedPlan(['2026-10-24', '2026-10-25', '2026-10-26'], true));
      expect(marks(), 'cards not marked').toEqual([
        'Sat 24 Oct past',
        'Sun 25 Oct today',
        'Mon 26 Oct',
      ]);
      for (const heading of ['Sat 24 Oct', 'Sun 25 Oct']) {
        const card = cardOf(heading);
        expect(card.matches(BLOCKING), heading).toBe(false);
        expect(card.querySelectorAll(BLOCKING), heading).toHaveLength(0);
        const links = Array.from(card.querySelectorAll('p.recipe a'));
        expect(links, `${heading}: recipe links`).toHaveLength(2);
        expect(
          links.every((link) => link.matches(TABBABLE)),
          heading,
        ).toBe(true);
      }
    });

    it('keeps 23 and 24 Oct past with no today when the user lowers Days to 2, and marks the new 25 Oct card as today when the user raises Days back to 3', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      await setDays(2);
      expect(marks(), 'at 2 days').toEqual(['Fri 23 Oct past', 'Sat 24 Oct past']);
      expectCurrent(null);
      await click(arrow('One more day'));
      expect(marks(), 'at 3 days').toEqual([
        'Fri 23 Oct past',
        'Sat 24 Oct past',
        'Sun 25 Oct today',
      ]);
      expectCurrent('Sun 25 Oct');
    });

    it('adds the 26 and 27 Oct cards as neither past nor today when the user raises Days from 3 to 5', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      await setDays(3);
      await click(arrow('One more day'));
      await click(arrow('One more day'));
      expect(marks()).toEqual(AROUND_TODAY_MARKS);
      expectCurrent('Sun 25 Oct');
    });

    it('keeps the marking when the user raises or lowers People', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      await click(arrow('One more person'));
      expect(marks(), 'at 3 people').toEqual(AROUND_TODAY_MARKS);
      await click(arrow('One person fewer'));
      await click(arrow('One person fewer'));
      expect(marks(), 'at 1 person').toEqual(AROUND_TODAY_MARKS);
      expectCurrent('Sun 25 Oct');
    });

    it('keeps 25 Oct as today after a pick once TODAY returns 26 Oct, and marks the first card, "Mon 26 Oct", as today with no past card when the user starts a new plan in the dialog', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      today = '2026-10-26';
      await pickFirstSuggestion(5);
      expect(marks(), 'after the pick').toEqual(AROUND_TODAY_MARKS);
      expectCurrent('Sun 25 Oct');

      await click(button(element, 'New plan'));
      await click(button(openDialog(), 'Start new plan'));
      expect(marks(), 'new plan').toEqual([
        'Mon 26 Oct today',
        'Tue 27 Oct',
        'Wed 28 Oct',
        'Thu 29 Oct',
        'Fri 30 Oct',
      ]);
      expectCurrent('Mon 26 Oct');
    });

    it('keeps 25 Oct as today once TODAY returns 26 Oct through a pick, "Undo", "Other suggestions", a Days change and a People change', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      today = '2026-10-26';
      const steps: [string, () => Promise<unknown>, string[]][] = [
        ['pick', () => pickFirstSuggestion(0), AROUND_TODAY_MARKS],
        ['"Undo"', () => click(button(meal(0), 'Undo')), AROUND_TODAY_MARKS],
        [
          '"Other suggestions"',
          () => click(button(meal(2), 'Other suggestions')),
          AROUND_TODAY_MARKS,
        ],
        ['"One day fewer"', () => click(arrow('One day fewer')), AROUND_TODAY_MARKS.slice(0, 4)],
        ['"One more day"', () => click(arrow('One more day')), AROUND_TODAY_MARKS],
        ['"One more person"', () => click(arrow('One more person')), AROUND_TODAY_MARKS],
      ];
      for (const [name, step, expected] of steps) {
        await step();
        expect(marks(), `after ${name}`).toEqual(expected);
      }
      expectCurrent('Sun 25 Oct');
    });

    it('keeps 25 Oct as today once TODAY returns 26 Oct when the user clicks "New plan" and then "Keep this plan"', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      await pickFirstSuggestion(0);
      today = '2026-10-26';
      await click(button(element, 'New plan'));
      await click(button(openDialog(), 'Keep this plan'));
      expect(marks()).toEqual(AROUND_TODAY_MARKS);
      expectCurrent('Sun 25 Oct');
    });

    it('marks 25 Oct as past and 26 Oct as today when the user comes back to the Plan page once TODAY returns 26 Oct', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      today = '2026-10-26';
      await openPageAgain();
      expect(marks()).toEqual([
        'Fri 23 Oct past',
        'Sat 24 Oct past',
        'Sun 25 Oct past',
        'Mon 26 Oct today',
        'Tue 27 Oct',
      ]);
      expectCurrent('Mon 26 Oct');
    });

    it('marks the first card, "Sun 25 Oct", as today and no card as past when the user clicks "New plan" on a past plan with no meal picked', async () => {
      await openWith(
        openPlan('2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'),
      );
      await click(button(element, 'New plan'));
      expect(openDialogOrNull(), 'dialog open').toBeNull();
      expect(marks()).toEqual([
        'Sun 25 Oct today',
        'Mon 26 Oct',
        'Tue 27 Oct',
        'Wed 28 Oct',
        'Thu 29 Oct',
      ]);
      expectCurrent('Sun 25 Oct');
    });

    it('marks the first card, "Tue 27 Oct", as today and no card as past when the user starts a new plan from an accepted plan once TODAY returns 27 Oct', async () => {
      await openWith(pickedPlan(['2026-10-24', '2026-10-25', '2026-10-26'], true));
      today = '2026-10-27';
      await click(button(element, 'New plan'));
      await click(button(openDialog(), 'Start new plan'));
      expect(marks()).toEqual([
        'Tue 27 Oct today',
        'Wed 28 Oct',
        'Thu 29 Oct',
        'Fri 30 Oct',
        'Sat 31 Oct',
      ]);
      expectCurrent('Tue 27 Oct');
    });

    it('saves the plan after a pick with the same keys as before: days, people, accepted, ticked, added, shown and kidFriendly, and date, lunch, dinner and cookExtra on each day', async () => {
      await openWith(openPlan(...AROUND_TODAY));
      const recipe = await pickFirstSuggestion(0);
      const saved = JSON.parse(localStorage.getItem('fooplan.plan') ?? 'null') as Plan;
      expect(saved.days[0].lunch.recipe, 'pick not saved').toBe(recipe);
      expect(Object.keys(saved).sort()).toEqual([
        'accepted',
        'added',
        'days',
        'kidFriendly',
        'people',
        'shown',
        'ticked',
      ]);
      for (const savedDay of saved.days) {
        expect(Object.keys(savedDay).sort(), savedDay.date).toEqual([
          'cookExtra',
          'date',
          'dinner',
          'lunch',
        ]);
      }
    });

    it('leaves a plan saved before the marking as it was and saves nothing else when the page opens', async () => {
      const plan = openPlan(...AROUND_TODAY);
      await openWith(plan);
      expect(localStorage.getItem('fooplan.plan')).toBe(JSON.stringify(plan));
      expect(Object.keys(localStorage)).toEqual(['fooplan.plan']);
    });

    // The page as it opens on a cleared localStorage, as on the first visit
    async function reopen() {
      localStorage.clear();
      await reload();
    }

    // Navigating to the Plan page creates it anew, with the plan kept in the store
    async function openPageAgain() {
      fixture.destroy();
      fixture = TestBed.createComponent(PlanPage);
      await fixture.whenStable();
      element = fixture.nativeElement as HTMLElement;
    }

    // Each open meal suggests the next three recipes, wrapping around, so that parsePlan accepts
    // the plan: there are fewer built-in recipes than 5 days have suggestions
    function openPlan(...dates: string[]): Plan {
      return planOf(
        dates.map((date, i) =>
          planDay(date, open(...threeFrom(6 * i)), open(...threeFrom(6 * i + 3))),
        ),
      );
    }

    function threeFrom(start: number): string[] {
      return [0, 1, 2].map((offset) => NAMES[(start + offset) % NAMES.length]);
    }

    function pickedPlan(dates: string[], accepted: boolean): Plan {
      return planOf(
        dates.map((date, i) => planDay(date, picked(NAMES[2 * i]), picked(NAMES[2 * i + 1]))),
        { accepted },
      );
    }

    // Each card as its heading followed by its classes other than "day"
    function marks(): string[] {
      return days().map((card) =>
        [
          textOf(card.querySelector('h2')),
          ...Array.from(card.classList).filter((name) => name !== 'day'),
        ].join(' '),
      );
    }

    function expectCurrent(heading: string | null) {
      const current = Array.from(element.querySelectorAll('[aria-current]')).map(
        (node) =>
          `${node.tagName.toLowerCase()} "${textOf(node)}" ${node.getAttribute('aria-current')}`,
      );
      expect(current, 'elements with aria-current').toEqual(
        heading === null ? [] : [`h2 "${heading}" date`],
      );
    }

    function expectNothingAdded(card: HTMLElement, headingAttributes: string[]) {
      const heading = card.querySelector('h2');
      const name = textOf(heading);
      expect(attributesOf(card), `${name}: card attributes`).toEqual(['class']);
      expect(attributesOf(heading!), `${name}: heading attributes`).toEqual(headingAttributes);
      expect(heading!.children, `${name}: elements in the heading`).toHaveLength(0);
      expect(
        Array.from(card.children).map((child) => child.tagName.toLowerCase()),
        `${name}: elements in the card`,
      ).toEqual(['h2', 'article', 'article']);
      const looseText = Array.from(card.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => (node.textContent ?? '').trim())
        .filter(Boolean);
      expect(looseText, `${name}: text outside the heading and meals`).toEqual([]);
    }

    // Leaves out the attributes Angular's style encapsulation adds
    function attributesOf(node: Element): string[] {
      return Array.from(node.attributes)
        .map((attribute) => attribute.name)
        .filter((name) => !name.startsWith('_ng'))
        .sort();
    }

    function cardOf(heading: string): HTMLElement {
      const found = days().find((card) => textOf(card.querySelector('h2')) === heading);
      expect(found, `no "${heading}" card`).toBeDefined();
      return found!;
    }
  });

  // What the browser does on Escape and Tab when the page's keydown handlers let it: Escape
  // cancels the modal dialog, and Tab moves through the dialog only, since the page behind is
  // inert, leaving the page for the browser's toolbar after the last button. Resolves to whether
  // the page handled the key itself
  async function pressKey(key: 'Escape' | 'Tab', shiftKey = false): Promise<boolean> {
    const target = document.activeElement ?? document.body;
    const keydown = new KeyboardEvent('keydown', {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    const handled = !target.dispatchEvent(keydown);
    if (!handled) {
      const dialog = openDialog();
      if (key === 'Escape') {
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) {
          dialog.close();
        }
      } else {
        const tabbable = Array.from(dialog.querySelectorAll<HTMLElement>(TABBABLE));
        const next = tabbable[tabbable.indexOf(target as HTMLElement) + (shiftKey ? -1 : 1)];
        if (next) {
          next.focus();
        } else {
          (target as HTMLElement).blur();
        }
      }
    }
    await fixture.whenStable();
    return handled;
  }

  // A click on the backdrop targets the dialog itself, at a point outside its box
  async function clickBackdrop() {
    await pressAndRelease(openDialog(), OUTSIDE);
  }

  // What the browser fires for a press and its release: pointerdown on the pressed element, whose
  // default moves the focus to the closest focusable element around it, else off to the page; then
  // click on the closest element around both the pressed and the released one
  async function pressAndRelease(
    pressed: HTMLElement,
    pressAt: { clientX: number; clientY: number },
    clicked = pressed,
    releaseAt = pressAt,
  ) {
    await press(pressed, pressAt);
    await release(clicked, releaseAt);
  }

  async function press(pressed: HTMLElement, at: { clientX: number; clientY: number }) {
    const pointerdown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      ...at,
    });
    if (pressed.dispatchEvent(pointerdown)) {
      const focusable = pressed.closest<HTMLElement>('button, input, [tabindex]');
      if (focusable) {
        focusable.focus();
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    await fixture.whenStable();
  }

  async function release(clicked: HTMLElement, at: { clientX: number; clientY: number }) {
    clicked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...at }));
    await fixture.whenStable();
  }

  // The page as it opens with this plan saved, as after a reload
  async function openWith(plan: Plan) {
    localStorage.setItem('fooplan.plan', JSON.stringify(plan));
    await reload();
    expect(store.plan(), 'saved plan not loaded').toEqual(plan);
  }

  // The page as it opens again with what is saved
  async function reload() {
    TestBed.resetTestingModule();
    await createPage();
  }

  async function createPage() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => today },
      ],
    });
    fixture = TestBed.createComponent(PlanPage);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
    store = TestBed.inject(PlanStore);
  }

  async function acceptOneDayPlan(): Promise<string[]> {
    await setDays(1);
    const recipes = [await pickFirstSuggestion(0), await pickFirstSuggestion(1)];
    await click(button(element, 'Accept plan'));
    return recipes;
  }

  async function pickFirstSuggestion(mealIndex: number): Promise<string> {
    const suggestions = suggestionsOf(meal(mealIndex));
    expect(suggestions.length, `suggestions of meal ${mealIndex}`).toBeGreaterThan(0);
    const recipe = recipeOf(suggestions[0]);
    await click(suggestions[0]);
    return recipe;
  }

  async function setCookExtra(dayIndex: number, on: boolean) {
    const checkbox = input(`cook-extra-${dayIndex}`);
    checkbox.checked = on;
    checkbox.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function setDays(count: number) {
    store.setDays(count);
    await fixture.whenStable();
  }

  async function setPeople(count: number) {
    store.setPeople(count);
    await fixture.whenStable();
  }

  async function click(target: HTMLElement) {
    target.click();
    await fixture.whenStable();
  }

  // Resolves to whether the page handled the key itself, keeping the browser from acting on it
  async function keydown(target: HTMLElement, key: string): Promise<boolean> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    const handled = !target.dispatchEvent(event);
    await fixture.whenStable();
    return handled;
  }

  function stepper(name: 'Days' | 'People'): HTMLElement {
    const found = Array.from(element.querySelectorAll<HTMLElement>('[role="spinbutton"]')).find(
      (candidate) => labelOf(candidate) === name,
    );
    expect(found, `no "${name}" spinbutton`).toBeDefined();
    return found!;
  }

  function arrow(name: (typeof ARROWS)[number]): HTMLButtonElement {
    const found = element.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    expect(found, `no "${name}" button`).not.toBeNull();
    return found!;
  }

  function follows(node: Element, other: Element): boolean {
    return (other.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }

  function input(id: string): HTMLInputElement {
    const field = element.querySelector<HTMLInputElement>(`input#${id}`);
    expect(field, `no #${id} input`).not.toBeNull();
    return field!;
  }

  function days(): HTMLElement[] {
    return Array.from(element.querySelectorAll('section.day'));
  }

  function meal(index: number): HTMLElement {
    const meals = element.querySelectorAll<HTMLElement>('article.meal');
    expect(meals.length, `no meal ${index}`).toBeGreaterThan(index);
    return meals[index];
  }

  function suggestionsOf(article: HTMLElement): HTMLButtonElement[] {
    return Array.from(article.querySelectorAll('button.suggestion'));
  }

  function recipeOf(suggestion: HTMLButtonElement): string {
    return textOf(suggestion.querySelector('span.name'));
  }

  function recipeLink(article: HTMLElement): HTMLAnchorElement {
    const links = article.querySelectorAll<HTMLAnchorElement>('p.recipe a');
    expect(links, 'links in the recipe name').toHaveLength(1);
    return links[0];
  }

  function recipeLinksOf(article: HTMLElement): HTMLAnchorElement[] {
    return Array.from(article.querySelectorAll<HTMLAnchorElement>('a')).filter(
      (link) => textOf(link) === 'Recipe',
    );
  }

  // The accessible name, as far as these links and buttons can get one
  function nameOf(node: Element): string {
    if (node.hasAttribute('aria-labelledby')) {
      return labelOf(node);
    }
    const shown = node.cloneNode(true) as Element;
    shown.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
    return node.getAttribute('aria-label')?.trim() || textOf(shown);
  }

  function labelOf(node: Element): string {
    return textOfIdRefs(node, 'aria-labelledby');
  }

  function textOfIdRefs(node: Element, attribute: string): string {
    const ids = (node.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
    return ids.map((id) => textOf(document.getElementById(id))).join(' ');
  }

  function router(): Router {
    return TestBed.inject(Router);
  }

  function openDialog(): HTMLDialogElement {
    const dialog = openDialogOrNull();
    expect(dialog, 'no open dialog').not.toBeNull();
    return dialog!;
  }

  function openDialogOrNull(): HTMLDialogElement | null {
    return element.querySelector('dialog[open]');
  }

  function button(root: HTMLElement, text: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find((b) => textOf(b) === text);
    expect(found, `no "${text}" button`).toBeDefined();
    return found!;
  }

  function buttonTexts(root: HTMLElement = element): string[] {
    return Array.from(root.querySelectorAll('button')).map(textOf);
  }

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});

@Component({ template: '' })
class Blank {}
