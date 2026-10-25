import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlanStore, RANDOM, TODAY } from '../../plan/plan-store';
import { addedKey } from '../../plan/plan';
import { acceptOneDayPlan, day, eatingOut, picked, planOf, seededRandom } from '../../plan/testing';
import { displayAmount } from '../../recipes/amount';
import { RECIPES } from '../../recipes/recipes';
import { Recipe, Unit } from '../../recipes/recipe';
import { RecipeStore } from '../../recipes/recipe-store';
import { PLAIN_RICE, QUICK_DAL, storeOwnRecipes } from '../../recipes/testing';
import { byName, bySection, GroceryItem, groceryList, itemKey } from '../groceries';
import { Section, SECTIONS } from '../sections';
import { GroceryList } from './grocery-list';

describe('GroceryList', () => {
  let store: PlanStore;
  let fixture: ComponentFixture<GroceryList>;
  let element: HTMLElement;
  const restores: (() => void)[] = [];

  beforeEach(() => {
    localStorage.clear();
    configure();
    store = TestBed.inject(PlanStore);
  });

  afterEach(() => {
    for (const restore of restores.splice(0)) {
      restore();
    }
  });

  it('says to accept a plan first, links to the plan and lists nothing when the plan is not accepted', async () => {
    await open();
    expect(textOf(element.querySelector('h1'))).toBe('Grocery list');
    const message = element.querySelector('p.empty');
    expect(message, 'no message').not.toBeNull();
    expect(textOf(message)).toMatch(/accept/i);
    expect(message!.querySelector('a')?.getAttribute('href')).toBe('/plan');
    expect(element.querySelector('ul.items')).toBeNull();
    expect(element.querySelectorAll('li')).toHaveLength(0);
  });

  it('lists every item of the accepted plan with its amount, unit and name under its section heading, none ticked', async () => {
    acceptOneDayPlan(store);
    await open();
    const expected = bySection(groceryList(store.plan(), RECIPES));
    expect(expected, 'empty grocery list').not.toEqual([]);
    expect(element.querySelector('p.empty')).toBeNull();
    expect(cart()).toBeNull();
    expect(sections().map((section) => textOf(section.querySelector('h2')))).toEqual(
      expected.map((group) => group.section),
    );
    sections().forEach((section, i) => {
      expect(listedIn(section).map(textOf), `items of "${expected[i].section}"`).toEqual(
        expected[i].items.map(lineOf),
      );
    });
    expect(listed().filter((item) => checkboxOf(item).checked)).toEqual([]);
  });

  it("groups the items under the section headings in the shop's order, without empty sections", async () => {
    acceptOneDayPlan(store);
    await open();
    const headings = sections().map((section) => textOf(section.querySelector('h2')));
    expect(headings.length, 'sections shown').toBeGreaterThan(1);

    const order = headings.map((heading) => SECTIONS.indexOf(heading as Section));
    expect(order, 'unknown section').not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const section of sections()) {
      expect(listedIn(section).length, textOf(section.querySelector('h2'))).toBeGreaterThan(0);
    }
  });

  it('moves an item the user ticks into the collapsed "In the cart" section, and back when unticking it there', async () => {
    acceptOneDayPlan(store);
    await open();
    expect(listed().length, 'items listed').toBeGreaterThan(1);
    const before = listed().map(textOf);
    const [first] = before;

    await click(checkboxOf(listed()[0]));
    expect(listed().map(textOf)).not.toContain(first);
    expect(listed().map(textOf)).toEqual(before.slice(1));
    expect(cart(), 'no "In the cart" section').not.toBeNull();
    expect(cart()!.open, 'cart expanded').toBe(false);
    expect(textOf(cart()!.querySelector('summary'))).toBe('In the cart (1)');
    expect(inCart().map(textOf)).toEqual([first]);
    expect(checkboxOf(inCart()[0]).checked).toBe(true);

    await click(checkboxOf(inCart()[0]));
    expect(cart()).toBeNull();
    expect(listed().map(textOf)).toEqual(before);
    expect(listed().filter((item) => checkboxOf(item).checked)).toEqual([]);
  });

  it('moves the focus to the next line of the section after ticking a line by keyboard', async () => {
    acceptOneDayPlan(store);
    await open();
    const section = sectionWithSeveralLines();
    const second = textOf(listedIn(section)[1]);

    await press(checkboxOf(listedIn(section)[0]));
    expect(textOf(listedIn(section)[0])).toBe(second);
    expect(document.activeElement).toBe(checkboxOf(listedIn(section)[0]));
  });

  it('moves the focus to the previous line after ticking the last line of a section by keyboard', async () => {
    acceptOneDayPlan(store);
    await open();
    const section = sectionWithSeveralLines();
    const lines = listedIn(section).length;

    await press(checkboxOf(listedIn(section).at(-1)!));
    expect(listedIn(section)).toHaveLength(lines - 1);
    expect(document.activeElement).toBe(checkboxOf(listedIn(section).at(-1)!));
  });

  it('moves the focus to the first line of the next section after ticking every line of a section by keyboard', async () => {
    acceptOneDayPlan(store);
    await open();
    expect(sections().length, 'sections shown').toBeGreaterThan(1);
    const [first, next] = sections();
    const heading = textOf(first.querySelector('h2'));

    for (let lines = listedIn(first).length; lines > 0; lines--) {
      await press(checkboxOf(listedIn(first)[0]));
    }
    expect(sections().map((section) => textOf(section.querySelector('h2')))).not.toContain(heading);
    expect(sections()[0]).toBe(next);
    expect(document.activeElement).toBe(checkboxOf(listedIn(next)[0]));
  });

  it('moves the focus to the cart after ticking the last line by keyboard', async () => {
    acceptOneDayPlan(store);
    const list = groceryList(store.plan(), RECIPES);
    expect(list.length, 'items in the list').toBeGreaterThan(1);
    for (const item of list.slice(1)) {
      store.toggleTicked(itemKey(item));
    }
    await open();
    expect(listed().map(textOf)).toEqual([lineOf(list[0])]);

    await press(checkboxOf(listed()[0]));
    expect(listed()).toEqual([]);
    expect(document.activeElement).toBe(cart()?.querySelector('summary'));
  });

  it('leaves the focus alone when ticking or unticking with a click or tap', async () => {
    acceptOneDayPlan(store);
    await open();
    expect(listed().length, 'items listed').toBeGreaterThan(1);

    await click(checkboxOf(listed()[0]));
    expect(inCart(), 'item not ticked').toHaveLength(1);
    expect(document.activeElement).toBe(document.body);

    cart()!.open = true;
    await click(checkboxOf(inCart()[0]));
    expect(cart(), 'item not unticked').toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('moves the focus to the next line in the cart when unticking by keyboard, else to the previous line, else to the line back in its section', async () => {
    acceptOneDayPlan(store);
    const list = groceryList(store.plan(), RECIPES);
    expect(list.length, 'items in the list').toBeGreaterThan(2);
    for (const item of list.slice(0, 3)) {
      store.toggleTicked(itemKey(item));
    }
    await open();
    cart()!.open = true;

    await press(checkboxOf(inCart()[0]));
    expect(inCart(), 'items in the cart').toHaveLength(2);
    expect(document.activeElement).toBe(checkboxOf(inCart()[0]));

    await press(checkboxOf(inCart()[1]));
    expect(inCart(), 'items in the cart').toHaveLength(1);
    expect(document.activeElement).toBe(checkboxOf(inCart()[0]));

    const last = textOf(inCart()[0]);
    await press(checkboxOf(inCart()[0]));
    expect(cart()).toBeNull();
    const backInSection = listed().find((item) => textOf(item) === last);
    expect(backInSection, `"${last}" not back in its section`).toBeDefined();
    expect(document.activeElement).toBe(checkboxOf(backInSection!));
  });

  it('shows an item ticked before the page opened in the cart, not in its section', async () => {
    acceptOneDayPlan(store);
    const [first] = groceryList(store.plan(), RECIPES);
    expect(first, 'empty grocery list').toBeDefined();
    store.toggleTicked(itemKey(first));
    expect(store.plan().ticked, 'item not ticked').toHaveLength(1);

    await open();
    expect(listed().map(textOf)).not.toContain(lineOf(first));
    expect(textOf(cart()?.querySelector('summary') ?? null)).toBe('In the cart (1)');
    expect(inCart().map(textOf)).toEqual([lineOf(first)]);
    expect(checkboxOf(inCart()[0]).checked).toBe(true);
  });

  it('ignores a stored tick whose item is not on the list', async () => {
    acceptOneDayPlan(store);
    const [first] = groceryList(store.plan(), RECIPES);
    expect(first, 'empty grocery list').toBeDefined();
    store.toggleTicked(itemKey({ name: 'dragon fruit', unit: 'pc' }));
    store.toggleTicked(itemKey(first));
    expect(store.plan().ticked, 'items not ticked').toHaveLength(2);

    await open();
    expect(textOf(cart()?.querySelector('summary') ?? null)).toBe('In the cart (1)');
    expect(inCart().map(textOf)).toEqual([lineOf(first)]);
  });

  it('leaves out a section whose items are all ticked, and shows only "In the cart" once everything is ticked', async () => {
    acceptOneDayPlan(store);
    const list = groceryList(store.plan(), RECIPES);
    const [firstSection, ...otherSections] = bySection(list);
    expect(otherSections.length, 'sections in the list').toBeGreaterThan(0);
    for (const item of firstSection.items) {
      store.toggleTicked(itemKey(item));
    }

    await open();
    const headings = () => sections().map((section) => textOf(section.querySelector('h2')));
    expect(headings()).not.toContain(firstSection.section);
    expect(headings()).toEqual(otherSections.map((group) => group.section));

    for (const group of otherSections) {
      for (const item of group.items) {
        store.toggleTicked(itemKey(item));
      }
    }
    await fixture.whenStable();
    expect(sections()).toEqual([]);
    expect(listed()).toEqual([]);
    expect(textOf(cart()?.querySelector('summary') ?? null)).toBe(`In the cart (${list.length})`);
    const alphabetical = [...list].sort(byName);
    expect(inCart().map(textOf)).toEqual(alphabetical.map(lineOf));
  });

  it('shows a merged, rounded-up total of 30 ml as "2 tbsp", in its section and in "In the cart" once ticked, under the same key', async () => {
    acceptOneDayPlan(store);
    // 12.5 + 17 = 29.5 ml, rounded up to 30
    addToPlannedRecipes('white wine', 12.5, 17);
    await open();
    expect(listed().map(textOf)).toContain('2 tbsp white wine');
    expect(listed().map(textOf)).not.toContain('30 ml white wine');

    const key = itemKey({ name: 'white wine', unit: 'ml' });
    await click(checkboxOf(listed().find((item) => textOf(item) === '2 tbsp white wine')!));
    expect(store.plan().ticked).toEqual([key]);
    expect(listed().map(textOf)).not.toContain('2 tbsp white wine');
    expect(inCart().map(textOf)).toEqual(['2 tbsp white wine']);
    expect(checkboxOf(inCart()[0]).dataset['key']).toBe(key);

    await open();
    expect(inCart().map(textOf)).toEqual(['2 tbsp white wine']);
  });

  it('keeps a merged total that is not a spoon amount in ml although each recipe adds a spoon amount', async () => {
    acceptOneDayPlan(store);
    // 15 + 10 = 25 ml
    addToPlannedRecipes('white wine', 15, 10);
    await open();
    expect(listed().map(textOf)).toContain('25 ml white wine');
  });

  it('adds what the user types under "Other" on "Add" and on Enter, and empties the field', async () => {
    acceptOneDayPlan(store);
    await open();

    const added = () =>
      labelsIn(sectionHeaded('Other')).filter((line) => ['coffee', 'toilet paper'].includes(line));

    await type('toilet paper');
    await click(addButton());
    expect(added()).toEqual(['toilet paper']);
    expect(field().value).toBe('');

    await type('coffee');
    await pressEnter();
    expect(added()).toEqual(['coffee', 'toilet paper']);
    expect(field().value).toBe('');
    expect(store.plan().added).toEqual(['toilet paper', 'coffee']);
  });

  it('moves the focus back to the field after adding with "Add", and keeps it there on Enter', async () => {
    acceptOneDayPlan(store);
    await open();

    await type('toilet paper');
    await click(addButton());
    expect(store.plan().added, 'item not added').toEqual(['toilet paper']);
    expect(document.activeElement).toBe(field());

    field().focus();
    await type('coffee');
    await pressEnter();
    expect(store.plan().added, 'item not added').toEqual(['toilet paper', 'coffee']);
    expect(document.activeElement).toBe(field());
  });

  it("shows an added item named like a plan item on its own line as typed, next to the plan's line with its amount", async () => {
    acceptOneDayPlan(store);
    const [first] = groceryList(store.plan(), RECIPES);
    expect(first, 'empty grocery list').toBeDefined();
    await open();

    await type(first.name);
    await click(addButton());
    const lines = labelsIn(sectionHeaded(first.section)).filter(
      (line) => line === lineOf(first) || line === first.name,
    );
    expect(lines).toEqual([lineOf(first), first.name]);
  });

  it('moves an added item the user ticks into "In the cart", and back when unticking it there', async () => {
    acceptOneDayPlan(store);
    store.addItem('toilet paper');
    await open();
    const line = () => listed().find((item) => labelOf(item) === 'toilet paper');
    expect(line(), 'added item not listed').toBeDefined();

    await click(checkboxOf(line()!));
    expect(line()).toBeUndefined();
    expect(inCart().map(labelOf)).toEqual(['toilet paper']);
    expect(checkboxOf(inCart()[0]).checked).toBe(true);
    expect(store.plan().ticked).toEqual([addedKey('toilet paper')]);

    await click(checkboxOf(inCart()[0]));
    expect(cart()).toBeNull();
    expect(line(), 'added item not back').toBeDefined();
    expect(checkboxOf(line()!).checked).toBe(false);
  });

  it('removes an added item from its section, and a ticked one from the cart, with its "Remove" button', async () => {
    acceptOneDayPlan(store);
    store.addItem('toilet paper');
    store.addItem('coffee');
    store.toggleTicked(addedKey('coffee'));
    await open();
    const before = listed().map(labelOf);
    expect(before, 'added item not listed').toContain('toilet paper');
    expect(inCart().map(labelOf), 'added item not ticked').toEqual(['coffee']);

    await click(removeButtonOf(listed().find((item) => labelOf(item) === 'toilet paper')!));
    expect(listed().map(labelOf)).toEqual(before.filter((line) => line !== 'toilet paper'));

    await click(removeButtonOf(inCart()[0]));
    expect(cart()).toBeNull();
    expect(store.plan().added).toEqual([]);
    expect(store.plan().ticked).toEqual([]);
  });

  it('moves the focus to the next line after removing an added item by keyboard, else to the previous line, else to the field', async () => {
    acceptOneDayPlan(store);
    for (const text of ['coffee', 'tea', 'toilet paper', 'zzz']) {
      store.addItem(text);
    }
    store.toggleTicked(addedKey('zzz'));
    await open();
    const line = (label: string) => listed().find((item) => labelOf(item) === label)!;
    expect(labelsIn(sectionHeaded('Other')), 'items not added').toEqual(
      expect.arrayContaining(['coffee', 'tea', 'toilet paper']),
    );

    await pressRemove(line('tea'));
    expect(document.activeElement).toBe(checkboxOf(line('toilet paper')));

    await pressRemove(line('toilet paper'));
    expect(document.activeElement).toBe(checkboxOf(line('coffee')));

    cart()!.open = true;
    await pressRemove(inCart()[0]);
    expect(cart()).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it('shows no "Remove" button on the plan\'s items, in their sections or in the cart', async () => {
    acceptOneDayPlan(store);
    const [first] = groceryList(store.plan(), RECIPES);
    store.toggleTicked(itemKey(first));
    store.addItem('toilet paper');
    await open();
    expect(inCart(), 'item not ticked').toHaveLength(1);
    const addedLine = listed().find((item) => labelOf(item) === 'toilet paper');
    expect(addedLine, 'added item not listed').toBeDefined();
    removeButtonOf(addedLine!);

    for (const item of [...listed().filter((line) => line !== addedLine), ...inCart()]) {
      expect(buttonsIn(item), labelOf(item)).toEqual([]);
    }
  });

  it('shows no field to add items while the plan is not accepted', async () => {
    await open();
    expect(element.querySelector('p.empty'), 'no message').not.toBeNull();
    expect(element.querySelector('input')).toBeNull();
    expect(buttonsIn(element).map(textOf)).not.toContain('Add');

    acceptOneDayPlan(store);
    await fixture.whenStable();
    field();
    addButton();
  });

  it('shows the "Add an item" form and the status line, no section and no "Accept a plan to see what to buy." for an accepted plan whose both meals are eating out', async () => {
    const saved = planOf(
      [
        day(
          '2026-10-24',
          eatingOut(['Fish tacos', 'Potato goulash', 'Penne arrabbiata']),
          eatingOut(['Spaghetti aglio e olio', 'Mac and cheese', 'Bean burritos']),
        ),
      ],
      { accepted: true },
    );
    localStorage.setItem('fooplan.plan', JSON.stringify(saved));
    // A fresh app on this localStorage, as a reload makes
    TestBed.resetTestingModule();
    configure();
    store = TestBed.inject(PlanStore);
    expect(store.plan(), 'saved plan not loaded').toEqual(saved);
    await open();

    expect(textOf(element.querySelector('form label'))).toBe('Add an item');
    field();
    addButton();
    expect(element.querySelector('p.status')).not.toBeNull();
    expect(element.querySelectorAll('section')).toHaveLength(0);
    expect(element.querySelector('p.empty')).toBeNull();
    expect(textOf(element)).not.toContain('Accept a plan to see what to buy.');
  });

  it('lists the scaled ingredients of the own recipes "Quick Dal" and "Plain Rice" of an accepted plan for 2 under their sections, and "mystery spice" under "Other"', async () => {
    storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
    const saved = planOf([day('2026-10-24', picked('Quick Dal'), picked('Plain Rice'))], {
      accepted: true,
    });
    localStorage.setItem('fooplan.plan', JSON.stringify(saved));
    // A fresh app on this localStorage, as a reload makes
    TestBed.resetTestingModule();
    configure();
    store = TestBed.inject(PlanStore);
    expect(store.plan(), 'saved plan not loaded').toEqual(saved);
    await open();

    expect(
      sections().map((section) => [textOf(section.querySelector('h2')), labelsIn(section)]),
    ).toEqual([
      ['Fruit & vegetables', ['1 pc onion']],
      ['Pasta, rice & grains', ['150 g rice']],
      ['Cans & jars', ['100 g canned chickpeas']],
      ['Other', ['1 pc mystery spice']],
    ]);
  });

  it('lists "350 g bread" under "Bread & bakery", "4 pc tomato" and "1 pc avocado" under "Fruit & vegetables", "250 g mozzarella" and "2 pc egg" under "Dairy & eggs", and no olive oil, for "Caprese salad with bread" and "Avocado toast with fried egg" accepted for 2', async () => {
    await openAccepted('Caprese salad with bread', 'Avocado toast with fried egg');

    expect(
      sections().map((section) => [textOf(section.querySelector('h2')), labelsIn(section)]),
    ).toEqual([
      ['Fruit & vegetables', ['1 pc avocado', '15 g basil', '1 pc lemon', '4 pc tomato']],
      ['Dairy & eggs', ['2 pc egg', '250 g mozzarella']],
      ['Bread & bakery', ['350 g bread']],
      ['Spices & sauces', ['1 tsp chili flakes']],
    ]);
    expect(
      listed()
        .map(labelOf)
        .filter((line) => line.includes('olive oil')),
    ).toEqual([]);
  });

  it('lists "200 g hummus" and "400 g canned white beans" under "Cans & jars", "2 pc lemon" under "Fruit & vegetables", "400 g bread" under "Bread & bakery", and no olive oil, for "Hummus plate with bread and vegetables" and "Tuna and white bean salad with bread" accepted for 2', async () => {
    await openAccepted(
      'Hummus plate with bread and vegetables',
      'Tuna and white bean salad with bread',
    );

    expect(
      sections().map((section) => [textOf(section.querySelector('h2')), labelsIn(section)]),
    ).toEqual([
      [
        'Fruit & vegetables',
        [
          '2 pc carrot',
          '150 g cherry tomato',
          '1 pc cucumber',
          '2 pc lemon',
          '10 g parsley',
          '1 pc red onion',
        ],
      ],
      ['Bread & bakery', ['400 g bread']],
      ['Cans & jars', ['150 g canned tuna', '400 g canned white beans', '200 g hummus']],
      ['Spices & sauces', ['1 tsp paprika']],
    ]);
    expect(
      listed()
        .map(labelOf)
        .filter((line) => line.includes('olive oil')),
    ).toEqual([]);
  });

  it('lists "350 g pea", "600 g potato" and "2 pc carrot" under "Fruit & vegetables", "1 pc egg" under "Dairy & eggs", "400 g cod" and "400 g chicken thigh" under "Meat & fish", and no vegetable oil, for "Fish fingers with mashed potatoes and peas" and "Chicken and rice with carrots and peas" accepted for 2', async () => {
    await openAccepted(
      'Fish fingers with mashed potatoes and peas',
      'Chicken and rice with carrots and peas',
    );

    expect(
      sections().map((section) => [textOf(section.querySelector('h2')), labelsIn(section)]),
    ).toEqual([
      ['Fruit & vegetables', ['2 pc carrot', '1 pc onion', '350 g pea', '600 g potato']],
      ['Meat & fish', ['400 g chicken thigh', '400 g cod']],
      ['Dairy & eggs', ['30 g butter', '1 pc egg', '100 ml milk']],
      ['Bread & bakery', ['80 g breadcrumbs']],
      ['Pasta, rice & grains', ['50 g flour', '200 g rice']],
      ['Cans & jars', ['500 ml vegetable stock']],
      ['Spices & sauces', ['1 tsp paprika']],
    ]);
    expect(
      listed()
        .map(labelOf)
        .filter((line) => line.includes('vegetable oil')),
    ).toEqual([]);
  });

  it('follows an edit of "Quick Dal" in an accepted plan for 2 at once: its ticked 100 g canned chickpeas become 150 g, still ticked, after changing 200 g to 300 g, and 150 pc unticked, with no g line, after changing the unit to pc', async () => {
    storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
    const chickpeas = itemKey({ name: 'canned chickpeas', unit: 'g' });
    const saved = {
      ...planOf([day('2026-10-24', picked('Quick Dal'), picked('Plain Rice'))], {
        accepted: true,
      }),
      ticked: [chickpeas],
    };
    localStorage.setItem('fooplan.plan', JSON.stringify(saved));
    // A fresh app on this localStorage, as a reload makes
    TestBed.resetTestingModule();
    configure();
    store = TestBed.inject(PlanStore);
    expect(store.plan(), 'saved plan not loaded').toEqual(saved);
    await open();
    expect(inCart().map(labelOf), 'ticked before the edit').toEqual(['100 g canned chickpeas']);

    const recipes = TestBed.inject(RecipeStore);
    const withChickpeas = (amount: number, unit: Unit) => ({
      ...QUICK_DAL,
      ingredients: QUICK_DAL.ingredients.map((ingredient) =>
        ingredient.name === 'canned chickpeas' ? { ...ingredient, amount, unit } : ingredient,
      ),
    });
    recipes.replace('Quick Dal', withChickpeas(300, 'g'));
    await fixture.whenStable();
    expect(inCart().map(labelOf)).toEqual(['150 g canned chickpeas']);
    expect(checkboxOf(inCart()[0]).checked).toBe(true);

    recipes.replace('Quick Dal', withChickpeas(300, 'pc'));
    await fixture.whenStable();
    expect(labelsIn(sectionHeaded('Cans & jars'))).toEqual(['150 pc canned chickpeas']);
    expect(checkboxOf(listedIn(sectionHeaded('Cans & jars'))[0]).checked).toBe(false);
    expect(cart()).toBeNull();
    expect(textOf(element)).not.toContain('g canned chickpeas');
  });

  describe('status after "Add"', () => {
    it('shows one empty status element right after the form and before the sections, without tabindex or hidden, and leaves the field without aria-describedby', async () => {
      acceptOneDayPlan(store);
      await open();
      expect(element.querySelectorAll('[role="status"]'), 'status elements').toHaveLength(1);
      const status = statusElement();
      expect(field().form?.nextElementSibling, "the form's next sibling").toBe(status);
      const grid = element.querySelector('.sections');
      expect(grid, 'no sections grid').not.toBeNull();
      expect(
        status.compareDocumentPosition(grid!) & Node.DOCUMENT_POSITION_FOLLOWING,
        'status not before the sections grid',
      ).toBeTruthy();
      expect(statusText()).toBe('');
      expect(status.hasAttribute('tabindex'), 'tabindex').toBe(false);
      expect(status.hasAttribute('hidden'), 'hidden attribute').toBe(false);
      expect(field().hasAttribute('aria-describedby'), 'aria-describedby').toBe(false);
    });

    it('never hides the empty status element with the hidden attribute, display: none or visibility: hidden', async () => {
      acceptOneDayPlan(store);
      await open();
      expectStatusShownAndEmpty('on opening');

      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');
      await add('');
      expectStatusShownAndEmpty('after an empty entry');
    });

    it('keeps the focus in the field after "Add" and on Enter, and the status element does not take it on focus()', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');
      expect(document.activeElement, 'focus after "Add"').toBe(field());
      statusElement().focus();
      expect(document.activeElement, 'status element took the focus').toBe(field());

      await type('COFFEE');
      await pressEnter();
      expect(statusText(), 'text not shown').toBe('"coffee" is already on the list.');
      expect(document.activeElement, 'focus after Enter').toBe(field());
    });

    it('gives the status element a class of its own, not "empty", and shows no "Accept a plan" text', async () => {
      acceptOneDayPlan(store);
      await open();
      expect(statusElement().classList.contains('empty'), 'class "empty"').toBe(false);
      expect(element.querySelector('p.empty')).toBeNull();
    });

    it('says "Added "toilet paper" to Other." after "Add", lists it under "Other" and empties the field', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('toilet paper');
      expect(statusText()).toBe('Added "toilet paper" to Other.');
      expect(labelsIn(sectionHeaded('Other'))).toContain('toilet paper');
      expect(field().value).toBe('');
    });

    it('says "Added "coffee" to Other." after Enter', async () => {
      acceptOneDayPlan(store);
      await open();

      await type('coffee');
      await pressEnter();
      expect(statusText()).toBe('Added "coffee" to Other.');
      expect(labelsIn(sectionHeaded('Other')), 'item not added').toContain('coffee');
    });

    it('quotes the entry without its surrounding spaces and names the section the line is listed under', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('  Lemon  ');
      expect(statusText()).toBe('Added "Lemon" to Fruit & vegetables.');
      expect(labelsIn(sectionHeaded('Fruit & vegetables')), 'item not listed').toContain('Lemon');

      await add('olive oil');
      expect(statusText()).toBe('Added "olive oil" to Other.');
      expect(labelsIn(sectionHeaded('Other')), 'item not listed').toContain('olive oil');
    });

    it('says "Added "quark" to Other." and lists it under "Other", as no recipe uses quark any more', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('quark');
      expect(statusText()).toBe('Added "quark" to Other.');
      expect(labelsIn(sectionHeaded('Other'))).toContain('quark');
    });

    it('says "Added "leek" to Other." and lists it under "Other", as no recipe uses leek any more', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('leek');
      expect(statusText()).toBe('Added "leek" to Other.');
      expect(labelsIn(sectionHeaded('Other'))).toContain('leek');
    });

    it('says "Added … to Other." for pumpkin, pumpkin seed and red lentil, the other ingredients only the soups used, and lists each under "Other"', async () => {
      acceptOneDayPlan(store);
      await open();

      for (const name of ['pumpkin', 'pumpkin seed', 'red lentil']) {
        await add(name);
        expect(statusText()).toBe(`Added "${name}" to Other.`);
        expect(labelsIn(sectionHeaded('Other')), `${name} not under "Other"`).toContain(name);
      }
    });

    it('says "Added "sour cream" to Dairy & eggs." and "Added "sesame seed" to Nuts & seeds.", as recipes still use them', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('sour cream');
      expect(statusText()).toBe('Added "sour cream" to Dairy & eggs.');
      expect(labelsIn(sectionHeaded('Dairy & eggs'))).toContain('sour cream');
      await add('sesame seed');
      expect(statusText()).toBe('Added "sesame seed" to Nuts & seeds.');
      expect(labelsIn(sectionHeaded('Nuts & seeds'))).toContain('sesame seed');
    });

    it('says "Added "cream" to Dairy & eggs." and "Added "chive" to Fruit & vegetables.", as recipes use them again', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('cream');
      expect(statusText()).toBe('Added "cream" to Dairy & eggs.');
      expect(labelsIn(sectionHeaded('Dairy & eggs'))).toContain('cream');
      await add('chive');
      expect(statusText()).toBe('Added "chive" to Fruit & vegetables.');
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toContain('chive');
    });

    it('keeps the inner spaces of the entry in the text', async () => {
      acceptOneDayPlan(store);
      await open();

      await add('toilet  paper');
      expect(statusText()).toBe('Added "toilet  paper" to Other.');
    });

    it('says "Added "lime" to Fruit & vegetables." for an entry named like a plan line, and lists both lime lines', async () => {
      await openAccepted('Fish tacos', 'Spaghetti carbonara');
      const lime = groceryList(store.plan(), RECIPES).find((item) => item.name === 'lime');
      expect(lime, 'no lime in the plan').toBeDefined();

      await add('lime');
      expect(statusText()).toBe('Added "lime" to Fruit & vegetables.');
      const lines = labelsIn(sectionHeaded('Fruit & vegetables')).filter(
        (line) => line === lineOf(lime!) || line === 'lime',
      );
      expect(lines).toEqual([lineOf(lime!), 'lime']);
    });

    it('says that "coffee" is already on the list for "COFFEE" after "coffee", adds no second line and empties the field', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');

      await add('COFFEE');
      expect(statusText()).toBe('"coffee" is already on the list.');
      const coffees = labelsIn(sectionHeaded('Other')).filter(
        (line) => line.toLowerCase() === 'coffee',
      );
      expect(coffees).toEqual(['coffee']);
      expect(field().value).toBe('');
    });

    it('says "Added" again for an item that was added, removed and added again', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');
      await click(removeButtonOf(listed().find((item) => labelOf(item) === 'coffee')!));
      expect(store.plan().added, 'item not removed').toEqual([]);

      await add('Coffee');
      expect(statusText()).toBe('Added "Coffee" to Other.');
    });

    it('says that "coffee" is already in the cart for an added item ticked into the cart, and lists it only there', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');
      await click(checkboxOf(listed().find((item) => labelOf(item) === 'coffee')!));
      expect(inCart().map(labelOf), 'item not ticked').toEqual(['coffee']);

      await add('coffee');
      expect(statusText()).toBe('"coffee" is already in the cart.');
      expect(listed().map(labelOf)).not.toContain('coffee');
      expect(inCart().map(labelOf)).toEqual(['coffee']);
    });

    it('says "Added" for an entry named like a ticked plan line, as only added items count', async () => {
      await openAccepted('Fish tacos', 'Spaghetti carbonara');
      const lime = groceryList(store.plan(), RECIPES).find((item) => item.name === 'lime');
      expect(lime, 'no lime in the plan').toBeDefined();
      await click(checkboxOf(listed().find((item) => labelOf(item) === lineOf(lime!))!));
      expect(inCart().map(labelOf), 'plan line not ticked').toEqual([lineOf(lime!)]);

      await add('lime');
      expect(statusText()).toBe('Added "lime" to Fruit & vegetables.');
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toContain('lime');
      expect(inCart().map(labelOf)).toEqual([lineOf(lime!)]);
    });

    it('empties the status and adds nothing for an empty entry or one of only spaces', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');

      await add('');
      expect(statusText(), 'after an empty entry').toBe('');
      expect(store.plan().added).toEqual(['coffee']);

      await add('toilet paper');
      expect(statusText(), 'text not shown').toBe('Added "toilet paper" to Other.');
      await add('   ');
      expect(statusText(), 'after an entry of only spaces').toBe('');
      expect(store.plan().added).toEqual(['coffee', 'toilet paper']);
      expect(field().value).toBe('');
    });

    it('leaves the text as it is while the user ticks, unticks and removes the item it names', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');
      const shown = 'Added "coffee" to Other.';
      expect(statusText(), 'text not shown').toBe(shown);

      await click(checkboxOf(listed().find((item) => labelOf(item) === 'coffee')!));
      expect(inCart().map(labelOf), 'item not ticked').toEqual(['coffee']);
      expect(statusText(), 'after ticking').toBe(shown);

      await click(checkboxOf(inCart()[0]));
      expect(cart(), 'item not unticked').toBeNull();
      expect(statusText(), 'after unticking').toBe(shown);

      await click(removeButtonOf(listed().find((item) => labelOf(item) === 'coffee')!));
      expect(store.plan().added, 'item not removed').toEqual([]);
      expect(statusText(), 'after removing').toBe(shown);
    });

    it('keeps the same status element while the texts follow each other', async () => {
      acceptOneDayPlan(store);
      await open();
      const status = statusElement();

      await add('coffee');
      expect(statusElement(), 'element after "coffee"').toBe(status);
      expect(statusText()).toBe('Added "coffee" to Other.');
      await add('COFFEE');
      expect(statusElement(), 'element after "COFFEE"').toBe(status);
      expect(statusText()).toBe('"coffee" is already on the list.');
      await add('');
      expect(statusElement(), 'element after an empty entry').toBe(status);
      expect(statusText()).toBe('');
    });

    it('shows an empty status when the page is opened again, with the added item still listed', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');

      fixture.destroy();
      await open();
      expect(TestBed.inject(PlanStore), 'another store').toBe(store);
      expect(statusText()).toBe('');
      expect(labelsIn(sectionHeaded('Other'))).toContain('coffee');
    });

    it('keeps the text in the page only, neither in the plan nor in the storage', async () => {
      acceptOneDayPlan(store);
      await open();
      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');

      expect(JSON.stringify(store.plan()), 'plan').not.toContain('Added');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        expect(localStorage.getItem(key), `storage "${key}"`).not.toContain('Added');
      }
    });

    it('shows no status element while the plan is not accepted, and an empty one once it is', async () => {
      await open();
      expect(element.querySelector('p.empty'), 'no message').not.toBeNull();
      expect(element.querySelectorAll('[role="status"]')).toHaveLength(0);

      acceptOneDayPlan(store);
      await fixture.whenStable();
      expect(statusText()).toBe('');
    });
  });

  describe('"Undo" bar after a tick', () => {
    // For 2 people: 1 pc bell pepper, 1 pc onion and 2 pc spring onion under "Fruit & vegetables",
    // and 30 ml soy sauce halved to 15 ml, which reads "1 tbsp"
    const ONION_STIR_FRY: Recipe = {
      name: 'Onion Stir-Fry',
      servings: 4,
      ingredients: [
        { name: 'onion', amount: 2, unit: 'pc' },
        { name: 'bell pepper', amount: 2, unit: 'pc' },
        { name: 'spring onion', amount: 4, unit: 'pc' },
        { name: 'soy sauce', amount: 30, unit: 'ml' },
      ],
      own: true,
    };
    const ONION = '1 pc onion';
    const RICE = '150 g rice';

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the bar as the last child with "1 pc onion" is in the cart. and an "Undo" button after the text after a click on the line\'s checkbox, leaving the status text and the focus alone', async () => {
      await openStirFryPlan();

      await tick(ONION);
      expect(textOf(cart()?.querySelector('summary') ?? null)).toBe('In the cart (1)');
      expect(inCart().map(labelOf)).toEqual([ONION]);
      const shown = shownBar();
      expect(element.lastElementChild, 'last child').toBe(shown);
      expect(barText()).toBe('"1 pc onion" is in the cart.');
      expect(Array.from(shown.children).map((child) => child.tagName)).toEqual(['SPAN', 'BUTTON']);
      const button = undoButton();
      expect(button.type).toBe('button');
      expect(button.getAttribute('aria-label') ?? 'Undo', 'accessible name').toBe('Undo');
      expect(button.hasAttribute('aria-labelledby'), 'aria-labelledby').toBe(false);
      expect(statusText()).toBe('');
      expect(document.activeElement).toBe(document.body);
    });

    it('gives the bar no role and no aria-live, nor anything inside it, and keeps one status element', async () => {
      await openStirFryPlan();

      await tick(ONION);
      const shown = shownBar();
      for (const node of [shown, ...Array.from(shown.querySelectorAll('*'))]) {
        expect(node.hasAttribute('role'), `role on ${node.tagName}`).toBe(false);
        expect(node.hasAttribute('aria-live'), `aria-live on ${node.tagName}`).toBe(false);
      }
      expect(element.querySelectorAll('[role="status"]'), 'status elements').toHaveLength(1);
    });

    it('shows no bar on opening, also with a line ticked before the page opened', async () => {
      await openStirFryPlan();
      expect(bar()).toBeNull();

      store.toggleTicked(itemKey({ name: 'onion', unit: 'pc' }));
      fixture.destroy();
      await open();
      expect(inCart().map(labelOf), 'line not ticked').toEqual([ONION]);
      expect(bar()).toBeNull();
    });

    it('keeps the status text of an "Add" when a tick shows the bar', async () => {
      await openStirFryPlan();
      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');

      await tick(ONION);
      shownBar();
      expect(statusText()).toBe('Added "coffee" to Other.');
    });

    it('makes "Undo" the last focusable element of the page, after the lines in the cart', async () => {
      await openStirFryPlan();
      await tick(RICE);

      await tick(ONION);
      const focusable = Array.from(
        element.querySelectorAll<HTMLElement>('a[href], button, input, summary'),
      );
      expect(focusable.at(-1)).toBe(undoButton());
      expect(focusable.at(-2)).toBe(checkboxOf(inCart().at(-1)!));
    });

    it('shows no bar after unticking a line in the cart', async () => {
      await openStirFryPlan({ ticked: [itemKey({ name: 'onion', unit: 'pc' })] });
      expect(inCart().map(labelOf), 'line not ticked').toEqual([ONION]);

      cart()!.open = true;
      await click(checkboxOf(inCart()[0]));
      expect(labelsIn(sectionHeaded('Fruit & vegetables')), 'line not unticked').toContain(ONION);
      expect(bar()).toBeNull();
    });

    it('shows no bar after "Add" or "Remove" of an added item', async () => {
      await openStirFryPlan();

      await add('toilet paper');
      expect(labelsIn(sectionHeaded('Other')), 'item not added').toEqual(['toilet paper']);
      expect(bar(), 'after "Add"').toBeNull();
      await click(removeButtonOf(line('toilet paper')));
      expect(store.plan().added, 'item not removed').toEqual([]);
      expect(bar(), 'after "Remove"').toBeNull();
    });

    it('shows no bar for a line ticked in the store without its checkbox', async () => {
      await openStirFryPlan();

      store.toggleTicked(itemKey({ name: 'onion', unit: 'pc' }));
      await stable();
      expect(inCart().map(labelOf), 'line not ticked').toEqual([ONION]);
      expect(bar()).toBeNull();
    });

    it('says "toilet paper" is in the cart. for a ticked added item, and "1 tbsp soy sauce" is in the cart. for a 15 ml plan line, with the amount as shown', async () => {
      await openStirFryPlan({ added: ['toilet paper'] });

      await tick('toilet paper');
      expect(barText()).toBe('"toilet paper" is in the cart.');
      await tick('1 tbsp soy sauce');
      expect(barText()).toBe('"1 tbsp soy sauce" is in the cart.');
    });

    it('quotes an added item of 60 letters whole', async () => {
      const name = 'x'.repeat(60);
      await openStirFryPlan({ added: [name] });

      await tick(name);
      expect(barText()).toBe(`"${name}" is in the cart.`);
    });

    it('says "onion" is in the cart. for an added item "onion" ticked next to the plan line "1 pc onion"', async () => {
      await openStirFryPlan({ added: ['onion'] });
      expect(labelsIn(sectionHeaded('Fruit & vegetables')), 'item not listed').toContain('onion');

      await tick('onion');
      expect(barText()).toBe('"onion" is in the cart.');
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toContain(ONION);
    });

    it('quotes an added item with its case and inner spaces as typed', async () => {
      await openStirFryPlan({ added: ['Toilet  Paper'] });

      // labelOf collapses the inner spaces, which the bar's text keeps
      await tick('Toilet Paper');
      expect(barText()).toBe('"Toilet  Paper" is in the cart.');
    });

    it('keeps the bar 4999 ms after the tick and removes it at 5000 ms, leaving the line in the cart', async () => {
      await openStirFryPlan();
      await tick(ONION);
      shownBar();

      await wait(4999);
      expect(bar(), 'gone at 4999 ms').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown at 5000 ms').toBeNull();
      expect(inCart().map(labelOf)).toEqual([ONION]);
    });

    it('shows the bar again for 5 seconds after a tick following one whose bar went away', async () => {
      await openStirFryPlan();
      await tick(RICE);
      shownBar();
      await wait(5000);
      expect(bar(), 'first bar still shown').toBeNull();

      await wait(2000);
      await tick(ONION);
      expect(barText()).toBe('"1 pc onion" is in the cart.');
      await wait(4999);
      expect(bar(), 'gone at 4999 ms').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown at 5000 ms').toBeNull();
    });

    it("replaces the text with the latest tick's line and counts the 5 seconds from it", async () => {
      await openStirFryPlan();
      await tick(ONION);
      shownBar();

      await wait(3000);
      await tick(RICE);
      expect(barText()).toBe('"150 g rice" is in the cart.');
      await wait(4999);
      expect(bar(), 'gone 4999 ms after the latest tick').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown 5000 ms after the latest tick').toBeNull();
      expect(inCart().map(labelOf)).toEqual([ONION, RICE]);
    });

    it('undoes only the latest tick after two ticks in a row', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await wait(1000);
      await tick(RICE);
      expect(barText(), 'bar of the latest tick').toBe('"150 g rice" is in the cart.');

      await click(undoButton());
      expect(inCart().map(labelOf)).toEqual([ONION]);
      expect(labelsIn(sectionHeaded('Pasta, rice & grains'))).toEqual([RICE]);
      expect(bar()).toBeNull();
    });

    it('keeps the bar past 5 seconds while the pointer is over it or the focus is in it, and removes it as soon as the pointer leaves or the focus goes', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerenter');
      await wait(5000);
      expect(bar(), 'gone with the pointer over it').not.toBeNull();
      await pointer('pointerleave');
      expect(bar(), 'shown after pointerleave').toBeNull();

      await tick(RICE);
      await focusUndo();
      await wait(5000);
      expect(bar(), 'gone with the focus in it').not.toBeNull();
      await blurUndo();
      expect(bar(), 'shown after blur').toBeNull();
    });

    it('keeps the bar when the pointer leaves it while "Undo" still has the focus, until the focus goes', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerenter');
      await focusUndo();
      await wait(5000);

      await pointer('pointerleave');
      expect(bar(), 'gone with the focus in it').not.toBeNull();
      await blurUndo();
      expect(bar(), 'shown after blur').toBeNull();
    });

    it('keeps the bar when "Undo" loses the focus while the pointer is still over it, until the pointer leaves', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await focusUndo();
      await pointer('pointerenter');
      await wait(5000);

      await blurUndo();
      expect(bar(), 'gone with the pointer over it').not.toBeNull();
      await pointer('pointerleave');
      expect(bar(), 'shown after pointerleave').toBeNull();
    });

    it('removes the bar 5000 ms after the tick when the focus came to "Undo" and went before', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await focusUndo();
      await wait(1000);
      await blurUndo();
      expect(bar(), 'gone after blur before 5 seconds').not.toBeNull();

      await wait(3999);
      expect(bar(), 'gone at 4999 ms').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown at 5000 ms').toBeNull();
    });

    it('removes the bar 5000 ms after the tick when the pointer came and left before', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerenter');
      await wait(1000);
      await pointer('pointerleave');
      expect(bar(), 'gone after pointerleave before 5 seconds').not.toBeNull();

      await wait(3999);
      expect(bar(), 'gone at 4999 ms').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown at 5000 ms').toBeNull();
    });

    it('keeps the bar held by a pointer resting on it across a keyboard tick of another line, until the pointer leaves', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerenter');

      await press(checkboxOf(line('1 pc bell pepper')));
      expect(barText(), 'bar of the keyboard tick').toBe('"1 pc bell pepper" is in the cart.');
      await wait(5000);
      expect(bar(), 'gone with the pointer resting on it').not.toBeNull();
      await pointer('pointerleave');
      expect(bar(), 'shown after pointerleave').toBeNull();
    });

    it('moves the line back to its sorted place in its section with a click on "Undo", leaving the earlier tick in the cart, the status text and the focus alone', async () => {
      await openStirFryPlan();
      await tick(RICE);
      await tick(ONION);
      expect(barText(), 'bar of the latest tick').toBe('"1 pc onion" is in the cart.');

      await click(undoButton());
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toEqual([
        '1 pc bell pepper',
        ONION,
        '2 pc spring onion',
      ]);
      expect(checkboxOf(line(ONION)).checked).toBe(false);
      expect(textOf(cart()?.querySelector('summary') ?? null)).toBe('In the cart (1)');
      expect(inCart().map(labelOf)).toEqual([RICE]);
      expect(bar()).toBeNull();
      expect(statusText()).toBe('');
      expect(document.activeElement).toBe(document.body);
    });

    it('leaves the status text of an "Add" as it is on "Undo"', async () => {
      await openStirFryPlan();
      await add('coffee');
      expect(statusText(), 'text not shown').toBe('Added "coffee" to Other.');
      await tick('coffee');

      await click(undoButton());
      expect(labelsIn(sectionHeaded('Other')), 'item not unticked').toEqual(['coffee']);
      expect(statusText()).toBe('Added "coffee" to Other.');
    });

    it('moves an added item back under "Other" with "Undo", still on the list', async () => {
      await openStirFryPlan({ added: ['toilet paper'] });
      await tick('toilet paper');

      await click(undoButton());
      expect(labelsIn(sectionHeaded('Other'))).toEqual(['toilet paper']);
      expect(store.plan().added).toEqual(['toilet paper']);
      expect(store.plan().ticked).toEqual([]);
    });

    it('keeps the bar while a press on it is in progress past 5 seconds, so a tap on "Undo" at the 5 s mark unticks the line', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await wait(4000);
      await pointer('pointerdown');
      await wait(1001);
      // A touch fires pointerleave after pointerup and before the click
      await release(undoButton());
      await pointer('pointerleave');

      await click(undoButton());
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toContain(ONION);
      expect(store.plan().ticked).toEqual([]);
      expect(bar()).toBeNull();
    });

    it('removes the bar past 5 seconds when a press on it is cancelled or ends outside it', async () => {
      await openStirFryPlan();
      for (const end of ['pointercancel', 'pointerup outside'] as const) {
        await tick(end === 'pointercancel' ? ONION : RICE);
        await pointer('pointerdown');
        await wait(5000);
        expect(bar(), `gone during the press before "${end}"`).not.toBeNull();
        if (end === 'pointercancel') {
          await pointer('pointercancel');
        } else {
          await release(document.body);
        }
        expect(bar(), `shown after "${end}"`).toBeNull();
      }
    });

    it('keeps the bar past 5 seconds when another pointer than the pressing one is cancelled', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerdown', { pointerId: 1 });
      await pointer('pointercancel', { pointerId: 2 });
      await wait(5000);
      expect(bar(), 'gone after another pointer was cancelled').not.toBeNull();
      await pointer('pointercancel', { pointerId: 1 });
      expect(bar(), 'shown after the pressing pointer was cancelled').toBeNull();
    });

    it('removes the bar at 5000 ms after a right-click or a ctrl+click released on it without a click', async () => {
      await openStirFryPlan();
      for (const [press, init] of [
        ['right-click', { button: 2 }],
        ['ctrl+click', { button: 0, ctrlKey: true }],
      ] as const) {
        await tick(press === 'right-click' ? ONION : RICE);
        await pointer('pointerdown', init);
        await release(undoButton(), init);
        await wait(4999);
        expect(bar(), `gone at 4999 ms after a ${press}`).not.toBeNull();
        await wait(1);
        expect(bar(), `shown at 5000 ms after a ${press}`).toBeNull();
      }
    });

    it('removes the bar at 5000 ms after a press on it that opens the context menu instead of clicking', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await wait(4000);
      await pointer('pointerdown');
      await wait(500);
      await pointer('contextmenu');
      await wait(499);
      expect(bar(), 'gone at 4999 ms').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown at 5000 ms').toBeNull();
    });

    it('keeps the bar held by a press on it when another pointer is released outside it, until that press ends', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerdown', { pointerId: 1 });
      await release(document.body, { pointerId: 2 });
      await wait(5000);
      expect(bar(), 'gone after the other pointer was released').not.toBeNull();
      await release(document.body, { pointerId: 1 });
      expect(bar(), 'shown after the press ended outside').toBeNull();
    });

    it('never ticks the line again with "Undo" after it was unticked elsewhere', async () => {
      const key = itemKey({ name: 'onion', unit: 'pc' });
      await openStirFryPlan();
      await tick(ONION);
      shownBar();

      store.toggleTicked(key);
      await stable();
      expect(store.plan().ticked, 'line not unticked').toEqual([]);
      if (bar() !== null) {
        await click(undoButton());
      }
      expect(store.plan().ticked).toEqual([]);
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toContain(ONION);
      expect(bar()).toBeNull();
    });

    it('removes the cart box when "Undo" unticks the only ticked line', async () => {
      await openStirFryPlan();
      await tick(ONION);

      await click(undoButton());
      expect(cart()).toBeNull();
      expect(labelsIn(sectionHeaded('Fruit & vegetables'))).toContain(ONION);
      expect(bar()).toBeNull();
      expect(vi.getTimerCount(), 'pending timers').toBe(0);
    });

    it('moves the focus to the line\'s checkbox back in its section after "Undo" with Enter or Space', async () => {
      await openStirFryPlan();
      await tick(RICE);

      for (const key of ['Enter', ' '] as const) {
        await tick(ONION);
        await pressButton(undoButton(), key);
        expect(inCart().map(labelOf), `after "${key}"`).toEqual([RICE]);
        expect(document.activeElement, `focus after "${key}"`).toBe(checkboxOf(line(ONION)));
      }
    });

    it('moves the focus to the line\'s checkbox when "Undo" with the keyboard empties the cart', async () => {
      await openStirFryPlan();
      await tick(ONION);

      await pressButton(undoButton(), ' ');
      expect(cart()).toBeNull();
      expect(document.activeElement).toBe(checkboxOf(line(ONION)));
    });

    it('starts the next bar unheld after "Undo" while the pointer and the focus were on the bar', async () => {
      await openStirFryPlan();
      await tick(ONION);
      await pointer('pointerenter');
      await focusUndo();

      await click(undoButton());
      expect(bar(), 'bar after "Undo"').toBeNull();
      await tick(RICE);
      await wait(5000);
      expect(bar()).toBeNull();
    });

    it('removes the bar when its line is unticked in the cart, and when its added item is removed with "Remove"', async () => {
      await openStirFryPlan({ added: ['toilet paper'] });
      await tick(ONION);
      shownBar();
      cart()!.open = true;
      await click(checkboxOf(cartLine(ONION)));
      expect(labelsIn(sectionHeaded('Fruit & vegetables')), 'line not unticked').toContain(ONION);
      expect(bar(), 'after unticking').toBeNull();

      await tick('toilet paper');
      shownBar();
      cart()!.open = true;
      await click(removeButtonOf(cartLine('toilet paper')));
      expect(store.plan().added).toEqual([]);
      expect(textOf(element)).not.toContain('toilet paper');
      expect(bar(), 'after "Remove"').toBeNull();
    });

    it('moves the focus to the next line of the section after a keyboard tick while the bar shows, not to the bar', async () => {
      await openStirFryPlan();
      await tick(ONION);
      shownBar();

      await press(checkboxOf(line('1 pc bell pepper')));
      expect(barText(), 'bar of the keyboard tick').toBe('"1 pc bell pepper" is in the cart.');
      expect(document.activeElement).toBe(checkboxOf(line('2 pc spring onion')));
    });

    it('moves the focus to the cart after a keyboard tick of the last line while the bar shows, not to the bar', async () => {
      await openStirFryPlan();
      const [remaining, ...others] = listed().map(labelOf);
      for (const label of others) {
        await tick(label);
      }
      shownBar();

      await press(checkboxOf(line(remaining)));
      expect(listed()).toEqual([]);
      expect(barText(), 'bar of the keyboard tick').toBe(`"${remaining}" is in the cart.`);
      expect(document.activeElement).toBe(cart()?.querySelector('summary'));
    });

    it('shows no bar after the page is left and opened again, with the line still in the cart', async () => {
      await openStirFryPlan();
      await tick(ONION);
      shownBar();

      fixture.destroy();
      expect(vi.getTimerCount(), 'pending timers').toBe(0);
      await open();
      expect(TestBed.inject(PlanStore), 'another store').toBe(store);
      expect(bar()).toBeNull();
      expect(inCart().map(labelOf)).toEqual([ONION]);
    });

    it('shows no bar after a reload and keeps its text neither in the plan nor in the storage', async () => {
      await openStirFryPlan();
      await tick(ONION);
      shownBar();

      expect(JSON.stringify(store.plan()), 'plan').not.toContain('is in the cart');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        expect(localStorage.getItem(key), `storage "${key}"`).not.toContain('is in the cart');
      }
      await reload();
      expect(bar()).toBeNull();
      expect(inCart().map(labelOf)).toEqual([ONION]);
    });

    it('keeps the bar and its text when another line is unticked in the cart', async () => {
      await openStirFryPlan();
      await tick(RICE);
      await tick(ONION);
      shownBar();

      cart()!.open = true;
      await click(checkboxOf(cartLine(RICE)));
      expect(inCart().map(labelOf), 'line not unticked').toEqual([ONION]);
      expect(barText()).toBe('"1 pc onion" is in the cart.');
    });

    it('keeps the bar when another added item is removed from the cart', async () => {
      await openStirFryPlan({ added: ['coffee', 'toilet paper'] });
      await tick('coffee');
      await tick('toilet paper');
      shownBar();

      cart()!.open = true;
      await click(removeButtonOf(cartLine('coffee')));
      expect(store.plan().added, 'item not removed').toEqual(['toilet paper']);
      expect(barText()).toBe('"toilet paper" is in the cart.');
    });

    it('keeps counting the 5 seconds from the tick when another line is unticked in the cart', async () => {
      await openStirFryPlan();
      await tick(RICE);
      await tick(ONION);
      shownBar();

      await wait(2000);
      cart()!.open = true;
      await click(checkboxOf(cartLine(RICE)));
      await wait(2999);
      expect(bar(), 'gone at 4999 ms').not.toBeNull();
      await wait(1);
      expect(bar(), 'shown at 5000 ms').toBeNull();
    });

    it('shows no bar while the plan is not accepted, also after toggleTicked on the store', async () => {
      await open();
      expect(element.querySelector('p.empty'), 'no message').not.toBeNull();
      expect(bar()).toBeNull();

      store.toggleTicked(itemKey({ name: 'onion', unit: 'pc' }));
      await stable();
      expect(store.plan().ticked, 'ticked without an accepted plan').toEqual([]);
      expect(bar()).toBeNull();
    });

    // Own recipes saved before a fresh app starts, as a reload makes, so the list holds the lines
    // the spec names
    async function openStirFryPlan({ added = [] as string[], ticked = [] as string[] } = {}) {
      storeOwnRecipes(ONION_STIR_FRY, PLAIN_RICE);
      const saved = {
        ...planOf([day('2026-10-24', picked('Onion Stir-Fry'), picked('Plain Rice'))], {
          accepted: true,
        }),
        added,
        ticked,
      };
      localStorage.setItem('fooplan.plan', JSON.stringify(saved));
      await reload();
      expect(store.plan(), 'saved plan not loaded').toEqual(saved);
      expect([...listed(), ...inCart()].map(labelOf), 'plan lines').toEqual(
        expect.arrayContaining(['1 pc bell pepper', ONION, '2 pc spring onion', RICE]),
      );
    }

    async function reload() {
      TestBed.resetTestingModule();
      configure();
      store = TestBed.inject(PlanStore);
      await open();
    }

    async function tick(label: string) {
      await click(checkboxOf(line(label)));
    }

    async function wait(ms: number) {
      vi.advanceTimersByTime(ms);
      await stable();
    }

    // jsdom has no :hover, so the events stand for the pointer moving onto the bar and off it
    async function pointer(
      type: 'pointerenter' | 'pointerleave' | 'pointerdown' | 'pointercancel' | 'contextmenu',
      init: PointerEventInit = {},
    ) {
      shownBar().dispatchEvent(new PointerEvent(type, init));
      await stable();
    }

    async function release(target: Element, init: PointerEventInit = {}) {
      target.dispatchEvent(new PointerEvent('pointerup', { ...init, bubbles: true }));
      await stable();
    }

    async function focusUndo() {
      undoButton().focus();
      await stable();
      expect(document.activeElement, '"Undo" not focused').toBe(undoButton());
    }

    async function blurUndo() {
      undoButton().blur();
      await stable();
    }

    function line(label: string): HTMLElement {
      const found = listed().find((item) => labelOf(item) === label);
      expect(found, `no line "${label}" in the sections`).toBeDefined();
      return found!;
    }

    function cartLine(label: string): HTMLElement {
      const found = inCart().find((item) => labelOf(item) === label);
      expect(found, `no line "${label}" in the cart`).toBeDefined();
      return found!;
    }

    function undoButton(): HTMLButtonElement {
      const button = buttonsIn(shownBar()).find((candidate) => textOf(candidate) === 'Undo');
      expect(button, 'no "Undo" button').toBeDefined();
      return button!;
    }

    // Trimmed only, like statusText: the inner spaces of an added item are part of the text
    function barText(): string {
      return (shownBar().querySelector('span')?.textContent ?? '').trim();
    }

    function shownBar(): HTMLElement {
      const found = bar();
      expect(found, 'no "Undo" bar').not.toBeNull();
      return found!;
    }

    function bar(): HTMLElement | null {
      return element.querySelector('div.undo-bar');
    }
  });

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
  }

  // A fresh app on an accepted one-day plan for 2 with these picks, as a reload makes
  async function openAccepted(lunch: string, dinner: string) {
    const saved = planOf([day('2026-10-24', picked(lunch), picked(dinner))], { accepted: true });
    localStorage.setItem('fooplan.plan', JSON.stringify(saved));
    TestBed.resetTestingModule();
    configure();
    store = TestBed.inject(PlanStore);
    expect(store.plan(), 'saved plan not loaded').toEqual(saved);
    await open();
  }

  async function open() {
    fixture = TestBed.createComponent(GroceryList);
    await stable();
    element = fixture.nativeElement as HTMLElement;
  }

  // Under fake timers the render Angular schedules waits for a timer, which this runs while one is
  // pending. It runs the timers due now, then steps the clock 1 ms at a time, never jumping ahead to
  // a later timer: a render scheduled from inside a timer needs one step, as the fake timers make a
  // 0 ms timeout set while they run timers a 1 ms one
  async function stable() {
    let step = 0;
    while (vi.isFakeTimers() && !fixture.isStable() && vi.getTimerCount() > 0) {
      await vi.advanceTimersByTimeAsync(step);
      step = 1;
    }
    await fixture.whenStable();
  }

  // jsdom doesn't focus what is clicked, unlike a browser
  async function click(target: HTMLElement) {
    target.focus();
    target.click();
    await stable();
  }

  // Space on the checkbox, without click(): jsdom takes any click for a pointer and then doesn't
  // match :focus-visible, while a browser still does after the click a key sends
  async function press(checkbox: HTMLInputElement) {
    checkbox.focus();
    checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    checkbox.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await stable();
  }

  // The component reads RECIPES itself, so the test adds the ingredient to the planned recipes,
  // sized to give each meal its share for the plan's people, and takes it out again afterwards
  function addToPlannedRecipes(name: string, lunchShare: number, dinnerShare: number) {
    const [{ lunch, dinner }] = store.plan().days;
    const meals: [string | null, number][] = [
      [lunch.recipe, lunchShare],
      [dinner.recipe, dinnerShare],
    ];
    for (const [recipeName, share] of meals) {
      const recipe = RECIPES.find((candidate) => candidate.name === recipeName);
      expect(recipe, `no recipe "${recipeName}"`).toBeDefined();
      expect(
        recipe!.ingredients.some((ingredient) => ingredient.name === name),
        `"${recipeName}" already has ${name}`,
      ).toBe(false);
      const original = [...recipe!.ingredients];
      recipe!.ingredients.push({
        name,
        amount: (share * recipe!.servings) / store.plan().people,
        unit: 'ml',
      });
      restores.push(() => recipe!.ingredients.splice(0, Infinity, ...original));
    }
  }

  async function add(text: string) {
    await type(text);
    await click(addButton());
  }

  function addButton(): HTMLButtonElement {
    const button = buttonsIn(element).find((candidate) => textOf(candidate) === 'Add');
    expect(button, 'no "Add" button').toBeDefined();
    return button!;
  }

  async function type(text: string) {
    field().value = text;
    field().dispatchEvent(new Event('input', { bubbles: true }));
    await stable();
  }

  // Unless the keydown is handled, a browser submits the field's form on Enter, which jsdom doesn't
  async function pressEnter() {
    const enter = { key: 'Enter', bubbles: true, cancelable: true };
    if (field().dispatchEvent(new KeyboardEvent('keydown', enter))) {
      field().form?.requestSubmit();
    }
    field().dispatchEvent(new KeyboardEvent('keyup', enter));
    await stable();
  }

  function field(): HTMLInputElement {
    const input = element.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
    expect(input, 'no field to add items').not.toBeNull();
    return input!;
  }

  async function pressRemove(item: HTMLElement) {
    await pressButton(removeButtonOf(item), ' ');
  }

  // The key on the button, then the click a browser sends on keyup (on keydown for Enter). jsdom
  // takes any click event for a pointer, so the button's parent repeats the keyup while the click is
  // on its way to the button, which makes jsdom see the key as the last input again, as a browser
  // would
  async function pressButton(button: HTMLButtonElement, key: ' ' | 'Enter') {
    const keyup = () => button.dispatchEvent(new KeyboardEvent('keyup', { key }));
    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    button.parentElement!.addEventListener('click', keyup, { capture: true, once: true });
    button.click();
    await stable();
  }

  function removeButtonOf(item: HTMLElement): HTMLButtonElement {
    const button = buttonsIn(item).find((candidate) => textOf(candidate) === 'Remove');
    expect(button, `no "Remove" button on "${labelOf(item)}"`).toBeDefined();
    return button!;
  }

  function buttonsIn(node: Element | null): HTMLButtonElement[] {
    return Array.from(node?.querySelectorAll('button') ?? []);
  }

  function expectStatusShownAndEmpty(when: string) {
    const status = statusElement();
    expect(statusText(), `status text ${when}`).toBe('');
    expect(status.hasAttribute('hidden'), `hidden attribute ${when}`).toBe(false);
    const style = getComputedStyle(status);
    expect(style.display, `display ${when}`).not.toBe('none');
    expect(style.visibility, `visibility ${when}`).not.toBe('hidden');
  }

  // Trimmed only, unlike textOf: the inner spaces of an entry are part of the text
  function statusText(): string {
    return (statusElement().textContent ?? '').trim();
  }

  function statusElement(): HTMLElement {
    const found = element.querySelectorAll<HTMLElement>('[role="status"]');
    expect(found, 'status elements').toHaveLength(1);
    expect(found[0].tagName, 'status element').toBe('P');
    return found[0];
  }

  function sectionHeaded(heading: string): HTMLElement {
    const section = sections().find(
      (candidate) => textOf(candidate.querySelector('h2')) === heading,
    );
    expect(section, `no section "${heading}"`).toBeDefined();
    return section!;
  }

  function labelsIn(section: HTMLElement): string[] {
    return listedIn(section).map(labelOf);
  }

  // Only the label: an added item's line also holds its "Remove" button
  function labelOf(item: HTMLElement): string {
    return textOf(item.querySelector('label'));
  }

  function sections(): HTMLElement[] {
    return Array.from(element.querySelectorAll('section'));
  }

  function sectionWithSeveralLines(): HTMLElement {
    const section = sections().find((candidate) => listedIn(candidate).length > 1);
    expect(section, 'no section with several lines').toBeDefined();
    return section!;
  }

  function listed(): HTMLElement[] {
    return sections().flatMap(listedIn);
  }

  function listedIn(section: HTMLElement): HTMLElement[] {
    return Array.from(section.querySelectorAll('ul.items > li'));
  }

  function cart(): HTMLDetailsElement | null {
    return element.querySelector('details.cart');
  }

  function inCart(): HTMLElement[] {
    return Array.from(element.querySelectorAll('details.cart ul.items > li'));
  }

  function checkboxOf(item: HTMLElement): HTMLInputElement {
    const checkbox = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox, `no checkbox in "${textOf(item)}"`).not.toBeNull();
    return checkbox!;
  }

  function lineOf(item: GroceryItem): string {
    const shown = displayAmount(item);
    return `${shown.amount} ${shown.unit} ${item.name}`;
  }

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});
