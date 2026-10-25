import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PlanStore, RANDOM, TODAY } from '../../plan/plan-store';
import { leaveSuggested, seededRandom } from '../../plan/testing';
import { displayAmount } from '../amount';
import { RecipeStore } from '../recipe-store';
import { RECIPES } from '../recipes';
import { ownRecipe, PLAIN_RICE, QUICK_DAL, storeOwnRecipes } from '../testing';
import { RecipeList } from './recipe-list';

const LIMIT_NOTE = 'At least 15 recipes stay suggested, so no more can be removed.';

const EASY_RECIPES = [
  'Hummus plate with bread and vegetables',
  'Avocado toast with fried egg',
  'Caprese salad with bread',
  'Spinach and feta omelette',
  'Tuna and white bean salad with bread',
];

describe('RecipeList', () => {
  let fixture: ComponentFixture<RecipeList>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    configure();
    await openPage();
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
    expect(articles(), 'search not applied').toHaveLength(3);
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

  it('keeps 700 ml milk of "Mac and cheese" and 250 ml beef stock of "Beef stroganoff with rice" in ml', () => {
    expect(ingredientLinesOf('Mac and cheese')).toContain('700 ml milk');
    expect(ingredientLinesOf('Beef stroganoff with rice')).toContain('250 ml beef stock');
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
    expect(nameLinkOf('Niçoise salad').getAttribute('href')).toBe('/recipes/nicoise-salad');
    expect(nameLinkOf('Oven-baked salmon with potatoes and green beans').getAttribute('href')).toBe(
      '/recipes/oven-baked-salmon-with-potatoes-and-green-beans',
    );
    expect(nameLinkOf('Spaghetti carbonara').getAttribute('href')).toBe(
      '/recipes/spaghetti-carbonara',
    );

    nameLinkOf('Niçoise salad').click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/recipes/nicoise-salad');
  });

  it('links the name of a recipe the search lists to its recipe page', async () => {
    await search('nicoise');
    expect(listedNames()).toEqual(['Niçoise salad']);
    expect(nameLinkOf('Niçoise salad').getAttribute('href')).toBe('/recipes/nicoise-salad');
  });

  it('shows a link "Add a recipe" to /add-recipe right after the heading, before the search field', () => {
    const links = Array.from(element.querySelectorAll('a')).filter(
      (link) => textOf(link) === 'Add a recipe',
    );
    expect(links, '"Add a recipe" links').toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/add-recipe');
    expect(element.querySelector('h1')?.nextElementSibling, 'element after the heading').toBe(
      links[0],
    );
    expect(
      links[0].compareDocumentPosition(searchField()) & Node.DOCUMENT_POSITION_FOLLOWING,
      'link not before the search field',
    ).toBeTruthy();
  });

  it('lists the own recipes "Grandma\'s Soup" and "Quick Dal" after all built-in recipes in the order added, each with "Your recipe" in a p.own between its servings and its p.suggest, and lists "Quick Dal" for the search "dal"', async () => {
    recipeStore().add(ownRecipe("Grandma's Soup"));
    recipeStore().add(QUICK_DAL);
    await reopenPage();

    expect(listedNames()).toEqual([
      ...RECIPES.map((recipe) => recipe.name),
      "Grandma's Soup",
      'Quick Dal',
    ]);
    for (const article of articles()) {
      const name = textOf(article.querySelector('h2')!);
      const own = article.querySelector('p.servings')?.nextElementSibling;
      if (name === "Grandma's Soup" || name === 'Quick Dal') {
        expect(own?.matches('p.own'), `p.own after the servings of "${name}"`).toBe(true);
        expect(textOf(own!), `p.own of "${name}"`).toBe('Your recipe');
        expect(own!.nextElementSibling?.matches('p.suggest'), `after p.own of "${name}"`).toBe(
          true,
        );
      } else {
        expect(article.querySelector('p.own'), `p.own of "${name}"`).toBeNull();
      }
    }

    await search('dal');
    expect(listedNames()).toEqual(['Quick Dal']);
    expect(statusText()).toBe('1 recipe matches "dal".');
  });

  it('shows "1 serving" on the card of an own recipe for 1 and "4 servings" on one for 4', async () => {
    recipeStore().add(ownRecipe('Single Soup', 1));
    recipeStore().add(ownRecipe('Family Stew', 4));
    await reopenPage();

    expect(servingsOf('Single Soup')).toBe('1 serving');
    expect(servingsOf('Family Stew')).toBe('4 servings');

    function servingsOf(name: string): string {
      const article = articles().find(
        (candidate) => textOf(candidate.querySelector('h2')!) === name,
      );
      expect(article, `"${name}" not shown`).toBeDefined();
      return textOf(article!.querySelector('p.servings') ?? article!);
    }
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
      expect(statusText(), 'count not shown').toBe('3 recipes match "spag".');
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

    it('says "3 recipes match "spaghetti"." and lists 3 recipes when the user types "spaghetti"', async () => {
      await search('spaghetti');
      expect(statusText()).toBe('3 recipes match "spaghetti".');
      expect(articles()).toHaveLength(3);
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
      await search('mozzarella');
      expect(statusText()).toBe('2 recipes match "mozzarella".');
      expect(listedNames()).toEqual([
        'Gnocchi with tomato sauce and mozzarella',
        'Caprese salad with bread',
      ]);
    });

    it('says "1 recipe matches "carbonara"." and lists 1 recipe when the user types "carbonara"', async () => {
      await search('carbonara');
      expect(statusText()).toBe('1 recipe matches "carbonara".');
      expect(listedNames()).toEqual(['Spaghetti carbonara']);
    });

    it('says "34 recipes match "s"." and lists all recipes when the user types "s"', async () => {
      await search('s');
      expect(statusText()).toBe(`${RECIPES.length} recipes match "s".`);
      expect(RECIPES.length, 'recipes loaded').toBe(34);
      expectAllRecipesRendered();
    });

    it('lists the 34 quick recipes on open, and says "34 recipes match "s".", "3 recipes match "spaghetti"." and "No recipe matches "kase"."', async () => {
      expect(articles()).toHaveLength(34);
      await search('s');
      expect(statusText()).toBe('34 recipes match "s".');
      expect(articles(), 'cards for "s"').toHaveLength(34);
      await search('spaghetti');
      expect(statusText()).toBe('3 recipes match "spaghetti".');
      await search('kase');
      expect(statusText()).toBe('No recipe matches "kase".');
      expect(articles(), 'cards for "kase"').toEqual([]);
    });

    it('lists 34 built-in recipes on open, and says "34 recipes match "s"." for "s" and "No recipe matches "soup"." for "soup"', async () => {
      expect(articles()).toHaveLength(34);
      await search('s');
      expect(statusText()).toBe('34 recipes match "s".');
      expect(articles(), 'cards for "s"').toHaveLength(34);
      await search('soup');
      expect(statusText()).toBe('No recipe matches "soup".');
      expect(articles(), 'cards for "soup"').toEqual([]);
    });

    it('lists no card whose name contains "soup", and says that no recipe matches "Soup" or the ingredients only the soups used, "lentil", "pumpkin", "leek" and "chive"', async () => {
      expect(listedNames().filter((name) => /soup/i.test(name))).toEqual([]);
      for (const text of ['Soup', 'lentil', 'pumpkin', 'leek', 'chive']) {
        await search(text);
        expect(statusText()).toBe(`No recipe matches "${text}".`);
        expect(articles(), `cards for "${text}"`).toEqual([]);
      }
    });

    it('says "1 recipe matches "soup"." and lists only the own recipe "Grandma\'s Soup", listed after the 34 built-in recipes, when the user types "soup"', async () => {
      recipeStore().add(ownRecipe("Grandma's Soup"));
      await reopenPage();
      expect(articles(), 'cards on open').toHaveLength(35);
      expect(listedNames().at(-1)).toBe("Grandma's Soup");

      await search('soup');
      expect(statusText()).toBe('1 recipe matches "soup".');
      expect(listedNames()).toEqual(["Grandma's Soup"]);
    });

    it('lists 34 cards on open, the 30th to 34th "Hummus plate with bread and vegetables", "Avocado toast with fried egg", "Caprese salad with bread", "Spinach and feta omelette" and "Tuna and white bean salad with bread", and says "34 recipes match "s"." for "s"', async () => {
      expect(articles()).toHaveLength(34);
      expect(listedNames().slice(29)).toEqual(EASY_RECIPES);
      await search('s');
      expect(statusText()).toBe('34 recipes match "s".');
    });

    it('says "1 recipe matches "hummus"." and lists only "Hummus plate with bread and vegetables" with "2 servings" and its 8 ingredient lines when the user types "hummus"', async () => {
      await search('hummus');
      expect(statusText()).toBe('1 recipe matches "hummus".');
      expect(listedNames()).toEqual(['Hummus plate with bread and vegetables']);
      expect(textOf(articles()[0])).toContain('2 servings');
      expect(ingredientLinesOf('Hummus plate with bread and vegetables')).toEqual([
        '200 g hummus',
        '200 g bread',
        '1 pc cucumber',
        '2 pc carrot',
        '150 g cherry tomato',
        '0.5 pc lemon',
        '1 tbsp olive oil',
        '1 tsp paprika',
      ]);
    });

    it('says "8 recipes match "bread"." and lists the 4 recipes with bread or breadcrumbs and the 4 easy ones with bread in RECIPES order when the user types "bread"', async () => {
      await search('bread');
      expect(statusText()).toBe('8 recipes match "bread".');
      expect(listedNames()).toEqual([
        'Chicken Caesar salad',
        'Shakshuka with bread',
        'Greek salad with feta and bread',
        'Mac and cheese',
        'Hummus plate with bread and vegetables',
        'Avocado toast with fried egg',
        'Caprese salad with bread',
        'Tuna and white bean salad with bread',
      ]);
    });

    it('says "1 recipe matches "omelette"." and lists only "Spinach and feta omelette" when the user types "omelette"', async () => {
      await search('omelette');
      expect(statusText()).toBe('1 recipe matches "omelette".');
      expect(listedNames()).toEqual(['Spinach and feta omelette']);
    });

    it('lists the own recipe "Grandma\'s Soup" right after "Tuna and white bean salad with bread", the last built-in recipe', async () => {
      recipeStore().add(ownRecipe("Grandma's Soup"));
      await reopenPage();
      expect(listedNames().slice(-2)).toEqual([
        'Tuna and white bean salad with bread',
        "Grandma's Soup",
      ]);
    });

    it('says "5 recipes match "cream"." and lists the 5 recipes with sour cream when the user types "cream"', async () => {
      await search('cream');
      expect(statusText()).toBe('5 recipes match "cream".');
      expect(listedNames()).toEqual([
        'Chicken fajitas',
        'Fish tacos',
        'Beef stroganoff with rice',
        'Chicken quesadillas',
        'Bean burritos',
      ]);
    });

    it('says "1 recipe matches "goulash"." and lists only "Potato goulash" when the user types "goulash"', async () => {
      await search('goulash');
      expect(statusText()).toBe('1 recipe matches "goulash".');
      expect(listedNames()).toEqual(['Potato goulash']);
    });

    it('quotes the search without its surrounding spaces and with its case in the count', async () => {
      await search('  Spaghetti  ');
      expect(statusText()).toBe('3 recipes match "Spaghetti".');
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

    it('updates the count to "8 recipes match "sp"." and lists 8 recipes when the user deletes the "a" of "spa"', async () => {
      await search('spa');
      expect(statusText(), 'count before deleting').toBe('3 recipes match "spa".');
      await search('sp');
      expect(statusText()).toBe('8 recipes match "sp".');
      expect(articles()).toHaveLength(8);
    });

    it('replaces the no-match text with the count when a deletion makes recipes match again', async () => {
      await search('spaghettix');
      expect(statusText(), 'no-match text before deleting').toBe('No recipe matches "spaghettix".');
      await search('spaghetti');
      expect(statusText()).toBe('3 recipes match "spaghetti".');
      expect(articles()).toHaveLength(3);
    });

    it('empties the status element and lists all recipes when the user empties the field or types only spaces', async () => {
      await search('spaghetti');
      expect(statusText(), 'count not shown').toBe('3 recipes match "spaghetti".');
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
      expect(statusText()).toBe('3 recipes match "spaghetti".');
      await search('xyzzy');
      expect(statusElement(), 'element after "xyzzy"').toBe(status);
      expect(statusText()).toBe('No recipe matches "xyzzy".');
      await search('');
      expect(statusElement(), 'element after emptying the field').toBe(status);
      expect(statusText()).toBe('');
    });
  });

  describe('"Don\'t suggest" and "Suggest again"', () => {
    it('shows a "Don\'t suggest <recipe>" button in a p.suggest between the servings and the ingredients of every card, which turns into "Not suggested" and a focused "Suggest again: Shakshuka with bread", and back into a focused "Don\'t suggest", on clicks, removing the recipe at once without a dialog', async () => {
      expectAllRecipesRendered();
      articles().forEach((article, i) => {
        const name = RECIPES[i].name;
        const suggest = article.querySelector('p.servings')?.nextElementSibling;
        expect(suggest?.matches('p.suggest'), `p.suggest after the servings of "${name}"`).toBe(
          true,
        );
        expect(suggest!.nextElementSibling?.tagName, `after p.suggest of "${name}"`).toBe('UL');
        expect(suggestButtons(article).map((b) => [textOf(b), nameOf(b)])).toEqual([
          ["Don't suggest", `Don't suggest ${name}`],
        ]);
      });

      const card = cardOf('Shakshuka with bread');
      const dontSuggest = suggestButtons(card)[0];
      dontSuggest.focus();
      await click(dontSuggest);
      expect(
        document.querySelector('dialog[open]'),
        'dialog open after "Don\'t suggest"',
      ).toBeNull();
      expect(store().removed()).toEqual(['Shakshuka with bread']);
      const suggest = card.querySelector('p.suggest')!;
      expect(Array.from(suggest.children).map((child) => [child.tagName, textOf(child)])).toEqual([
        ['SPAN', 'Not suggested'],
        ['BUTTON', 'Suggest again'],
      ]);
      const suggestAgain = suggestButtons(card)[0];
      expect(nameOf(suggestAgain)).toBe('Suggest again: Shakshuka with bread');
      expect(document.activeElement, 'focus after "Don\'t suggest"').toBe(suggestAgain);

      await click(suggestAgain);
      const back = suggestButtons(card);
      expect(back.map(textOf)).toEqual(["Don't suggest"]);
      expect(document.activeElement, 'focus after "Suggest again"').toBe(back[0]);
      expect(store().removed()).not.toContain('Shakshuka with bread');
    });

    it('leaves the focus where it was when "Don\'t suggest" is clicked without having it', async () => {
      const card = cardOf('Shakshuka with bread');
      const [dontSuggest] = suggestButtons(card);
      expect(dontSuggest, 'no "Don\'t suggest" button').toBeDefined();
      expect(document.activeElement, 'focus before the click').toBe(document.body);
      await click(dontSuggest);
      expect(suggestButtons(card).map(textOf), 'buttons after the click').toEqual([
        'Suggest again',
      ]);
      expect(document.activeElement).toBe(document.body);
    });

    it('lists a removed recipe in its place and counts it in the search', async () => {
      store().removeRecipe('Shakshuka with bread');
      expect(store().removed(), 'Shakshuka with bread not removed').toEqual([
        'Shakshuka with bread',
      ]);
      await reopenPage();

      expect(listedNames()).toEqual(RECIPES.map((recipe) => recipe.name));
      await search('shakshuka');
      expect(statusText()).toBe('1 recipe matches "shakshuka".');
      expect(listedNames()).toEqual(['Shakshuka with bread']);
    });

    it('says once, in a p.note right after the status line, that at least 15 recipes stay suggested, also when nothing matches, with no "Don\'t suggest" and "Suggest again" on every removed recipe\'s card, while exactly 15 are suggested', async () => {
      const suggested = leaveSuggested(store(), 15);
      await reopenPage();

      expectLimitNote('on open');
      for (const article of articles()) {
        const name = textOf(article.querySelector('h2')!);
        if (suggested.includes(name)) {
          expect(article.querySelector('p.suggest'), `p.suggest of "${name}"`).toBeNull();
          expect(suggestButtons(article), `buttons of "${name}"`).toEqual([]);
        } else {
          expect(suggestButtons(article).map(textOf), `buttons of "${name}"`).toEqual([
            'Suggest again',
          ]);
        }
      }
      await search('xyzzy');
      expect(articles(), 'cards for "xyzzy"').toEqual([]);
      expectLimitNote('when nothing matches');
    });

    it('drops the note and shows "Don\'t suggest" on every suggested card again when the user clicks "Suggest again" while exactly 15 recipes are suggested', async () => {
      const suggested = leaveSuggested(store(), 15);
      await reopenPage();
      const brought = store().removed()[0];

      await click(suggestButtons(cardOf(brought))[0]);
      expect(element.querySelector('p.note')).toBeNull();
      expect(textOf(element)).not.toContain(LIMIT_NOTE);
      for (const name of [...suggested, brought]) {
        expect(suggestButtons(cardOf(name)).map(textOf), `buttons of "${name}"`).toEqual([
          "Don't suggest",
        ]);
      }
    });

    it('shows the note and no "Don\'t suggest" on "Quick Dal" while it is one of exactly 15 recipes suggested, and drops the note and shows "Don\'t suggest" on it once another own recipe is added', async () => {
      recipeStore().add(QUICK_DAL);
      leaveSuggested(store(), 15, 'Quick Dal');
      await reopenPage();

      expectLimitNote('at 15 suggested');
      expect(cardOf('Quick Dal').querySelector('p.suggest'), 'p.suggest of "Quick Dal"').toBeNull();

      recipeStore().add(PLAIN_RICE);
      await reopenPage();
      expect(element.querySelector('p.note')).toBeNull();
      expect(suggestButtons(cardOf('Quick Dal')).map(textOf)).toEqual(["Don't suggest"]);
    });

    it('shows "Not suggested" on the own recipe "Quick Dal" after "Don\'t suggest" on its card, and again after a reload, with "Quick Dal" kept in fooplan.removed', async () => {
      storeOwnRecipes(QUICK_DAL);
      await reload();

      await click(suggestButtons(cardOf('Quick Dal'))[0]);
      expect(suggestTexts('Quick Dal')).toEqual(['Not suggested', 'Suggest again']);

      await reload();
      expect(suggestTexts('Quick Dal'), 'after a reload').toEqual([
        'Not suggested',
        'Suggest again',
      ]);
      expect(JSON.parse(localStorage.getItem('fooplan.removed') ?? 'null')).toEqual(['Quick Dal']);
    });

    function suggestTexts(name: string): string[] {
      return Array.from(cardOf(name).querySelector('p.suggest')?.children ?? []).map(textOf);
    }

    function expectLimitNote(when: string) {
      const notes = Array.from(element.querySelectorAll('p.note'));
      expect(notes.map(textOf), `notes ${when}`).toEqual([LIMIT_NOTE]);
      expect(statusElement().nextElementSibling, `element after the status ${when}`).toBe(notes[0]);
      expect(
        (element.textContent ?? '').split(LIMIT_NOTE).length - 1,
        `occurrences of the note ${when}`,
      ).toBe(1);
    }

    function suggestButtons(article: HTMLElement): HTMLButtonElement[] {
      return Array.from(article.querySelectorAll('p.suggest button'));
    }

    function cardOf(name: string): HTMLElement {
      const article = articles().find(
        (candidate) => textOf(candidate.querySelector('h2')!) === name,
      );
      expect(article, `"${name}" not shown`).toBeDefined();
      return article!;
    }

    function nameOf(node: Element): string {
      return node.getAttribute('aria-label')?.trim() || textOf(node);
    }

    function store(): PlanStore {
      return TestBed.inject(PlanStore);
    }
  });

  function configure() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
      ],
    });
  }

  async function openPage() {
    fixture = TestBed.createComponent(RecipeList);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  // The page opened again on the same store, as when the user comes back to it
  async function reopenPage() {
    fixture.destroy();
    await openPage();
  }

  // A fresh app on the same localStorage, as a page reload makes
  async function reload() {
    fixture.destroy();
    TestBed.resetTestingModule();
    configure();
    await openPage();
  }

  function recipeStore(): RecipeStore {
    return TestBed.inject(RecipeStore);
  }

  async function click(target: HTMLElement) {
    target.click();
    await fixture.whenStable();
  }

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
