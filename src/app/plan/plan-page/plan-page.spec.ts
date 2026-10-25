import { ComponentFixture, TestBed } from '@angular/core/testing';
import { groceryList, itemKey } from '../../groceries/groceries';
import { RECIPES } from '../../recipes/recipes';
import { PlanStore, RANDOM, TODAY } from '../plan-store';
import { seededRandom } from '../testing';
import { PlanPage } from './plan-page';

const TABBABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const modalDialogs = new WeakSet<HTMLDialogElement>();

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
    TestBed.configureTestingModule({
      providers: [
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => today },
      ],
    });
    fixture = TestBed.createComponent(PlanPage);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
    store = TestBed.inject(PlanStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the "Plan" heading and the default 5 days for 2 people on first open', () => {
    expect(textOf(element.querySelector('h1'))).toBe('Plan');
    expect(input('days').value).toBe('5');
    expect(input('people').value).toBe('2');
    expect(days()).toHaveLength(5);
  });

  it('shows 3 days starting today, each with a lunch and a dinner, when the user sets 3 days and 2 people', async () => {
    await setInput('days', '3');
    await setInput('people', '2');
    expect(days().map((day) => textOf(day.querySelector('h2')))).toEqual([
      'Sat 24 Oct',
      'Sun 25 Oct',
      'Mon 26 Oct',
    ]);
    for (const day of days()) {
      const meals = Array.from(day.querySelectorAll('article.meal'));
      expect(meals.map((meal) => textOf(meal.querySelector('h3')))).toEqual(['Lunch', 'Dinner']);
    }
    expect(input('people').value).toBe('2');
  });

  it('resets the days and people fields when the user enters 6 days or 0 people', async () => {
    await setInput('days', '6');
    expect(input('days').value).toBe('5');
    expect(days()).toHaveLength(5);
    await setInput('people', '0');
    expect(input('people').value).toBe('2');
  });

  it('shows the picked recipe and no suggestions for a meal once the user picks one of its three suggestions', async () => {
    expect(suggestionsOf(meal(0)), 'suggestions of the first meal').toHaveLength(3);
    const recipe = textOf(suggestionsOf(meal(0))[1]);
    await click(suggestionsOf(meal(0))[1]);
    expect(textOf(meal(0).querySelector('p.recipe'))).toBe(recipe);
    expect(suggestionsOf(meal(0))).toEqual([]);
  });

  it('shows three other suggestions when the user clicks "Other suggestions"', async () => {
    const before = suggestionsOf(meal(0)).map(textOf);
    expect(before, 'suggestions of the first meal').toHaveLength(3);
    await click(button(meal(0), 'Other suggestions'));
    const after = suggestionsOf(meal(0)).map(textOf);
    expect(after).toHaveLength(3);
    expect(after.filter((name) => before.includes(name))).toEqual([]);
  });

  it('offers "Undo" and no "Clear" on a picked meal of a plan in progress', async () => {
    await pickFirstSuggestion(0);
    expect(buttonTexts(meal(0))).toContain('Undo');
    expect(buttonTexts(meal(0))).not.toContain('Clear');
  });

  it('offers "Undo" neither on an open meal nor on any meal once the plan is accepted', async () => {
    await setInput('days', '1');
    await pickFirstSuggestion(0);
    expect(buttonTexts(meal(0)), 'picked meal').toContain('Undo');
    expect(buttonTexts(meal(1)), 'open meal').not.toContain('Undo');
    await pickFirstSuggestion(1);
    await click(button(element, 'Accept plan'));
    expect(buttonTexts(), 'plan not accepted').not.toContain('Accept plan');
    expect(buttonTexts()).not.toContain('Undo');
  });

  it('shows the same three suggestions in the same order, and not while the meal is picked, when the user picks one and clicks "Undo"', async () => {
    const before = suggestionsOf(meal(0)).map(textOf);
    expect(before, 'suggestions of the first meal').toHaveLength(3);
    await click(suggestionsOf(meal(0))[1]);
    expect(textOf(meal(0).querySelector('p.recipe'))).toBe(before[1]);
    expect(buttonTexts(meal(0)), 'buttons of the picked meal').toEqual(['Undo']);

    await click(button(meal(0), 'Undo'));
    expect(meal(0).querySelector('p.recipe')).toBeNull();
    expect(suggestionsOf(meal(0)).map(textOf)).toEqual(before);
  });

  it('disables "Accept plan" while a meal is open and enables it once every meal has a recipe', async () => {
    await setInput('days', '1');
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await pickFirstSuggestion(0);
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await pickFirstSuggestion(1);
    expect(button(element, 'Accept plan').disabled).toBe(false);
  });

  it('shows "Leftovers: <recipe>" without suggestions or buttons for the next lunch when the user turns on "Cook extra for tomorrow\'s lunch"', async () => {
    await setInput('days', '2');
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
    await setInput('days', '2');
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
    await setInput('days', '2');
    await pickFirstSuggestion(0);
    await pickFirstSuggestion(1);
    await pickFirstSuggestion(3);
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await setCookExtra(0, true);
    expect(button(element, 'Accept plan').disabled).toBe(false);
  });

  it('shows "Cook extra" of an accepted plan as a note on its dinner only, without the option', async () => {
    await setInput('days', '3');
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

  describe('"New plan" dialog', () => {
    // jsdom lays out nothing, so the dialog's box is stubbed, and these points are placed around it
    const BOX = { left: 100, top: 100, right: 400, bottom: 300 } as DOMRect;
    const OUTSIDE = { clientX: 50, clientY: 50 };
    const PADDING = { clientX: 110, clientY: 110 };
    const INSIDE = { clientX: 250, clientY: 200 };

    beforeEach(() => {
      const dialog = element.querySelector('dialog');
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
      const ids = (openDialog().getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
      expect(ids.map((id) => textOf(document.getElementById(id))).join(' ')).toBe(
        'Start a new plan?',
      );
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
      await setInput('days', '1');
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
      await setInput('days', '3');
      await setInput('people', '3');
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      const dialog = openDialog();
      expect(textOf(dialog)).toContain('The new plan starts today, for 5 days and 3 people');
      expect(document.activeElement).toBe(button(dialog, 'Keep this plan'));
    });

    it('says "1 person" in the singular for a plan for 1 person', async () => {
      await setInput('people', '1');
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
      await setInput('people', '3');
      await acceptOneDayPlan();
      store.toggleTicked(itemKey(groceryList(store.plan(), RECIPES)[0]));
      store.addItem('Toilet paper');
      await fixture.whenStable();
      await click(button(element, 'New plan'));
      today = '2026-10-26';
      await click(button(openDialog(), 'Start new plan'));
      expect(openDialogOrNull()).toBeNull();
      expectEmptyPlanFrom26Oct();
      expect(input('people').value).toBe('3');
      expect(store.plan()).toMatchObject({ people: 3, accepted: false, ticked: [], added: [] });
      expect(button(element, 'Accept plan').disabled).toBe(true);
    });

    it('starts an empty 5-day plan from today for the same people when the user clicks "Start new plan" on a plan in progress', async () => {
      await setInput('days', '3');
      await setInput('people', '4');
      await pickFirstSuggestion(0);
      await click(button(element, 'New plan'));
      today = '2026-10-26';
      await click(button(openDialog(), 'Start new plan'));
      expect(openDialogOrNull()).toBeNull();
      expectEmptyPlanFrom26Oct();
      expect(input('people').value).toBe('4');
    });

    it("starts the new plan right away, without the dialog or the browser's confirm box, for an unaccepted plan with no filled meal", async () => {
      await setInput('days', '3');
      await setInput('people', '4');
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
      today = '2026-10-26';
      await click(button(element, 'New plan'));
      expect(openDialogOrNull()).toBeNull();
      expect(showModal).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expectEmptyPlanFrom26Oct();
      expect(input('people').value).toBe('4');
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
      await setInput('days', '3');
      await pickFirstSuggestion(0);
      const before = store.plan();
      const shown = textOf(element.querySelector('.days'));
      await click(button(element, 'New plan'));
      await keep();
      expect(openDialogOrNull()).toBeNull();
      expect(store.plan()).toBe(before);
      expect(textOf(element.querySelector('.days'))).toBe(shown);
      expect(input('days').value).toBe('3');
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
      expect(input('days').value).toBe('5');
      expect(element.querySelectorAll('p.recipe')).toHaveLength(0);
      for (const article of Array.from(element.querySelectorAll<HTMLElement>('article.meal'))) {
        expect(suggestionsOf(article)).toHaveLength(3);
      }
    }

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

    function lostParagraph(): string {
      const paragraphs = Array.from(openDialog().querySelectorAll('p')).map(textOf);
      const lost = paragraphs.find((text) => text.includes('Sat 24 Oct'));
      expect(
        lost,
        `no paragraph with the plan's dates in ${JSON.stringify(paragraphs)}`,
      ).toBeDefined();
      return lost!;
    }

    function openDialog(): HTMLDialogElement {
      const dialog = openDialogOrNull();
      expect(dialog, 'no open dialog').not.toBeNull();
      return dialog!;
    }

    function openDialogOrNull(): HTMLDialogElement | null {
      return element.querySelector('dialog[open]');
    }
  });

  async function acceptOneDayPlan(): Promise<string[]> {
    await setInput('days', '1');
    const recipes = [await pickFirstSuggestion(0), await pickFirstSuggestion(1)];
    await click(button(element, 'Accept plan'));
    return recipes;
  }

  async function pickFirstSuggestion(mealIndex: number): Promise<string> {
    const suggestions = suggestionsOf(meal(mealIndex));
    expect(suggestions.length, `suggestions of meal ${mealIndex}`).toBeGreaterThan(0);
    const recipe = textOf(suggestions[0]);
    await click(suggestions[0]);
    return recipe;
  }

  async function setCookExtra(dayIndex: number, on: boolean) {
    const checkbox = input(`cook-extra-${dayIndex}`);
    checkbox.checked = on;
    checkbox.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function setInput(id: string, value: string) {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function click(target: HTMLElement) {
    target.click();
    await fixture.whenStable();
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

// jsdom has no showModal() or close(). These follow the browser as far as the tests need: opening
// focuses the dialog's autofocus element, else its first focusable one; closing puts the focus back
// on the element focused before opening (none when "New plan" was clicked without focusing it, as
// Safari does on a click) and fires "close". The page behind isn't made inert here; jsdom can't tell
// a modal dialog, so modalDialogs records the dialogs opened with showModal(). Returns what puts
// jsdom's own back
function installDialog(): () => void {
  const prototype = HTMLDialogElement.prototype;
  const names = ['showModal', 'close'] as const;
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(prototype, name));
  const focusedBefore = new WeakMap<HTMLDialogElement, Element | null>();
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    if (this.open) {
      return;
    }
    focusedBefore.set(this, document.activeElement);
    this.setAttribute('open', '');
    modalDialogs.add(this);
    const target =
      this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector<HTMLElement>(TABBABLE);
    target?.focus();
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) {
      return;
    }
    this.removeAttribute('open');
    modalDialogs.delete(this);
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.contains(active)) {
      active.blur();
    }
    const previous = focusedBefore.get(this);
    if (previous instanceof HTMLElement && previous.isConnected) {
      previous.focus();
    }
    this.dispatchEvent(new Event('close'));
  };
  return () => {
    names.forEach((name, i) => {
      const original = originals[i];
      if (original) {
        Object.defineProperty(prototype, name, original);
      } else {
        Reflect.deleteProperty(prototype, name);
      }
    });
  };
}
