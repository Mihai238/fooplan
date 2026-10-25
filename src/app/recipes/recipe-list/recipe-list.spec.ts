import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RECIPES } from '../recipes';
import { RecipeList } from './recipe-list';

describe('RecipeList', () => {
  let fixture: ComponentFixture<RecipeList>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(RecipeList);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows each recipe with its name, servings and every ingredient with amount, unit and name', () => {
    expectAllRecipesRendered();
    articles().forEach((article, i) => {
      const recipe = RECIPES[i];
      expect(textOf(article.querySelector('h2')!), `name of article ${i}`).toBe(recipe.name);
      expect(textOf(article), `servings of "${recipe.name}"`).toContain(
        `${recipe.servings} servings`,
      );
      expect(
        Array.from(article.querySelectorAll('li')).map(textOf),
        `ingredients of "${recipe.name}"`,
      ).toEqual(
        recipe.ingredients.map(
          (ingredient) => `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`,
        ),
      );
    });
  });

  it('lists exactly as many ingredients per article as the recipe has', () => {
    expectAllRecipesRendered();
    articles().forEach((article, i) => {
      expect(article.querySelectorAll('li').length, `ingredients of "${RECIPES[i].name}"`).toBe(
        RECIPES[i].ingredients.length,
      );
    });
  });

  it('shows the recipes in RECIPES order', () => {
    expectAllRecipesRendered();
    expect(articles().map((article) => textOf(article.querySelector('h2')!))).toEqual(
      RECIPES.map((recipe) => recipe.name),
    );
  });

  it('shows an empty search field labelled "Search recipes" above the list and lists all recipes on open', () => {
    const field = searchField();
    expect(field.value).toBe('');
    expectAllRecipesRendered();
    expect(
      field.compareDocumentPosition(articles()[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
      'search field not above the list',
    ).toBeTruthy();
  });

  it('lists only the recipes matching what the user types, in RECIPES order', async () => {
    await search('spaghetti');
    expect(listedNames()).toEqual([
      'Spaghetti pomodoro',
      'Spaghetti carbonara',
      'Spaghetti bolognese',
      'Spaghetti aglio e olio',
    ]);
  });

  it('says that no recipe matches and shows no recipe when nothing matches the search', async () => {
    await search('xyzzy');
    expect(textOf(element)).toMatch(/no recipe matches/i);
    expect(articles()).toEqual([]);
    expect(element.querySelector('.grid'), 'empty grid shown').toBeNull();
  });

  it('does not say that no recipe matches while recipes are listed', async () => {
    expect(textOf(element)).not.toMatch(/no recipe matches/i);
    await search('feta');
    expect(articles().length, 'recipes listed').toBeGreaterThan(0);
    expect(textOf(element)).not.toMatch(/no recipe matches/i);
  });

  it('lists all recipes again in RECIPES order when the user clears the search', async () => {
    await search('spaghetti');
    expect(articles(), 'search not applied').toHaveLength(4);
    await search('');
    expect(listedNames()).toEqual(RECIPES.map((recipe) => recipe.name));
  });

  it('drops the no-match text when the user clears a search that matched nothing', async () => {
    await search('xyzzy');
    expect(textOf(element), 'no-match text not shown').toMatch(/no recipe matches/i);
    await search('');
    expect(textOf(element)).not.toMatch(/no recipe matches/i);
    expectAllRecipesRendered();
  });

  async function search(text: string) {
    const field = searchField();
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function searchField(): HTMLInputElement {
    const field = Array.from(
      element.querySelectorAll<HTMLInputElement>('input[type="search"]'),
    ).find(
      (input) =>
        input.getAttribute('aria-label') === 'Search recipes' ||
        Array.from(input.labels ?? []).some((label) => textOf(label) === 'Search recipes'),
    );
    expect(field, 'no search field labelled "Search recipes"').toBeDefined();
    return field!;
  }

  function listedNames(): string[] {
    return articles().map((article) => textOf(article.querySelector('h2')!));
  }

  function articles(): HTMLElement[] {
    return Array.from(element.querySelectorAll('article'));
  }

  function textOf(node: Element): string {
    return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function expectAllRecipesRendered() {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
    expect(articles()).toHaveLength(RECIPES.length);
  }
});
