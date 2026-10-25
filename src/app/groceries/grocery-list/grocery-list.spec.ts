import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlanStore, RANDOM, TODAY } from '../../plan/plan-store';
import { acceptOneDayPlan, seededRandom } from '../../plan/testing';
import { displayAmount } from '../../recipes/amount';
import { RECIPES } from '../../recipes/recipes';
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
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
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

  async function open() {
    fixture = TestBed.createComponent(GroceryList);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  // jsdom doesn't focus what is clicked, unlike a browser
  async function click(target: HTMLElement) {
    target.focus();
    target.click();
    await fixture.whenStable();
  }

  // Space on the checkbox, without click(): jsdom takes any click for a pointer and then doesn't
  // match :focus-visible, while a browser still does after the click a key sends
  async function press(checkbox: HTMLInputElement) {
    checkbox.focus();
    checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    checkbox.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
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
