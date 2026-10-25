import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { displayAmount } from '../amount';
import { RECIPES } from '../recipes';
import { RecipeList } from './recipe-list';

describe('RecipeList', () => {
  let fixture: ComponentFixture<RecipeList>;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Blank }])],
    });
    fixture = TestBed.createComponent(RecipeList);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows each recipe with its name, servings and every ingredient with its displayed amount and name', () => {
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
        recipe.ingredients.map((ingredient) => {
          const shown = displayAmount(ingredient);
          return `${shown.amount} ${shown.unit} ${ingredient.name}`;
        }),
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

  it('shows the 15 ml vegetable oil of "Teriyaki chicken with rice" as "1 tbsp vegetable oil"', () => {
    const lines = ingredientLinesOf('Teriyaki chicken with rice');
    expect(lines).toContain('1 tbsp vegetable oil');
    expect(lines).not.toContain('15 ml vegetable oil');
  });

  it('keeps 900 ml vegetable oil of "Fish and chips" and 50 ml milk of "Baked potatoes with herb quark" in ml', () => {
    expect(ingredientLinesOf('Fish and chips')).toContain('900 ml vegetable oil');
    expect(ingredientLinesOf('Baked potatoes with herb quark')).toContain('50 ml milk');
  });

  it("links each recipe's name to its recipe page, which a click opens", async () => {
    expectAllRecipesRendered();
    const links = articles().map((article, i) => {
      const found = article.querySelectorAll<HTMLAnchorElement>('h2 a');
      expect(found, `links in the name of "${RECIPES[i].name}"`).toHaveLength(1);
      expect(textOf(found[0]), `link text of "${RECIPES[i].name}"`).toBe(RECIPES[i].name);
      return found[0];
    });
    const hrefs = links.map((link) => link.getAttribute('href'));
    for (const href of hrefs) {
      expect(href).toMatch(/^\/recipes\/[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(hrefs).size, 'recipes sharing a link').toBe(RECIPES.length);
    expect(nameLinkOf("Shepherd's pie").getAttribute('href')).toBe('/recipes/shepherds-pie');
    expect(nameLinkOf('Käsespätzle').getAttribute('href')).toBe('/recipes/kasespatzle');
    expect(nameLinkOf('Spaghetti carbonara').getAttribute('href')).toBe(
      '/recipes/spaghetti-carbonara',
    );

    nameLinkOf("Shepherd's pie").click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/recipes/shepherds-pie');
  });

  it('links the name of a recipe the search lists to its recipe page', async () => {
    await search('nicoise');
    expect(listedNames()).toEqual(['Niçoise salad']);
    expect(nameLinkOf('Niçoise salad').getAttribute('href')).toBe('/recipes/nicoise-salad');
  });

  describe('match status', () => {
    it('shows one empty status element without tabindex or hidden attribute and all recipes when the page opens', () => {
      expectAllRecipesRendered();
      expect(element.querySelectorAll('[role="status"]'), 'status elements').toHaveLength(1);
      const status = statusElement();
      expect(statusText()).toBe('');
      expect(status.hasAttribute('tabindex'), 'tabindex').toBe(false);
      expect(status.hasAttribute('hidden'), 'hidden attribute').toBe(false);
    });

    it('keeps the focus in the search field while typing and does not take it on focus()', async () => {
      const field = searchField();
      field.focus();
      expect(document.activeElement, 'field not focused before typing').toBe(field);
      await search('spag');
      expect(statusText(), 'count not shown').toBe('4 recipes match "spag".');
      expect(document.activeElement, 'focus after typing').toBe(field);
      statusElement().focus();
      expect(document.activeElement, 'status element took the focus').toBe(field);
    });

    it('never hides the empty status element with the hidden attribute, display: none or visibility: hidden', async () => {
      expectStatusShownAndEmpty('on open');
      await search('xyzzy');
      await search('');
      expectStatusShownAndEmpty('after clearing a search that matched nothing');
      await search('   ');
      expectStatusShownAndEmpty('with a search of only spaces');
    });

    it('says "4 recipes match "spaghetti"." and lists 4 recipes when the user types "spaghetti"', async () => {
      await search('spaghetti');
      expect(statusText()).toBe('4 recipes match "spaghetti".');
      expect(articles()).toHaveLength(4);
    });

    it('places the status element after the search field and before the first card', async () => {
      await search('spaghetti');
      const status = statusElement();
      expect(
        searchField().compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING,
        'status not after the search field',
      ).toBeTruthy();
      expect(
        status.compareDocumentPosition(articles()[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
        'status not before the first card',
      ).toBeTruthy();
      expect(status.contains(articles()[0]), 'cards inside the status element').toBe(false);
    });

    it('uses the plural for a search matching exactly 2 recipes', async () => {
      await search('goulash');
      expect(statusText()).toBe('2 recipes match "goulash".');
      expect(listedNames()).toEqual(['Goulash with bread', 'Potato goulash']);
    });

    it('says "1 recipe matches "carbonara"." and lists 1 recipe when the user types "carbonara"', async () => {
      await search('carbonara');
      expect(statusText()).toBe('1 recipe matches "carbonara".');
      expect(listedNames()).toEqual(['Spaghetti carbonara']);
    });

    it('says "60 recipes match "s"." and lists all recipes when the user types "s"', async () => {
      await search('s');
      expect(statusText()).toBe(`${RECIPES.length} recipes match "s".`);
      expect(RECIPES.length, 'recipes loaded').toBe(60);
      expectAllRecipesRendered();
    });

    it('quotes the search without its surrounding spaces and with its case in the count', async () => {
      await search('  Spaghetti  ');
      expect(statusText()).toBe('4 recipes match "Spaghetti".');
    });

    it('says "No recipe matches "xyzzy"." in the status element, once on the page, without listing any recipe', async () => {
      await search('xyzzy');
      expect(statusText()).toBe('No recipe matches "xyzzy".');
      expect(articles()).toEqual([]);
      expect(element.querySelector('.grid'), 'empty grid shown').toBeNull();
      expect(
        (element.textContent ?? '').match(/No recipe matches/g) ?? [],
        'occurrences of the no-match text',
      ).toHaveLength(1);
    });

    it('quotes a search that matches nothing without its surrounding spaces', async () => {
      await search('  xyzzy  ');
      expect(statusText()).toBe('No recipe matches "xyzzy".');
    });

    it('keeps both inner spaces of "feta  quiche" in the no-match text', async () => {
      await search('feta  quiche');
      expect(statusText()).toBe('No recipe matches "feta  quiche".');
    });

    it('updates the count to "6 recipes match "spa"." and lists 6 recipes when the user deletes the "g" of "spag"', async () => {
      await search('spag');
      expect(statusText(), 'count before deleting').toBe('4 recipes match "spag".');
      await search('spa');
      expect(statusText()).toBe('6 recipes match "spa".');
      expect(articles()).toHaveLength(6);
    });

    it('replaces the no-match text with the count when a deletion makes recipes match again', async () => {
      await search('spaghettix');
      expect(statusText(), 'no-match text before deleting').toBe('No recipe matches "spaghettix".');
      await search('spaghetti');
      expect(statusText()).toBe('4 recipes match "spaghetti".');
      expect(articles()).toHaveLength(4);
    });

    it('empties the status element and lists all recipes when the user empties the field or types only spaces', async () => {
      await search('spaghetti');
      expect(statusText(), 'count not shown').toBe('4 recipes match "spaghetti".');
      await search('');
      expectAllRecipesRendered();
      expect(statusText(), 'status after emptying the field').toBe('');
      await search('   ');
      expectAllRecipesRendered();
      expect(statusText(), 'status with only spaces').toBe('');
    });

    it('keeps the same status element while the count, the no-match text and the empty search follow each other', async () => {
      const status = statusElement();
      await search('spaghetti');
      expect(statusElement(), 'element after "spaghetti"').toBe(status);
      expect(statusText()).toBe('4 recipes match "spaghetti".');
      await search('xyzzy');
      expect(statusElement(), 'element after "xyzzy"').toBe(status);
      expect(statusText()).toBe('No recipe matches "xyzzy".');
      await search('');
      expect(statusElement(), 'element after emptying the field').toBe(status);
      expect(statusText()).toBe('');
    });
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

  function expectStatusShownAndEmpty(when: string) {
    const status = statusElement();
    expect(statusText(), `status text ${when}`).toBe('');
    expect(status.hasAttribute('hidden'), `hidden attribute ${when}`).toBe(false);
    const style = getComputedStyle(status);
    expect(style.display, `display ${when}`).not.toBe('none');
    expect(style.visibility, `visibility ${when}`).not.toBe('hidden');
  }

  function statusText(): string {
    return (statusElement().textContent ?? '').trim();
  }

  function statusElement(): HTMLElement {
    const found = element.querySelectorAll<HTMLElement>('[role="status"]');
    expect(found, 'status elements').toHaveLength(1);
    expect(found[0].tagName, 'status element').toBe('P');
    return found[0];
  }

  function ingredientLinesOf(name: string): string[] {
    const article = articles().find((candidate) => textOf(candidate.querySelector('h2')!) === name);
    expect(article, `"${name}" not shown`).toBeDefined();
    return Array.from(article!.querySelectorAll('li')).map(textOf);
  }

  function nameLinkOf(name: string): HTMLAnchorElement {
    const article = articles().find((candidate) => textOf(candidate.querySelector('h2')!) === name);
    expect(article, `"${name}" not shown`).toBeDefined();
    const link = article!.querySelector<HTMLAnchorElement>('h2 a');
    expect(link, `no link in the name of "${name}"`).not.toBeNull();
    return link!;
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

@Component({ template: '' })
class Blank {}
