import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RANDOM, TODAY } from '../plan-store';
import { seededRandom } from '../testing';
import { PlanPage } from './plan-page';

describe('PlanPage', () => {
  let fixture: ComponentFixture<PlanPage>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: RANDOM, useValue: seededRandom(1) },
        // A Saturday
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
    fixture = TestBed.createComponent(PlanPage);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
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

  it('shows the picked recipe and no suggestions for a meal once the user picks one of its two suggestions', async () => {
    expect(suggestionsOf(meal(0)), 'suggestions of the first meal').toHaveLength(2);
    const recipe = textOf(suggestionsOf(meal(0))[1]);
    await click(suggestionsOf(meal(0))[1]);
    expect(textOf(meal(0).querySelector('p.recipe'))).toBe(recipe);
    expect(suggestionsOf(meal(0))).toEqual([]);
  });

  it('shows a different pair of suggestions when the user clicks "Other suggestions"', async () => {
    const before = suggestionsOf(meal(0)).map(textOf);
    expect(before, 'suggestions of the first meal').toHaveLength(2);
    await click(button(meal(0), 'Other suggestions'));
    const after = suggestionsOf(meal(0)).map(textOf);
    expect(after).toHaveLength(2);
    expect(after.filter((name) => before.includes(name))).toEqual([]);
  });

  it('opens a picked meal again with two suggestions when the user clicks "Clear"', async () => {
    await pickFirstSuggestion(0);
    await click(button(meal(0), 'Clear'));
    expect(meal(0).querySelector('p.recipe')).toBeNull();
    expect(suggestionsOf(meal(0))).toHaveLength(2);
  });

  it('disables "Accept plan" while a meal is open and enables it once every meal has a recipe', async () => {
    await setInput('days', '1');
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await pickFirstSuggestion(0);
    expect(button(element, 'Accept plan').disabled).toBe(true);
    await pickFirstSuggestion(1);
    expect(button(element, 'Accept plan').disabled).toBe(false);
  });

  it('shows an accepted plan read-only, without day, people, pick, "Clear", "Other suggestions" or "Accept plan" controls', async () => {
    const recipes = await acceptOneDayPlan();
    expect(Array.from(element.querySelectorAll('p.recipe')).map(textOf)).toEqual(recipes);
    expect(element.querySelectorAll('input')).toHaveLength(0);
    expect(element.querySelectorAll('button.suggestion')).toHaveLength(0);
    expect(buttonTexts()).not.toContain('Clear');
    expect(buttonTexts()).not.toContain('Other suggestions');
    expect(buttonTexts()).not.toContain('Accept plan');
  });

  it('offers "New plan" both while planning and for an accepted plan', async () => {
    expect(buttonTexts()).toContain('New plan');
    await acceptOneDayPlan();
    expect(buttonTexts()).toContain('New plan');
  });

  it('starts a fresh plan when the user clicks "New plan" on a plan in progress and confirms', async () => {
    await setInput('days', '3');
    await pickFirstSuggestion(0);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click(button(element, 'New plan'));
    expect(confirm).toHaveBeenCalledWith('Discard this plan and start a new one?');
    expect(input('days').value).toBe('5');
    expect(days()).toHaveLength(5);
    expect(element.querySelectorAll('p.recipe')).toHaveLength(0);
    for (const article of Array.from(element.querySelectorAll<HTMLElement>('article.meal'))) {
      expect(suggestionsOf(article)).toHaveLength(2);
    }
  });

  it('keeps the plan in progress when the user clicks "New plan" and cancels', async () => {
    await setInput('days', '3');
    await pickFirstSuggestion(0);
    const before = textOf(element.querySelector('.days'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await click(button(element, 'New plan'));
    expect(confirm).toHaveBeenCalled();
    expect(input('days').value).toBe('3');
    expect(textOf(element.querySelector('.days'))).toBe(before);
  });

  it('shows an empty plan when the user clicks "New plan" and confirms', async () => {
    await acceptOneDayPlan();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click(button(element, 'New plan'));
    expect(confirm).toHaveBeenCalledWith('Discard this plan and start a new one?');
    expect(days().length).toBeGreaterThan(0);
    expect(element.querySelectorAll('p.recipe')).toHaveLength(0);
    for (const article of Array.from(element.querySelectorAll<HTMLElement>('article.meal'))) {
      expect(suggestionsOf(article)).toHaveLength(2);
    }
    expect(element.querySelector('input#days')).not.toBeNull();
    expect(button(element, 'Accept plan').disabled).toBe(true);
  });

  it('keeps the accepted plan when the user clicks "New plan" and cancels', async () => {
    const recipes = await acceptOneDayPlan();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await click(button(element, 'New plan'));
    expect(confirm).toHaveBeenCalled();
    expect(Array.from(element.querySelectorAll('p.recipe')).map(textOf)).toEqual(recipes);
    expect(element.querySelectorAll('input')).toHaveLength(0);
    expect(buttonTexts()).toContain('New plan');
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

  function buttonTexts(): string[] {
    return Array.from(element.querySelectorAll('button')).map(textOf);
  }

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});
