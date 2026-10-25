import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { RANDOM, TODAY } from '../../plan/plan-store';
import { seededRandom } from '../../plan/testing';
import { Unit } from '../recipe';
import { RecipeStore } from '../recipe-store';
import { QUICK_DAL, RECIPES_KEY } from '../testing';

const AMOUNT = 'Enter an amount above 0.';
const UNIT_OPTIONS = ['g', 'ml', 'pc', 'tbsp', 'tsp'];

// The form is reached through the app's routes, as saving it opens the new recipe's page
describe('RecipeForm', () => {
  let harness: RouterTestingHarness;

  beforeEach(() => {
    localStorage.clear();
    configure();
  });

  it('opens from "Add a recipe" on the Recipes page with the heading "Add a recipe", an empty name, 2 servings and one empty row with "Amount 1", "Unit 1" (g of g, ml, pc, tbsp, tsp) and "Ingredient 1" but no "Remove", then "Add ingredient", "Save recipe" and "Cancel", and no message', async () => {
    harness = await RouterTestingHarness.create('/recipes');
    const link = Array.from(page().querySelectorAll<HTMLAnchorElement>('a')).find(
      (candidate) => textOf(candidate) === 'Add a recipe',
    );
    expect(link, 'no "Add a recipe" link').toBeDefined();
    await click(link!);

    expect(router().url).toBe('/add-recipe');
    expect(Array.from(page().querySelectorAll('h1')).map(textOf)).toEqual(['Add a recipe']);
    expect(input('Name').value).toBe('');
    expect(input('Servings').value).toBe('2');
    expect(rowCount()).toBe(1);
    expect(input('Amount 1').value).toBe('');
    const unit = control<HTMLSelectElement>('Unit 1');
    expect(unit.tagName).toBe('SELECT');
    expect(Array.from(unit.options).map((option) => option.value)).toEqual(UNIT_OPTIONS);
    expect(Array.from(unit.options).map(textOf)).toEqual(UNIT_OPTIONS);
    expect(unit.value).toBe('g');
    expect(input('Ingredient 1').value).toBe('');
    expect(controlsNamed('Remove ingredient 1')).toEqual([]);
    expect(buttonTexts()).not.toContain('Remove');
    expect(control<HTMLButtonElement>('Add ingredient').type).toBe('button');
    expect(control<HTMLButtonElement>('Save recipe').type).toBe('submit');
    expect(control('Cancel').tagName).toBe('A');
    expect(errors()).toEqual([]);
  });

  it('adds rows 2 and 3, each row with a "Remove", and focuses "Amount 3" after two clicks on "Add ingredient", and hides "Add ingredient" at 30 rows', async () => {
    await openForm();
    await click(control('Add ingredient'));
    await click(control('Add ingredient'));

    expect(rowCount()).toBe(3);
    for (const row of [1, 2, 3]) {
      for (const name of [`Amount ${row}`, `Unit ${row}`, `Ingredient ${row}`]) {
        expect(controlsNamed(name), name).toHaveLength(1);
      }
      expect(control<HTMLButtonElement>(`Remove ingredient ${row}`).type).toBe('button');
    }
    expect(document.activeElement).toBe(input('Amount 3'));

    for (let rows = rowCount(); rows < 29; rows++) {
      await click(control('Add ingredient'));
    }
    expect(controlsNamed('Add ingredient'), 'at 29 rows').toHaveLength(1);
    await click(control('Add ingredient'));
    expect(rowCount()).toBe(30);
    expect(controlsNamed('Add ingredient'), 'at 30 rows').toEqual([]);
  });

  it('removes row 2 of onion, garlic and rice, keeping onion and rice as rows 1 and 2 with the focus on "Amount 2", and then the last row, with the focus on "Amount 1" and no "Remove"', async () => {
    await openForm();
    await fillRows(['1', 'pc', 'onion'], ['2', 'pc', 'garlic'], ['200', 'g', 'rice']);

    await clickFocused(control('Remove ingredient 2'));
    expect(rowCount()).toBe(2);
    expect([input('Ingredient 1').value, input('Ingredient 2').value]).toEqual(['onion', 'rice']);
    expect([input('Amount 1').value, input('Amount 2').value]).toEqual(['1', '200']);
    expect(document.activeElement, 'after removing row 2').toBe(input('Amount 2'));

    await clickFocused(control('Remove ingredient 2'));
    expect(rowCount()).toBe(1);
    expect(input('Ingredient 1').value).toBe('onion');
    expect(document.activeElement, 'after removing the last row').toBe(input('Amount 1'));
    expect(controlsNamed('Remove ingredient 1')).toEqual([]);
    expect(buttonTexts()).not.toContain('Remove');
  });

  it('saves "  Grandma\'s   Soup " for " 4 " with (1,5 pc " Onion "), (200 g "canned chickpeas") and an empty row as "Grandma\'s Soup", and shows its page at /recipes/grandmas-soup with its servings, "Your recipe", both ingredients, no steps and "Back" to /recipes', async () => {
    harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/add-recipe');
    await type('Name', "  Grandma's   Soup ");
    await type('Servings', ' 4 ');
    await fillRows(['1,5', 'pc', ' Onion '], ['200', 'g', 'canned chickpeas'], ['', 'g', '']);

    await click(control('Save recipe'));
    expect(recipeStore().own()).toEqual([
      {
        name: "Grandma's Soup",
        servings: 4,
        ingredients: [
          { name: 'onion', amount: 1.5, unit: 'pc' },
          { name: 'canned chickpeas', amount: 200, unit: 'g' },
        ],
        own: true,
      },
    ]);
    expect(router().url).toBe('/recipes/grandmas-soup');
    expect(Array.from(page().querySelectorAll('h1')).map(textOf)).toEqual(["Grandma's Soup"]);
    expect(textOf(page().querySelector('p.servings'))).toBe('4 servings');
    expect(textOf(page().querySelector('p.own'))).toBe('Your recipe');
    expect(Array.from(page().querySelectorAll('li')).map(textOf)).toEqual([
      '1.5 pc onion',
      '200 g canned chickpeas',
    ]);
    expect(page().querySelector('.steps'), 'steps block').toBeNull();
    expect(textOf(page())).not.toMatch(/Step \d+ of \d+/);
    expect(buttonTexts()).toEqual(expect.not.arrayContaining(['Previous', 'Next']));
    const back = Array.from(page().querySelectorAll('a')).filter((link) => textOf(link) === 'Back');
    expect(back.map((link) => link.getAttribute('href'))).toEqual(['/recipes']);
  });

  it('shows "Enter a name." below an empty "Name", marked invalid, described by it and focused, and saves nothing; and "A recipe with this name already exists." for "Spaghetti carbonara!"', async () => {
    await openForm();
    await fillRows(['1', 'pc', 'onion']);
    await click(control('Save recipe'));

    expectProblem(input('Name'), 'Enter a name.');
    expect(document.activeElement).toBe(input('Name'));
    expectNothingSaved();

    await type('Name', 'Spaghetti carbonara!');
    await click(control('Save recipe'));
    expectProblem(input('Name'), 'A recipe with this name already exists.');
    expectNothingSaved();
  });

  it('shows "Enter a whole number from 1 to 12." below "Servings" for 0, and no servings message for 12', async () => {
    await openForm();
    await type('Name', 'Quick Dal');
    await fillRows(['1', 'pc', 'onion']);
    await type('Servings', '0');
    await click(control('Save recipe'));

    expectProblem(input('Servings'), 'Enter a whole number from 1 to 12.');
    expect(document.activeElement).toBe(input('Servings'));
    expectNothingSaved();

    await type('Servings', '12');
    await click(control('Save recipe'));
    expect(errors()).toEqual([]);
    expect(
      recipeStore()
        .own()
        .map((recipe) => recipe.servings),
    ).toEqual([12]);
  });

  it('shows "Enter an amount above 0." below a row with the amount abc, its "Amount" marked invalid, described by it and focused, and no amount message for 10000', async () => {
    await openForm();
    await type('Name', 'Quick Dal');
    await fillRows(['abc', 'g', 'rice']);
    await click(control('Save recipe'));

    expectProblem(input('Amount 1'), AMOUNT);
    expectBelowRow(messagesOf(input('Amount 1'))[0], 1);
    expect(document.activeElement).toBe(input('Amount 1'));
    expectNothingSaved();

    await type('Amount 1', '10000');
    await click(control('Save recipe'));
    expect(errors()).toEqual([]);
    expect(
      recipeStore()
        .own()
        .map((recipe) => recipe.ingredients[0].amount),
    ).toEqual([10000]);
  });

  it('shows "This ingredient is already in the list." below the row "onion " after "Onion", and below a row with the amount abc and no name both its messages, the amount\'s first, each describing its own input', async () => {
    await openForm();
    await type('Name', 'Quick Dal');
    await fillRows(['1', 'pc', 'Onion'], ['100', 'g', 'onion '], ['abc', 'g', '']);
    await click(control('Save recipe'));

    expectProblem(input('Ingredient 2'), 'This ingredient is already in the list.');
    expectBelowRow(messagesOf(input('Ingredient 2'))[0], 2);
    expectProblem(input('Amount 3'), AMOUNT);
    expectProblem(input('Ingredient 3'), 'Enter an ingredient.');
    const [amount] = messagesOf(input('Amount 3'));
    const [ingredient] = messagesOf(input('Ingredient 3'));
    expectBelowRow(amount, 3);
    expect(amount.nextElementSibling, 'after the amount message').toBe(ingredient);
    expect(input('Amount 1').hasAttribute('aria-invalid')).toBe(false);
    expect(document.activeElement).toBe(input('Ingredient 2'));
    expectNothingSaved();
  });

  it('shows "Add at least one ingredient." below the legend, describing "Amount 1", marked invalid and focused, when every row is empty, and keeps the empty rows', async () => {
    await openForm();
    await type('Name', 'Quick Dal');
    await click(control('Add ingredient'));
    await type('Amount 2', '  ');
    await click(control('Save recipe'));

    expectProblem(input('Amount 1'), 'Add at least one ingredient.');
    const [message] = messagesOf(input('Amount 1'));
    expect(previousNonError(message)?.tagName, 'element above the message').toBe('LEGEND');
    expect(document.activeElement).toBe(input('Amount 1'));
    expect(rowCount()).toBe(2);
    expect(errors()).toEqual(['Add at least one ingredient.']);
    expectNothingSaved();
  });

  it('keeps the messages of an empty name and an invalid amount in row 2 while typing, and on the next save shows only the amount message, with "Name" no longer invalid or described and the focus on "Amount 2"', async () => {
    await openForm();
    await fillRows(['1', 'pc', 'onion'], ['abc', 'g', 'rice']);
    await click(control('Save recipe'));
    expect(errors()).toEqual(['Enter a name.', AMOUNT]);
    expect(document.activeElement).toBe(input('Name'));

    await type('Name', 'Quick Dal');
    expect(errors(), 'while typing').toEqual(['Enter a name.', AMOUNT]);
    expectProblem(input('Name'), 'Enter a name.');

    await click(control('Save recipe'));
    expect(errors()).toEqual([AMOUNT]);
    expectProblem(input('Amount 2'), AMOUNT);
    expect(input('Name').hasAttribute('aria-invalid'), 'aria-invalid on "Name"').toBe(false);
    expect(input('Name').hasAttribute('aria-describedby'), 'aria-describedby on "Name"').toBe(
      false,
    );
    expect(document.activeElement).toBe(input('Amount 2'));
    expectNothingSaved();
  });

  it('shows the Recipes page and saves nothing on "Cancel" after opening the form from it, and links "Cancel" to /recipes when the app started on the form', async () => {
    harness = await RouterTestingHarness.create('/recipes');
    await harness.navigateByUrl('/add-recipe');
    await type('Name', 'Quick Dal');
    await fillRows(['1', 'pc', 'onion']);

    await click(control('Cancel'));
    expect(router().url).toBe('/recipes');
    expect(textOf(page().querySelector('h1'))).toBe('Recipes');
    expect(recipeStore().own()).toEqual([]);
    expect(localStorage.getItem(RECIPES_KEY)).toBeNull();

    TestBed.resetTestingModule();
    configure();
    await openForm();
    expect(control('Cancel').getAttribute('href')).toBe('/recipes');
  });

  it('saves the recipe and shows its page on Enter in "Name"', async () => {
    await openForm();
    await type('Name', 'Quick Dal');
    await fillRows(['1', 'pc', 'onion']);

    await pressEnter(input('Name'));
    expect(
      recipeStore()
        .own()
        .map((recipe) => recipe.name),
    ).toEqual(['Quick Dal']);
    expect(router().url).toBe('/recipes/quick-dal');
    expect(textOf(page().querySelector('h1'))).toBe('Quick Dal');
  });

  it('replaces the form in the history on saving, so going back from the new recipe page leads to the page before the form', async () => {
    harness = await RouterTestingHarness.create('/plan');
    await harness.navigateByUrl('/recipes');
    await harness.navigateByUrl('/add-recipe');
    await type('Name', 'Quick Dal');
    await fillRows(['1', 'pc', 'onion']);
    await click(control('Save recipe'));
    const location = TestBed.inject(Location);
    expect(location.path()).toBe('/recipes/quick-dal');

    location.back();
    await harness.fixture.whenStable();
    expect(location.path()).toBe('/recipes');
  });

  it('moves the message of row 2 to the new row 1 when row 1 is removed, describing its "Amount 1", marked invalid', async () => {
    await openForm();
    await type('Name', 'Quick Dal');
    await fillRows(['1', 'pc', 'onion'], ['abc', 'g', 'rice']);
    await click(control('Save recipe'));
    expectProblem(input('Amount 2'), AMOUNT);

    await click(control('Remove ingredient 1'));
    expect(rowCount()).toBe(1);
    expect(input('Ingredient 1').value).toBe('rice');
    expectProblem(input('Amount 1'), AMOUNT);
    expectBelowRow(messagesOf(input('Amount 1'))[0], 1);
    expect(errors()).toEqual([AMOUNT]);
  });

  describe('edge cases', () => {
    it('turns off the browser\'s own checks: novalidate, and no maxlength, required or pattern; "Servings" has inputmode numeric and "Amount" decimal', async () => {
      await openForm();
      const form = page().querySelector('form');
      expect(form, 'no form').not.toBeNull();
      expect(form!.hasAttribute('novalidate')).toBe(true);
      expect(form!.querySelectorAll('[maxlength], [required], [pattern]')).toHaveLength(0);
      expect(input('Servings').getAttribute('inputmode')).toBe('numeric');
      expect(input('Amount 1').getAttribute('inputmode')).toBe('decimal');
    });

    it('leaves the focus where it is when a "Remove" without the focus is clicked', async () => {
      await openForm();
      await fillRows(['1', 'pc', 'onion'], ['2', 'pc', 'garlic']);
      input('Name').focus();

      await click(control('Remove ingredient 1'));
      expect(input('Ingredient 1').value).toBe('garlic');
      expect(document.activeElement).toBe(input('Name'));
    });

    it('shows "A recipe with this name already exists." for the name of an own recipe in another case', async () => {
      recipeStore().add(QUICK_DAL);
      await openForm();
      await type('Name', 'quick  DAL');
      await fillRows(['1', 'pc', 'onion']);
      await click(control('Save recipe'));

      expectProblem(input('Name'), 'A recipe with this name already exists.');
      expect(recipeStore().own()).toEqual([QUICK_DAL]);
      expect(router().url).toBe('/add-recipe');
    });

    it('keeps the focus on "Name" with an empty name and only empty rows, while "Amount 1" is marked invalid', async () => {
      await openForm();
      await click(control('Save recipe'));

      expect(errors()).toEqual(['Enter a name.', 'Add at least one ingredient.']);
      expectProblem(input('Amount 1'), 'Add at least one ingredient.');
      expect(document.activeElement).toBe(input('Name'));
    });

    it('focuses "Ingredient 1" rather than "Amount 2" when both have a problem', async () => {
      await openForm();
      await type('Name', 'Quick Dal');
      await fillRows(['1', 'pc', ''], ['abc', 'g', 'rice']);
      await click(control('Save recipe'));

      expect(errors()).toEqual(['Enter an ingredient.', AMOUNT]);
      expect(document.activeElement).toBe(input('Ingredient 1'));
    });

    it('drops the message of a removed row, leaving no other control marked invalid or described', async () => {
      await openForm();
      await type('Name', 'Quick Dal');
      await fillRows(['1', 'pc', 'onion'], ['abc', 'g', 'rice'], ['2', 'pc', 'egg']);
      await click(control('Save recipe'));
      expectProblem(input('Amount 2'), AMOUNT);

      await click(control('Remove ingredient 2'));
      expect([input('Ingredient 1').value, input('Ingredient 2').value]).toEqual(['onion', 'egg']);
      expect(errors()).toEqual([]);
      expect(page().querySelectorAll('[aria-invalid], [aria-describedby]')).toHaveLength(0);
    });

    it('ignores another "Save recipe" while the saved recipe\'s page opens, showing no message and saving the recipe once', async () => {
      await openForm();
      await type('Name', 'Quick Dal');
      await fillRows(['1', 'pc', 'onion']);

      const save = control('Save recipe');
      save.click();
      save.click();
      harness.fixture.detectChanges();
      expect(errors(), 'messages after the second "Save recipe"').toEqual([]);

      await harness.fixture.whenStable();
      expect(router().url).toBe('/recipes/quick-dal');
      const saved = {
        name: 'Quick Dal',
        servings: 2,
        ingredients: [{ name: 'onion', amount: 1, unit: 'pc' }],
      };
      expect(recipeStore().own()).toEqual([{ ...saved, own: true }]);
      expect(JSON.parse(localStorage.getItem(RECIPES_KEY) ?? 'null')).toEqual([saved]);
    });

    it('checks another "Save recipe" as usual, showing "A recipe with this name already exists.", after the navigation to the saved recipe returns false or fails', async () => {
      await openForm();
      const navigate = vi.spyOn(router(), 'navigate').mockResolvedValue(false);
      await type('Name', 'Quick Dal');
      await fillRows(['1', 'pc', 'onion']);
      await click(control('Save recipe'));
      expect(router().url).toBe('/add-recipe');
      expect(errors()).toEqual([]);

      await click(control('Save recipe'));
      expectProblem(input('Name'), 'A recipe with this name already exists.');
      expect(document.activeElement).toBe(input('Name'));

      navigate.mockRejectedValue(new Error('Failed to fetch dynamically imported module'));
      await type('Name', 'Plain Rice');
      await click(control('Save recipe'));
      expect(router().url).toBe('/add-recipe');

      await click(control('Save recipe'));
      expectProblem(input('Name'), 'A recipe with this name already exists.');
      expect(navigate).toHaveBeenCalledTimes(2);
      expect(
        recipeStore()
          .own()
          .map((recipe) => recipe.name),
      ).toEqual(['Quick Dal', 'Plain Rice']);
    });
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

  async function openForm() {
    harness = await RouterTestingHarness.create('/add-recipe');
  }

  async function fillRows(...rows: [string, Unit, string][]) {
    for (const [i, [amount, unit, name]] of rows.entries()) {
      if (rowCount() < i + 1) {
        await click(control('Add ingredient'));
      }
      await type(`Amount ${i + 1}`, amount);
      await chooseUnit(i + 1, unit);
      await type(`Ingredient ${i + 1}`, name);
    }
  }

  async function type(name: string, text: string) {
    const field = input(name);
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
  }

  async function chooseUnit(row: number, unit: Unit) {
    const select = control<HTMLSelectElement>(`Unit ${row}`);
    select.value = unit;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
  }

  async function click(target: HTMLElement) {
    target.click();
    await harness.fixture.whenStable();
  }

  async function clickFocused(target: HTMLElement) {
    target.focus();
    expect(document.activeElement, `"${nameOf(target)}" not focused`).toBe(target);
    await click(target);
  }

  // Unless the keydown is handled, a browser submits the field's form on Enter, which jsdom doesn't
  async function pressEnter(field: HTMLInputElement) {
    const enter = { key: 'Enter', bubbles: true, cancelable: true };
    field.focus();
    if (field.dispatchEvent(new KeyboardEvent('keydown', enter))) {
      field.form?.requestSubmit();
    }
    field.dispatchEvent(new KeyboardEvent('keyup', enter));
    await harness.fixture.whenStable();
  }

  function expectProblem(field: HTMLElement, message: string) {
    const name = nameOf(field);
    expect(field.getAttribute('aria-invalid'), `aria-invalid on "${name}"`).toBe('true');
    const messages = messagesOf(field);
    expect(messages.map(textOf), `messages describing "${name}"`).toEqual([message]);
    expect(messages[0].matches('p.error'), `message of "${name}" is a p.error`).toBe(true);
    if (!/^(Amount|Ingredient) \d+$/.test(name)) {
      expect(previousNonError(messages[0]), `element above the message of "${name}"`).toBe(field);
    }
  }

  // A row's messages come right after the row, the amount's first
  function expectBelowRow(message: Element | undefined, row: number) {
    expect(message, `no message for row ${row}`).toBeDefined();
    const above = previousNonError(message!);
    expect(above?.contains(input(`Amount ${row}`)), `row ${row} above its message`).toBe(true);
    expect(above?.contains(input(`Ingredient ${row}`)), `row ${row} above its message`).toBe(true);
  }

  function previousNonError(node: Element): Element | null {
    let previous = node.previousElementSibling;
    while (previous?.matches('p.error')) {
      previous = previous.previousElementSibling;
    }
    return previous;
  }

  function messagesOf(field: HTMLElement): HTMLElement[] {
    const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    return ids.map((id) => document.getElementById(id)).filter((found) => found !== null);
  }

  function expectNothingSaved() {
    expect(router().url, 'URL').toBe('/add-recipe');
    expect(recipeStore().own(), 'own recipes').toEqual([]);
    expect(localStorage.getItem(RECIPES_KEY), 'saved recipes').toBeNull();
  }

  function errors(): string[] {
    return Array.from(page().querySelectorAll('p.error')).map(textOf);
  }

  function rowCount(): number {
    return controls().filter((candidate) => /^Amount \d+$/.test(nameOf(candidate))).length;
  }

  function input(name: string): HTMLInputElement {
    const found = control<HTMLInputElement>(name);
    expect(found.tagName, `"${name}" element`).toBe('INPUT');
    return found;
  }

  function control<T extends HTMLElement = HTMLElement>(name: string): T {
    const found = controlsNamed(name);
    expect(found, `controls named "${name}"`).toHaveLength(1);
    return found[0] as T;
  }

  function controlsNamed(name: string): HTMLElement[] {
    return controls().filter((candidate) => nameOf(candidate) === name);
  }

  function controls(): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>('input, select, button, a'));
  }

  function buttonTexts(): string[] {
    return Array.from(page().querySelectorAll('button')).map(textOf);
  }

  // The accessible name, as far as these controls can get one
  function nameOf(node: HTMLElement): string {
    const ids = (node.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    if (ids.length > 0) {
      return ids.map((id) => textOf(document.getElementById(id))).join(' ');
    }
    const label = node.getAttribute('aria-label')?.trim();
    if (label) {
      return label;
    }
    if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement) {
      return Array.from(node.labels ?? [])
        .map(textOf)
        .join(' ');
    }
    return textOf(node);
  }

  function recipeStore(): RecipeStore {
    return TestBed.inject(RecipeStore);
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
