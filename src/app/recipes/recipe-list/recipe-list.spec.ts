import { Component, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PlanStore, RANDOM, TODAY } from '../../plan/plan-store';
import {
  day,
  leaveSuggested,
  loadStoresOnce,
  open,
  picked,
  planOf,
  seededRandom,
} from '../../plan/testing';
import { displayAmount } from '../amount';
import { Recipe } from '../recipe';
import { RECIPE_IMAGES } from '../recipe-images';
import { RecipeStore } from '../recipe-store';
import { RECIPES } from '../recipes';
import { LANGUAGE_KEY, TABBABLE } from '../../testing';
import {
  LISTED_IMAGES,
  ownRecipe,
  picture,
  pictureShape,
  PLACEHOLDER,
  PLAIN_RICE,
  QUICK_DAL,
  storeOwnRecipes,
} from '../testing';
import { RecipeList } from './recipe-list';

const LIMIT_NOTE = 'At least 15 recipes stay suggested, so no more can be removed.';

const EASY_RECIPES = [
  'Hummus plate with bread and vegetables',
  'Avocado toast with fried egg',
  'Caprese salad with bread',
  'Spinach and feta omelette',
  'Tuna and white bean salad with bread',
];

const FAMILY_RECIPES = [
  'Chicken schnitzel with cucumber salad',
  'Fish fingers with mashed potatoes and peas',
  'Spaghetti with zucchini and parmesan',
  'Chicken and rice with carrots and peas',
  'Pizza toast',
  'Potato pancakes with sour cream',
  'Spaghetti with meatballs',
  'Creamy salmon pasta with spinach',
  'Chicken and vegetable skewers with rice',
  'Pasta with broccoli and parmesan',
];

const ADDED_RECIPES = [
  'Chicken fried rice',
  'Beef and broccoli stir-fry with rice',
  'Pork and bell pepper stir-fry with rice',
  'Salmon teriyaki with rice and broccoli',
  'Garlic prawns with rice',
  'Chicken satay with rice',
  'Spinach rice with feta',
  'Coconut prawn curry with rice',
  'Potato and cauliflower curry with rice',
  'Tagliatelle alfredo with chicken',
  'Chicken chow mein',
  'Chicken paprikash with egg noodles',
  'Chicken parmigiana with spaghetti',
  'Penne with Italian sausage and tomato sauce',
  'Tortellini with ham and peas',
  'Spaghetti puttanesca',
  'Tagliatelle with smoked salmon and dill',
  'Pasta alla norma',
  'Pasta salad with mozzarella and cherry tomatoes',
  'Spätzle with creamy mushroom sauce',
  'Pork chops with mashed potatoes and apple sauce',
  'Fish cakes with peas',
  'Frankfurters with potato salad',
  'Fried potatoes with bacon and fried eggs',
  'Pan-fried cod with potatoes and spinach',
  'Chicken thighs with roast potatoes and rosemary',
  'Currywurst with fries',
  'Trout with potatoes and parsley butter',
  'Tuna melts',
  'Smoked salmon bagels',
  'Steak sandwiches with caramelised onions',
  'Croque monsieur',
  'Chicken gyros with pita and tzatziki',
  'BLT sandwiches',
  'Lamb koftas with pita and tzatziki',
  'Beef tacos',
  'White bean stew with chorizo and bread',
  'Baked cod with tomatoes, olives and bread',
  'Savoury pancakes with ham and cheese',
  'Salmon with couscous and roasted vegetables',
];

describe('RecipeList', () => {
  let fixture: ComponentFixture<RecipeList>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    configure();
    await openPage();
  });

  it('keeps "2 servings" on the card of "Spaghetti pomodoro" while it is picked in a saved plan for 3 (#55 2a)', async () => {
    const plan = planOf(
      [
        day(
          '2026-10-24',
          picked('Spaghetti pomodoro'),
          open('Spaghetti carbonara', 'Niçoise salad', 'Fish tacos'),
        ),
      ],
      { people: 3 },
    );
    localStorage.setItem('fooplan.plan', JSON.stringify(plan));
    await reload();
    expect(TestBed.inject(PlanStore).plan(), 'saved plan not loaded').toEqual(plan);
    expect(textOf(cardOf('Spaghetti pomodoro').querySelector('p.servings')!)).toBe('2 servings');
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
      'Spaghetti with zucchini and parmesan',
      'Spaghetti with meatballs',
      'Chicken parmigiana with spaghetti',
      'Spaghetti puttanesca',
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
    expect(articles(), 'search not applied').toHaveLength(7);
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

  it('lists the own recipes "Grandma\'s Soup" and "Quick Dal" after all built-in recipes in the order added, each with "Your recipe" in a p.own before its p.suggest, right after p.nutrition for "Grandma\'s Soup" and right after p.servings for "Quick Dal", and lists "Quick Dal" for the search "dal" (changed by #60)', async () => {
    recipeStore().add(ownRecipe("Grandma's Soup"));
    recipeStore().add(QUICK_DAL);
    await reopenPage();

    expect(listedNames()).toEqual([
      ...RECIPES.map((recipe) => recipe.name),
      "Grandma's Soup",
      'Quick Dal',
    ]);
    const sequences: Record<string, string[]> = {
      "Grandma's Soup": ['p.servings', 'p.nutrition', 'p.own', 'p.suggest'],
      'Quick Dal': ['p.servings', 'p.own', 'p.suggest'],
    };
    for (const article of articles()) {
      const name = textOf(article.querySelector('h2')!);
      const sequence = sequences[name];
      if (sequence) {
        let element = article.querySelector('p.servings');
        for (const [index, selector] of sequence.entries()) {
          expect(element?.matches(selector), `${selector} at ${index} on "${name}"`).toBe(true);
          if (selector === 'p.own') {
            expect(textOf(element!), `p.own of "${name}"`).toBe('Your recipe');
          }
          element = element!.nextElementSibling;
        }
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
      const card = cardOf(name);
      return textOf(card.querySelector('p.servings') ?? card);
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
      expect(statusText(), 'count not shown').toBe('7 recipes match "spag".');
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

    it('says "7 recipes match "spaghetti"." and lists 7 recipes when the user types "spaghetti"', async () => {
      await search('spaghetti');
      expect(statusText()).toBe('7 recipes match "spaghetti".');
      expect(articles()).toHaveLength(7);
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
      await search('tacos');
      expect(statusText()).toBe('2 recipes match "tacos".');
      expect(listedNames()).toEqual(['Fish tacos', 'Beef tacos']);
    });

    it('says "1 recipe matches "carbonara"." and lists 1 recipe when the user types "carbonara"', async () => {
      await search('carbonara');
      expect(statusText()).toBe('1 recipe matches "carbonara".');
      expect(listedNames()).toEqual(['Spaghetti carbonara']);
    });

    it('says "84 recipes match "s"." and lists all recipes when the user types "s"', async () => {
      await search('s');
      expect(statusText()).toBe(`${RECIPES.length} recipes match "s".`);
      expect(RECIPES.length, 'recipes loaded').toBe(84);
      expectAllRecipesRendered();
    });

    it('lists the 84 quick recipes on open, and says "84 recipes match "s".", "7 recipes match "spaghetti"." and "No recipe matches "kase"."', async () => {
      expect(articles()).toHaveLength(84);
      await search('s');
      expect(statusText()).toBe('84 recipes match "s".');
      expect(articles(), 'cards for "s"').toHaveLength(84);
      await search('spaghetti');
      expect(statusText()).toBe('7 recipes match "spaghetti".');
      await search('kase');
      expect(statusText()).toBe('No recipe matches "kase".');
      expect(articles(), 'cards for "kase"').toEqual([]);
    });

    it('lists 84 built-in recipes on open, and says "84 recipes match "s"." for "s" and "No recipe matches "soup"." for "soup"', async () => {
      expect(articles()).toHaveLength(84);
      await search('s');
      expect(statusText()).toBe('84 recipes match "s".');
      expect(articles(), 'cards for "s"').toHaveLength(84);
      await search('soup');
      expect(statusText()).toBe('No recipe matches "soup".');
      expect(articles(), 'cards for "soup"').toEqual([]);
    });

    it('lists no card whose name contains "soup", and says that no recipe matches "Soup" or the ingredients only the soups used, "lentil", "pumpkin" and "leek"', async () => {
      expect(listedNames().filter((name) => /soup/i.test(name))).toEqual([]);
      for (const text of ['Soup', 'lentil', 'pumpkin', 'leek']) {
        await search(text);
        expect(statusText()).toBe(`No recipe matches "${text}".`);
        expect(articles(), `cards for "${text}"`).toEqual([]);
      }
    });

    it('says "1 recipe matches "soup"." and lists only the own recipe "Grandma\'s Soup", listed after the 84 built-in recipes, when the user types "soup"', async () => {
      recipeStore().add(ownRecipe("Grandma's Soup"));
      await reopenPage();
      expect(articles(), 'cards on open').toHaveLength(85);
      expect(listedNames().at(-1)).toBe("Grandma's Soup");

      await search('soup');
      expect(statusText()).toBe('1 recipe matches "soup".');
      expect(listedNames()).toEqual(["Grandma's Soup"]);
    });

    it('lists 84 cards on open, the 30th to 34th "Hummus plate with bread and vegetables", "Avocado toast with fried egg", "Caprese salad with bread", "Spinach and feta omelette" and "Tuna and white bean salad with bread", and says "84 recipes match "s"." for "s"', async () => {
      expect(articles()).toHaveLength(84);
      expect(listedNames().slice(29, 34)).toEqual(EASY_RECIPES);
      await search('s');
      expect(statusText()).toBe('84 recipes match "s".');
    });

    it('lists 84 cards on open, the 35th to 44th the 10 family recipes of #32 in their order and the 45th to 84th the 40 recipes of #58 in theirs, says "84 recipes match "s"." for "s", and "3 recipes match "broccoli"." with "Pasta with broccoli and parmesan", "Beef and broccoli stir-fry with rice" and "Salmon teriyaki with rice and broccoli", the first with "2 servings", for "broccoli"', async () => {
      expect(articles()).toHaveLength(84);
      expect(listedNames().slice(34, 44)).toEqual(FAMILY_RECIPES);
      expect(listedNames().slice(44, 84)).toEqual(ADDED_RECIPES);
      await search('s');
      expect(statusText()).toBe('84 recipes match "s".');
      await search('broccoli');
      expect(statusText()).toBe('3 recipes match "broccoli".');
      expect(listedNames()).toEqual([
        'Pasta with broccoli and parmesan',
        'Beef and broccoli stir-fry with rice',
        'Salmon teriyaki with rice and broccoli',
      ]);
      expect(textOf(articles()[0])).toContain('2 servings');
    });

    it('says "1 recipe matches "hummus"." and lists only "Hummus plate with bread and vegetables" with "2 servings" when the user types "hummus"', async () => {
      await search('hummus');
      expect(statusText()).toBe('1 recipe matches "hummus".');
      expect(listedNames()).toEqual(['Hummus plate with bread and vegetables']);
      expect(textOf(articles()[0])).toContain('2 servings');
    });

    it('says "22 recipes match "bread"." and lists the 4 recipes with bread or breadcrumbs, the 4 easy ones with bread, the 4 family ones with bread or breadcrumbs and the 10 of #58 with bread, breadcrumbs or pita bread in RECIPES order when the user types "bread"', async () => {
      await search('bread');
      expect(statusText()).toBe('22 recipes match "bread".');
      expect(listedNames()).toEqual([
        'Chicken Caesar salad',
        'Shakshuka with bread',
        'Greek salad with feta and bread',
        'Mac and cheese',
        'Hummus plate with bread and vegetables',
        'Avocado toast with fried egg',
        'Caprese salad with bread',
        'Tuna and white bean salad with bread',
        'Chicken schnitzel with cucumber salad',
        'Fish fingers with mashed potatoes and peas',
        'Pizza toast',
        'Spaghetti with meatballs',
        'Chicken parmigiana with spaghetti',
        'Fish cakes with peas',
        'Tuna melts',
        'Steak sandwiches with caramelised onions',
        'Croque monsieur',
        'Chicken gyros with pita and tzatziki',
        'BLT sandwiches',
        'Lamb koftas with pita and tzatziki',
        'White bean stew with chorizo and bread',
        'Baked cod with tomatoes, olives and bread',
      ]);
    });

    it('says "1 recipe matches "omelette"." and lists only "Spinach and feta omelette" when the user types "omelette"', async () => {
      await search('omelette');
      expect(statusText()).toBe('1 recipe matches "omelette".');
      expect(listedNames()).toEqual(['Spinach and feta omelette']);
    });

    it('lists the own recipe "Grandma\'s Soup" right after "Salmon with couscous and roasted vegetables", the last built-in recipe', async () => {
      recipeStore().add(ownRecipe("Grandma's Soup"));
      await reopenPage();
      expect(listedNames().slice(-2)).toEqual([
        'Salmon with couscous and roasted vegetables',
        "Grandma's Soup",
      ]);
    });

    it('says "15 recipes match "cream"." and lists the 7 recipes with sour cream and the one with cream, then the 7 of #58 with cream, sour cream or cream cheese, when the user types "cream"', async () => {
      await search('cream');
      expect(statusText()).toBe('15 recipes match "cream".');
      expect(listedNames()).toEqual([
        'Chicken fajitas',
        'Fish tacos',
        'Beef stroganoff with rice',
        'Chicken quesadillas',
        'Bean burritos',
        'Chicken schnitzel with cucumber salad',
        'Potato pancakes with sour cream',
        'Creamy salmon pasta with spinach',
        'Tagliatelle alfredo with chicken',
        'Chicken paprikash with egg noodles',
        'Tortellini with ham and peas',
        'Tagliatelle with smoked salmon and dill',
        'Spätzle with creamy mushroom sauce',
        'Smoked salmon bagels',
        'Beef tacos',
      ]);
    });

    it('says "1 recipe matches "goulash"." and lists only "Potato goulash" when the user types "goulash"', async () => {
      await search('goulash');
      expect(statusText()).toBe('1 recipe matches "goulash".');
      expect(listedNames()).toEqual(['Potato goulash']);
    });

    it('quotes the search without its surrounding spaces and with its case in the count', async () => {
      await search('  Spaghetti  ');
      expect(statusText()).toBe('7 recipes match "Spaghetti".');
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

    it('updates the count from "8 recipes match "spa"." to "20 recipes match "sp"." and lists 20 recipes when the user deletes the "a" of "spa"', async () => {
      await search('spa');
      expect(statusText(), 'count before deleting').toBe('8 recipes match "spa".');
      await search('sp');
      expect(statusText()).toBe('20 recipes match "sp".');
      expect(articles()).toHaveLength(20);
    });

    it('replaces the no-match text with the count when a deletion makes recipes match again', async () => {
      await search('spaghettix');
      expect(statusText(), 'no-match text before deleting').toBe('No recipe matches "spaghettix".');
      await search('spaghetti');
      expect(statusText()).toBe('7 recipes match "spaghetti".');
      expect(articles()).toHaveLength(7);
    });

    it('empties the status element and lists all recipes when the user empties the field or types only spaces', async () => {
      await search('spaghetti');
      expect(statusText(), 'count not shown').toBe('7 recipes match "spaghetti".');
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
      expect(statusText()).toBe('7 recipes match "spaghetti".');
      await search('xyzzy');
      expect(statusElement(), 'element after "xyzzy"').toBe(status);
      expect(statusText()).toBe('No recipe matches "xyzzy".');
      await search('');
      expect(statusElement(), 'element after emptying the field').toBe(status);
      expect(statusText()).toBe('');
    });

    it('says "8 recipes match "spa"." with the 7 spaghetti recipes and then "Spätzle with creamy mushroom sauce", "6 recipes match "salmon"." with the 6 salmon recipes in their order, and "1 recipe matches "tuna melts"." with only "Tuna melts" and "2 servings" (#58 7)', async () => {
      await search('spa');
      expect(statusText()).toBe('8 recipes match "spa".');
      expect(listedNames().at(-1)).toBe('Spätzle with creamy mushroom sauce');
      expect(listedNames().slice(0, -1)).toEqual(
        RECIPES.map((recipe) => recipe.name).filter((name) => /spaghetti/i.test(name)),
      );

      await search('salmon');
      expect(statusText()).toBe('6 recipes match "salmon".');
      expect(listedNames()).toEqual([
        'Oven-baked salmon with potatoes and green beans',
        'Creamy salmon pasta with spinach',
        'Salmon teriyaki with rice and broccoli',
        'Tagliatelle with smoked salmon and dill',
        'Smoked salmon bagels',
        'Salmon with couscous and roasted vegetables',
      ]);

      await search('tuna melts');
      expect(statusText()).toBe('1 recipe matches "tuna melts".');
      expect(listedNames()).toEqual(['Tuna melts']);
      expect(textOf(articles()[0].querySelector('p.servings')!)).toBe('2 servings');
    });

    it('lists the own recipes "Grandma\'s Soup" and "Quick Dal" as the 85th and 86th cards, right after the 84 built-in recipes in RECIPES order, "Salmon with couscous and roasted vegetables" the 84th (#58 7a)', async () => {
      recipeStore().add(ownRecipe("Grandma's Soup"));
      recipeStore().add(QUICK_DAL);
      await reopenPage();
      expect(articles()).toHaveLength(86);
      expect(listedNames().slice(0, 84)).toEqual(RECIPES.map((recipe) => recipe.name));
      expect(listedNames()[83]).toBe('Salmon with couscous and roasted vegetables');
      expect(listedNames().slice(84)).toEqual(["Grandma's Soup", 'Quick Dal']);
    });
  });

  describe('"Don\'t suggest" and "Suggest again"', () => {
    it('shows a "Don\'t suggest <recipe>" button in a p.suggest after p.nutrition, as the last element of every card, which turns into "Not suggested" and a focused "Suggest again: Shakshuka with bread", and back into a focused "Don\'t suggest", on clicks, removing the recipe at once without a dialog (changed by #60, #62)', async () => {
      expectAllRecipesRendered();
      articles().forEach((article, i) => {
        const name = RECIPES[i].name;
        const nutrition = article.querySelector('p.servings')?.nextElementSibling;
        expect(
          nutrition?.matches('p.nutrition'),
          `p.nutrition after the servings of "${name}"`,
        ).toBe(true);
        const suggest = nutrition!.nextElementSibling;
        expect(suggest?.matches('p.suggest'), `p.suggest after p.nutrition of "${name}"`).toBe(
          true,
        );
        expect(suggest!.nextElementSibling, `after p.suggest of "${name}"`).toBeNull();
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

    function nameOf(node: Element): string {
      return node.getAttribute('aria-label')?.trim() || textOf(node);
    }

    function store(): PlanStore {
      return TestBed.inject(PlanStore);
    }
  });

  describe('nutrition (#60)', () => {
    const POMODORO_LINE = 'Per serving: 615 kcal · 21 g protein · 85 g carbs · 20 g fat';
    const SUGAR_SPOON: Recipe = {
      name: 'Sugar Spoon',
      servings: 1,
      ingredients: [{ name: 'sugar', amount: 1, unit: 'tbsp' }],
      own: true,
    };

    it('shows "Per serving: 615 kcal · 21 g protein · 85 g carbs · 20 g fat" in a p.nutrition right after "2 servings" on the card of "Spaghetti pomodoro" and a p.nutrition starting with "Per serving: " on each of the 84 cards; "4 servings", "Your recipe" and no p.nutrition on the card of the own "Quick Dal"; "Per serving: 270 kcal · 5 g protein · 59 g carbs · 1 g fat" on the own "Plain Rice"; and "No recipe matches "protein"." for the search "protein" (#60 4)', async () => {
      const servings = cardOf('Spaghetti pomodoro').querySelector('p.servings');
      expect(textOf(servings!)).toBe('2 servings');
      const line = servings!.nextElementSibling;
      expect(line?.matches('p.nutrition'), 'p.nutrition after the servings').toBe(true);
      expect(textOf(line!)).toBe(POMODORO_LINE);
      expectAllRecipesRendered();
      for (const article of articles()) {
        const lines = Array.from(article.querySelectorAll('p.nutrition')).map(textOf);
        const name = textOf(article.querySelector('h2')!);
        expect(lines, `p.nutrition of "${name}"`).toHaveLength(1);
        expect(lines[0], `p.nutrition of "${name}"`).toMatch(/^Per serving: /);
      }

      storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
      await reload();
      const dal = cardOf('Quick Dal');
      expect(textOf(dal.querySelector('p.servings')!)).toBe('4 servings');
      expect(textOf(dal.querySelector('p.own')!)).toBe('Your recipe');
      expect(dal.querySelector('p.nutrition'), 'p.nutrition of "Quick Dal"').toBeNull();
      expect(nutritionLineOf('Plain Rice')).toBe(
        'Per serving: 270 kcal · 5 g protein · 59 g carbs · 1 g fat',
      );

      await search('protein');
      expect(statusText()).toBe('No recipe matches "protein".');
      expect(articles()).toEqual([]);
    });

    it('shows "Per serving: 48 kcal · 0 g protein · 12 g carbs · 0 g fat" on the card of an own recipe of only 1 tbsp sugar for 1 (#60 7)', async () => {
      storeOwnRecipes(SUGAR_SPOON);
      await reload();
      expect(nutritionLineOf('Sugar Spoon')).toBe(
        'Per serving: 48 kcal · 0 g protein · 12 g carbs · 0 g fat',
      );
    });

    it('shows "Pro Portion: 615 kcal · 21 g Eiweiß · 85 g Kohlenhydrate · 20 g Fett" on the card of "Spaghetti Pomodoro" in German (#60 6)', async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await reload();
      expect(nutritionLineOf('Spaghetti Pomodoro')).toBe(
        'Pro Portion: 615 kcal · 21 g Eiweiß · 85 g Kohlenhydrate · 20 g Fett',
      );
    });

    describe('edge cases', () => {
      it('shows no "No nutrition data" anywhere on the card of the own "Quick Dal", while the own "Plain Rice" next to it has its line (#60 4a)', async () => {
        storeOwnRecipes(QUICK_DAL, PLAIN_RICE);
        await reload();
        expect(nutritionLineOf('Plain Rice')).toMatch(/^Per serving: /);
        expect(textOf(cardOf('Quick Dal'))).not.toContain('No nutrition data');
        expect(textOf(cardOf('Quick Dal'))).not.toContain('Per serving');
      });

      it('puts p.nutrition between p.servings and p.own on the card of the own "Plain Rice", with p.suggest right after p.own (#60 4b)', async () => {
        storeOwnRecipes(PLAIN_RICE);
        await reload();
        const line = cardOf('Plain Rice').querySelector('p.servings')?.nextElementSibling;
        expect(line?.matches('p.nutrition'), 'p.nutrition after the servings').toBe(true);
        const own = line!.nextElementSibling;
        expect(own?.matches('p.own'), 'p.own after p.nutrition').toBe(true);
        expect(own!.nextElementSibling?.matches('p.suggest'), 'p.suggest after p.own').toBe(true);
      });

      it('says that no recipe matches "kcal", "carbs" or "per serving", which only the nutrition lines contain (#60 4c)', async () => {
        expect(nutritionLineOf('Spaghetti pomodoro')).toBe(POMODORO_LINE);
        for (const text of ['kcal', 'carbs', 'per serving']) {
          await search(text);
          expect(statusText()).toBe(`No recipe matches "${text}".`);
        }
      });

      it('styles p.nutrition like p.servings, var(--muted) at 14px, with the margin 0 0 0.75rem (12px), and gives p.servings a bottom margin of 0.25rem (4px) (#60 4d)', () => {
        const card = cardOf('Spaghetti pomodoro');
        const servings = getComputedStyle(card.querySelector('p.servings')!);
        const line = card.querySelector('p.nutrition');
        expect(line, 'p.nutrition').not.toBeNull();
        const style = getComputedStyle(line!);
        expect([style.color, style.fontSize]).toEqual([servings.color, servings.fontSize]);
        expect([style.color, style.fontSize]).toEqual(['var(--muted)', '14px']);
        expect([style.marginTop, style.marginBottom], 'p.nutrition').toEqual(['0px', '12px']);
        expect(servings.marginBottom, 'p.servings').toBe('4px');
      });

      it('shows no p.nutrition and no "Keine Nährwerte" on the card of the own "Quick Dal" in German, while "Spaghetti Pomodoro" has its line (#60 6a)', async () => {
        storeOwnRecipes(QUICK_DAL);
        localStorage.setItem(LANGUAGE_KEY, 'de');
        await reload();
        expect(nutritionLineOf('Spaghetti Pomodoro')).toMatch(/^Pro Portion: /);
        const dal = cardOf('Quick Dal');
        expect(textOf(dal.querySelector('p.servings')!), 'German not shown').toBe('4 Portionen');
        expect(dal.querySelector('p.nutrition')).toBeNull();
        expect(textOf(dal)).not.toContain('Keine Nährwerte');
      });
    });

    function nutritionLineOf(name: string): string {
      const lines = cardOf(name).querySelectorAll('p.nutrition');
      expect(lines, `p.nutrition of "${name}"`).toHaveLength(1);
      return textOf(lines[0]);
    }
  });

  describe('in German (#35)', () => {
    beforeEach(async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await reload();
    });

    it('heads the page "Rezepte" with the link "Rezept hinzufügen" and the field "Rezepte suchen"; says 84 Rezepte passen zu „s“. for "s", 1 Rezept passt zu „carbonara“., 3 Rezepte passen zu „kase“. and Kein Rezept passt zu „kaese“.; shows "2 Portionen" on the card of "Spaghetti Pomodoro", whose "Nicht vorschlagen" is named "Spaghetti Pomodoro nicht vorschlagen" and turns into "Nicht vorgeschlagen" and "Wieder vorschlagen" on a click (changed by #58)', async () => {
      expect(textOf(element.querySelector('h1')!)).toBe('Rezepte');
      const add = element.querySelector<HTMLAnchorElement>('a.add');
      expect(textOf(add!)).toBe('Rezept hinzufügen');
      expect(add!.getAttribute('href')).toBe('/add-recipe');
      searchField('Rezepte suchen');

      await search('s', 'Rezepte suchen');
      expect(statusText()).toBe('84 Rezepte passen zu „s“.');
      await search('carbonara', 'Rezepte suchen');
      expect(statusText()).toBe('1 Rezept passt zu „carbonara“.');
      await search('kase', 'Rezepte suchen');
      expect(statusText()).toBe('3 Rezepte passen zu „kase“.');
      await search('kaese', 'Rezepte suchen');
      expect(statusText()).toBe('Kein Rezept passt zu „kaese“.');
      await search('', 'Rezepte suchen');

      const card = cardOf('Spaghetti Pomodoro');
      expect(textOf(card.querySelector('p.servings')!)).toBe('2 Portionen');
      const dontSuggest = card.querySelector<HTMLButtonElement>('p.suggest button')!;
      expect(textOf(dontSuggest)).toBe('Nicht vorschlagen');
      expect(dontSuggest.getAttribute('aria-label')).toBe('Spaghetti Pomodoro nicht vorschlagen');
      await click(dontSuggest);
      const suggest = cardOf('Spaghetti Pomodoro').querySelector('p.suggest')!;
      expect(textOf(suggest.querySelector('span')!)).toBe('Nicht vorgeschlagen');
      const again = suggest.querySelector('button')!;
      expect(textOf(again)).toBe('Wieder vorschlagen');
      expect(again.getAttribute('aria-label')).toBe('Wieder vorschlagen: Spaghetti Pomodoro');
    });

    describe('edge cases', () => {
      it('shows "1 Portion" on the card of an own recipe for 1, "4 Portionen" on one for 4, and "Dein Rezept" on both', async () => {
        storeOwnRecipes(ownRecipe('Solo Soup', 1), ownRecipe('Family Soup', 4));
        await reload();
        expect(textOf(cardOf('Solo Soup').querySelector('p.servings')!)).toBe('1 Portion');
        expect(textOf(cardOf('Family Soup').querySelector('p.servings')!)).toBe('4 Portionen');
        for (const name of ['Solo Soup', 'Family Soup']) {
          expect(textOf(cardOf(name).querySelector('p.own')!), name).toBe('Dein Rezept');
        }
      });

      it('says "Mindestens 15 Rezepte bleiben vorgeschlagen, mehr können nicht entfernt werden." while exactly 15 recipes are suggested', async () => {
        leaveSuggested(TestBed.inject(PlanStore), 15);
        await fixture.whenStable();
        expect(textOf(element.querySelector('p.note')!)).toBe(
          'Mindestens 15 Rezepte bleiben vorgeschlagen, mehr können nicht entfernt werden.',
        );
      });
    });
  });

  describe('German recipes (#36)', () => {
    // Saved as the form saves "Linsen": it stores ingredient names in lowercase
    const OMAS_EINTOPF: Recipe = {
      name: 'Omas Eintopf',
      servings: 4,
      ingredients: [{ name: 'linsen', amount: 200, unit: 'g' }],
      own: true,
    };

    it('shows "Spaghetti Pomodoro" linking to /recipes/spaghetti-pomodoro as the first card in German, says „knoblauch“ matches the recipes with garlic clove, "Spaghetti Pomodoro" among them, and that nothing matches „garlic“; and that nothing matches "knoblauch" in English', async () => {
      const garlic = RECIPES.filter((recipe) =>
        recipe.ingredients.some((ingredient) => ingredient.name === 'garlic clove'),
      );
      expect(garlic.length, 'recipes with garlic clove').toBeGreaterThan(1);
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await reload();

      const first = articles()[0].querySelector('h2 a');
      expect(textOf(first!)).toBe('Spaghetti Pomodoro');
      expect(first!.getAttribute('href')).toBe('/recipes/spaghetti-pomodoro');
      await search('knoblauch', 'Rezepte suchen');
      expect(statusText()).toBe(`${garlic.length} Rezepte passen zu „knoblauch“.`);
      expect(articles()).toHaveLength(garlic.length);
      expect(listedNames()).toContain('Spaghetti Pomodoro');
      await search('garlic', 'Rezepte suchen');
      expect(statusText()).toBe('Kein Rezept passt zu „garlic“.');

      localStorage.setItem(LANGUAGE_KEY, 'en');
      await reload();
      await search('knoblauch');
      expect(statusText()).toBe('No recipe matches "knoblauch".');
    });

    it('lists the own recipe "Omas Eintopf" next to the German "Spaghetti Pomodoro" in German, and finds it by "linsen", in German and in English', async () => {
      storeOwnRecipes(OMAS_EINTOPF);
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await reload();
      expect(listedNames()).toEqual(expect.arrayContaining(['Spaghetti Pomodoro', 'Omas Eintopf']));
      await search('linsen', 'Rezepte suchen');
      expect(listedNames()).toEqual(['Omas Eintopf']);
      expect(statusText()).toBe('1 Rezept passt zu „linsen“.');

      localStorage.setItem(LANGUAGE_KEY, 'en');
      await reload();
      await search('linsen');
      expect(listedNames()).toEqual(['Omas Eintopf']);
      expect(statusText()).toBe('1 recipe matches "linsen".');
    });
  });

  describe('cards without ingredients (#62)', () => {
    const POMODORO_LINE = 'Per serving: 615 kcal · 21 g protein · 85 g carbs · 20 g fat';
    const FOCUSABLE =
      'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]';
    // The criteria's "Quick Dal" holds "200 g lentils", which QUICK_DAL doesn't
    const DAL_WITH_LENTILS: Recipe = {
      ...QUICK_DAL,
      ingredients: [{ name: 'lentils', amount: 200, unit: 'g' }, ...QUICK_DAL.ingredients],
    };

    it('shows no ul or li on any of the 84 cards and "200 g spaghetti" nowhere on the page, and on the card of "Spaghetti pomodoro", in order, only its picture placeholder, the link "Spaghetti pomodoro" to /recipes/spaghetti-pomodoro, "2 servings", its p.nutrition and the button "Don\'t suggest" named "Don\'t suggest Spaghetti pomodoro", with nothing after the button (#62 1, changed by #63)', () => {
      expectAllRecipesRendered();
      for (const article of articles()) {
        expectNoList(article);
      }
      expect(textOf(element)).not.toContain('200 g spaghetti');

      const card = cardOf('Spaghetti pomodoro');
      expect(partsOf(card)).toEqual([
        ['div.picture.placeholder', ''],
        ['h2', 'Spaghetti pomodoro'],
        ['p.servings', '2 servings'],
        ['p.nutrition', POMODORO_LINE],
        ['p.suggest', "Don't suggest"],
      ]);
      expect(card.querySelector('h2 > a')?.getAttribute('href')).toBe(
        '/recipes/spaghetti-pomodoro',
      );
      const suggest = card.querySelector('p.suggest')!;
      expect(Array.from(suggest.children).map((child) => child.tagName)).toEqual(['BUTTON']);
      expect(suggest.children[0].getAttribute('aria-label')).toBe(
        "Don't suggest Spaghetti pomodoro",
      );
    });

    describe('edge cases', () => {
      it('shows none of its ingredient lines on any of the 84 cards (#62 1a)', () => {
        expectAllRecipesRendered();
        articles().forEach((article, i) => {
          const text = textOf(article);
          for (const ingredient of RECIPES[i].ingredients) {
            const shown = displayAmount(ingredient);
            const line = `${shown.amount} ${shown.unit} ${ingredient.name}`;
            expect(text, `card of "${RECIPES[i].name}"`).not.toContain(line);
          }
        });
      });

      it('puts no element on any of the 84 cards but its picture placeholder, the h2 with its link, p.servings, p.nutrition and p.suggest with its button, of which only the link and the button are focusable: no "Show ingredients" control (#62 1b, changed by #63)', () => {
        expectAllRecipesRendered();
        for (const article of articles()) {
          const name = textOf(article.querySelector('h2')!);
          expect(
            Array.from(article.querySelectorAll('*'))
              .filter((node) => !node.parentElement?.closest('.picture'))
              .map((node) => node.tagName),
            `elements of "${name}" but the placeholder's plate`,
          ).toEqual(['DIV', 'H2', 'A', 'P', 'P', 'P', 'BUTTON']);
          expect(Array.from(article.querySelectorAll(FOCUSABLE)), `focusable on "${name}"`).toEqual(
            [article.querySelector('h2 a'), article.querySelector('p.suggest button')],
          );
        }
      });

      it('holds no text on any of the 84 cards but its name, servings, nutrition line and "Don\'t suggest", so no ingredient count, cooking time or summary: "Spaghetti pomodoro 2 servings Per serving: … Don\'t suggest" (#62 1c)', () => {
        expectAllRecipesRendered();
        expect(squashed(cardOf('Spaghetti pomodoro'))).toBe(
          `Spaghetti pomodoro 2 servings ${POMODORO_LINE} Don't suggest`.replace(/\s+/g, ''),
        );
        articles().forEach((article, i) => {
          const parts = ['h2', 'p.servings', 'p.nutrition', 'p.suggest'].map((selector) =>
            squashed(article.querySelector(selector)!),
          );
          expect(squashed(article), `text of "${RECIPES[i].name}"`).toBe(parts.join(''));
          expect(
            textOf(article.querySelector('p.servings')!),
            `servings of "${RECIPES[i].name}"`,
          ).toBe(`${RECIPES[i].servings} servings`);
        });

        // Angular drops the whitespace between the card's elements, so their texts run together
        function squashed(node: Element): string {
          return (node.textContent ?? '').replace(/\s+/g, '');
        }
      });

      it('gives the last element of the card, p.suggest of "Spaghetti pomodoro" with "Don\'t suggest" and with "Not suggested", margin-bottom 0 (0px), while p.nutrition above it keeps its 12px (#62 1d)', async () => {
        const card = cardOf('Spaghetti pomodoro');
        expect(card.lastElementChild?.matches('p.suggest'), 'p.suggest last').toBe(true);
        expect(getComputedStyle(card.lastElementChild!).marginBottom).toBe('0px');
        expect(getComputedStyle(card.querySelector('p.nutrition')!).marginBottom).toBe('12px');

        await click(card.querySelector<HTMLButtonElement>('p.suggest button')!);
        expect(textOf(card.querySelector('p.suggest')!), 'not removed').toBe(
          'Not suggested Suggest again',
        );
        expect(card.lastElementChild?.matches('p.suggest'), 'p.suggest last when removed').toBe(
          true,
        );
        expect(getComputedStyle(card.lastElementChild!).marginBottom).toBe('0px');
      });
    });

    it('shows on the cards of the own "Grandma\'s Soup" and "Quick Dal", the latter with "200 g lentils", the name link, the servings, a p.nutrition only on "Grandma\'s Soup", "Your recipe" and "Don\'t suggest", in that order, after the picture placeholder, and no ul or li, and "200 g lentils" nowhere on the page (#62 2, changed by #63)', async () => {
      storeOwnRecipes(ownRecipe("Grandma's Soup"), DAL_WITH_LENTILS);
      await reload();

      expect(partsOf(cardOf("Grandma's Soup")).map(([selector]) => selector)).toEqual([
        'div.picture.placeholder',
        'h2',
        'p.servings',
        'p.nutrition',
        'p.own',
        'p.suggest',
      ]);
      expect(partsOf(cardOf('Quick Dal'))).toEqual([
        ['div.picture.placeholder', ''],
        ['h2', 'Quick Dal'],
        ['p.servings', '4 servings'],
        ['p.own', 'Your recipe'],
        ['p.suggest', "Don't suggest"],
      ]);
      for (const name of ["Grandma's Soup", 'Quick Dal']) {
        const card = cardOf(name);
        expect(textOf(card.querySelector('h2 > a')!), `link of "${name}"`).toBe(name);
        expect(textOf(card.querySelector('p.own')!), `p.own of "${name}"`).toBe('Your recipe');
        expectNoList(card);
      }
      expect(textOf(element)).not.toContain('200 g lentils');
    });

    describe('edge cases', () => {
      it('ends the card of the own "Quick Dal", which has no p.nutrition, with its p.suggest, whose button is its last element (#62 2a)', async () => {
        storeOwnRecipes(DAL_WITH_LENTILS);
        await reload();
        const card = cardOf('Quick Dal');
        expect(card.querySelector('p.nutrition'), 'p.nutrition of "Quick Dal"').toBeNull();
        expect(card.lastElementChild?.matches('p.suggest'), 'last element').toBe(true);
        expect(card.lastElementChild!.lastElementChild?.tagName).toBe('BUTTON');
      });

      it('ends a card without p.suggest, while exactly 15 recipes are suggested, with its last line at margin-bottom 0 (0px): p.own on the own "Quick Dal", p.nutrition on a suggested built-in recipe (#62 2b)', async () => {
        recipeStore().add(DAL_WITH_LENTILS);
        const suggested = leaveSuggested(TestBed.inject(PlanStore), 15, 'Quick Dal');
        await reopenPage();
        const builtIn = suggested.find((name) => name !== 'Quick Dal')!;

        for (const [name, selector] of [
          ['Quick Dal', 'p.own'],
          [builtIn, 'p.nutrition'],
        ]) {
          const card = cardOf(name);
          expect(card.querySelector('p.suggest'), `p.suggest of "${name}"`).toBeNull();
          expect(card.lastElementChild?.matches(selector), `${selector} last on "${name}"`).toBe(
            true,
          );
          expect(getComputedStyle(card.lastElementChild!).marginBottom, name).toBe('0px');
        }
      });
    });

    it('says "5 recipes match "chili flakes"." with "Penne arrabbiata", "Spaghetti aglio e olio", "Pad thai with chicken", "Avocado toast with fried egg" and "Spaghetti puttanesca" in this order and "chili flakes" on the page only in the status line, and "3 recipes match "broccoli"." with "Pasta with broccoli and parmesan", "Beef and broccoli stir-fry with rice" and "Salmon teriyaki with rice and broccoli", none with an li (#62 3)', async () => {
      await search('chili flakes');
      expect(statusText()).toBe('5 recipes match "chili flakes".');
      expect(listedNames()).toEqual([
        'Penne arrabbiata',
        'Spaghetti aglio e olio',
        'Pad thai with chicken',
        'Avocado toast with fried egg',
        'Spaghetti puttanesca',
      ]);
      expect(
        textOf(element).split('chili flakes').length - 1,
        'occurrences of "chili flakes"',
      ).toBe(1);

      await search('broccoli');
      expect(statusText()).toBe('3 recipes match "broccoli".');
      expect(listedNames()).toEqual([
        'Pasta with broccoli and parmesan',
        'Beef and broccoli stir-fry with rice',
        'Salmon teriyaki with rice and broccoli',
      ]);
      for (const article of articles()) {
        expectNoList(article);
      }
    });

    it('shows on the card of "Spaghetti Pomodoro" in German, in order, the picture placeholder, the name link, "2 Portionen", its p.nutrition and "Nicht vorschlagen" named "Spaghetti Pomodoro nicht vorschlagen", no ul or li on any card, and "Dosentomaten" nowhere on the page (#62 4, changed by #63)', async () => {
      localStorage.setItem(LANGUAGE_KEY, 'de');
      await reload();
      const card = cardOf('Spaghetti Pomodoro');
      expect(partsOf(card)).toEqual([
        ['div.picture.placeholder', ''],
        ['h2', 'Spaghetti Pomodoro'],
        ['p.servings', '2 Portionen'],
        ['p.nutrition', 'Pro Portion: 615 kcal · 21 g Eiweiß · 85 g Kohlenhydrate · 20 g Fett'],
        ['p.suggest', 'Nicht vorschlagen'],
      ]);
      expect(card.querySelector('h2 > a')?.getAttribute('href')).toBe(
        '/recipes/spaghetti-pomodoro',
      );
      expect(card.querySelector('p.suggest button')?.getAttribute('aria-label')).toBe(
        'Spaghetti Pomodoro nicht vorschlagen',
      );
      for (const article of articles()) {
        expectNoList(article);
      }
      expect(textOf(element)).not.toContain('Dosentomaten');
    });

    describe('edge cases', () => {
      it('shows no ul or li and no "200 g lentils" on the card of the own "Quick Dal" in German, which holds the picture placeholder, the name link, "4 Portionen", "Dein Rezept" and "Nicht vorschlagen" (#62 4a, changed by #63)', async () => {
        storeOwnRecipes(DAL_WITH_LENTILS);
        localStorage.setItem(LANGUAGE_KEY, 'de');
        await reload();
        const card = cardOf('Quick Dal');
        expect(partsOf(card)).toEqual([
          ['div.picture.placeholder', ''],
          ['h2', 'Quick Dal'],
          ['p.servings', '4 Portionen'],
          ['p.own', 'Dein Rezept'],
          ['p.suggest', 'Nicht vorschlagen'],
        ]);
        expectNoList(card);
        expect(textOf(element)).not.toContain('200 g lentils');
      });
    });

    it('shows "Not suggested" and a focused "Suggest again" named "Suggest again: Spaghetti pomodoro", with no ul or li, on a click on the focused "Don\'t suggest" of "Spaghetti pomodoro", and a focused "Don\'t suggest" again, with no ul or li, on a click on "Suggest again" (#62 5)', async () => {
      const card = cardOf('Spaghetti pomodoro');
      const dontSuggest = card.querySelector<HTMLButtonElement>('p.suggest button')!;
      dontSuggest.focus();
      await click(dontSuggest);
      const suggest = card.querySelector('p.suggest')!;
      expect(Array.from(suggest.children).map((child) => [child.tagName, textOf(child)])).toEqual([
        ['SPAN', 'Not suggested'],
        ['BUTTON', 'Suggest again'],
      ]);
      const again = suggest.querySelector<HTMLButtonElement>('button')!;
      expect(again.getAttribute('aria-label')).toBe('Suggest again: Spaghetti pomodoro');
      expect(document.activeElement, 'focus after "Don\'t suggest"').toBe(again);
      expectNoList(card);

      await click(again);
      const back = card.querySelector<HTMLButtonElement>('p.suggest button')!;
      expect(textOf(back)).toBe("Don't suggest");
      expect(document.activeElement, 'focus after "Suggest again"').toBe(back);
      expectNoList(card);
    });

    describe('edge cases', () => {
      it('ends the card of "Spaghetti pomodoro" with "Suggest again", the last element of its p.suggest, the card\'s last element, after "Don\'t suggest" and after a reload (#62 5a)', async () => {
        await click(
          cardOf('Spaghetti pomodoro').querySelector<HTMLButtonElement>('p.suggest button')!,
        );
        expectEndsWithSuggestAgain('after "Don\'t suggest"');
        await reload();
        expectEndsWithSuggestAgain('after a reload');

        function expectEndsWithSuggestAgain(when: string) {
          const card = cardOf('Spaghetti pomodoro');
          const last = card.lastElementChild;
          expect(last?.matches('p.suggest'), `p.suggest last ${when}`).toBe(true);
          expect(textOf(last!.lastElementChild!), `last in p.suggest ${when}`).toBe(
            'Suggest again',
          );
        }
      });
    });

    function expectNoList(card: HTMLElement) {
      expect(
        card.querySelectorAll('ul, li'),
        `ul and li of "${textOf(card.querySelector('h2')!)}"`,
      ).toHaveLength(0);
    }

    function partsOf(card: HTMLElement): string[][] {
      return Array.from(card.children).map((child) => [
        [child.tagName.toLowerCase(), ...Array.from(child.classList)].join('.'),
        textOf(child),
      ]);
    }
  });

  describe('pictures (#63)', () => {
    const PICTURE = 'img.picture, div.picture.placeholder';

    it('starts the card of "Spaghetti pomodoro", which the list holds, with img.picture of images/recipes/spaghetti-pomodoro.webp, alt "" and loading="lazy" before its h2, those of "Penne arrabbiata" and the own "Quick Dal" with div.picture.placeholder, and every card with its picture or placeholder (#63 3)', async () => {
      await reloadWithImages(LISTED_IMAGES, [QUICK_DAL]);
      expect(articles()).toHaveLength(RECIPES.length + 1);
      expect(pictureShape(cardOf('Spaghetti pomodoro').firstElementChild)).toEqual(
        picture('spaghetti-pomodoro', 'lazy'),
      );
      expect(pictureShape(cardOf('Penne arrabbiata').firstElementChild)).toEqual(PLACEHOLDER);
      expect(pictureShape(cardOf('Quick Dal').firstElementChild)).toEqual(PLACEHOLDER);
      for (const article of articles()) {
        const name = textOf(article.querySelector('h2')!);
        expect(article.firstElementChild?.matches(PICTURE), `first element of "${name}"`).toBe(
          true,
        );
        expect(article.children[1]?.tagName, `element after the picture of "${name}"`).toBe('H2');
      }
    });

    describe('edge cases', () => {
      it('shows an img only on the cards of "Pizza toast" and "Spaghetti pomodoro", the two the list holds, so no picture is requested for any other recipe, and a placeholder on the other 83 cards (#63 3a)', async () => {
        await reloadWithImages(LISTED_IMAGES, [QUICK_DAL]);
        const images = Array.from(element.querySelectorAll('img'));
        expect(
          images.map((img) => [
            textOf(img.closest('article')!.querySelector('h2')!),
            img.getAttribute('src'),
          ]),
        ).toEqual([
          ['Spaghetti pomodoro', 'images/recipes/spaghetti-pomodoro.webp'],
          ['Pizza toast', 'images/recipes/pizza-toast.webp'],
        ]);
        expect(element.querySelectorAll('article > div.picture.placeholder')).toHaveLength(
          RECIPES.length + 1 - 2,
        );
      });

      it('makes nothing tabbable with the picture: the card of "Spaghetti pomodoro" still holds only its name link and "Don\'t suggest", and its picture is in no link (#63 3b)', async () => {
        await reloadWithImages(LISTED_IMAGES);
        const card = cardOf('Spaghetti pomodoro');
        expect(pictureShape(card.firstElementChild)).toEqual(picture('spaghetti-pomodoro', 'lazy'));
        expect(card.firstElementChild!.closest('a'), 'link around the picture').toBeNull();
        expect(
          Array.from(card.querySelectorAll(TABBABLE)).map(
            (tabbable) => `${tabbable.tagName.toLowerCase()} "${textOf(tabbable)}"`,
          ),
        ).toEqual(['a "Spaghetti pomodoro"', 'button "Don\'t suggest"']);
        const placeholder = cardOf('Penne arrabbiata').firstElementChild!;
        expect(pictureShape(placeholder)).toEqual(PLACEHOLDER);
        expect(placeholder.querySelectorAll(TABBABLE), 'tabbable in the placeholder').toHaveLength(
          0,
        );
      });

      it('shows the picture of "Niçoise salad" from its slug, images/recipes/nicoise-salad.webp, when the list holds "nicoise-salad" (#63 3c)', async () => {
        await reloadWithImages(['nicoise-salad']);
        expect(pictureShape(cardOf('Niçoise salad').firstElementChild)).toEqual(
          picture('nicoise-salad', 'lazy'),
        );
        expect(element.querySelectorAll('img'), 'img elements').toHaveLength(1);
      });

      it('shows no img and a placeholder first on each of the 84 cards when the list is empty (#63 3d)', async () => {
        await reloadWithImages([]);
        expectAllRecipesRendered();
        expect(element.querySelectorAll('img'), 'img elements').toHaveLength(0);
        for (const article of articles()) {
          expect(
            pictureShape(article.firstElementChild),
            `first element of "${textOf(article.querySelector('h2')!)}"`,
          ).toEqual(PLACEHOLDER);
        }
      });

      it('shows the same picture, from the slug of the English name, on the German card "Spaghetti Pomodoro" (#63 3e)', async () => {
        localStorage.setItem(LANGUAGE_KEY, 'de');
        await reloadWithImages(LISTED_IMAGES);
        const card = cardOf('Spaghetti Pomodoro');
        expect(pictureShape(card.firstElementChild)).toEqual(picture('spaghetti-pomodoro', 'lazy'));
      });

      it('keeps each card\'s picture on the cards a search leaves: "Spaghetti pomodoro" with its img and "Spaghetti carbonara" with a placeholder for "spaghetti" (#63 3f)', async () => {
        await reloadWithImages(LISTED_IMAGES);
        await search('spaghetti');
        expect(pictureShape(cardOf('Spaghetti pomodoro').firstElementChild)).toEqual(
          picture('spaghetti-pomodoro', 'lazy'),
        );
        expect(pictureShape(cardOf('Spaghetti carbonara').firstElementChild)).toEqual(PLACEHOLDER);
        expect(element.querySelectorAll('img'), 'img elements').toHaveLength(1);
      });
    });

    // A fresh app on the given list of pictures and the saved own recipes, as a reload makes
    async function reloadWithImages(images: readonly string[], own: Recipe[] = []) {
      if (own.length > 0) {
        storeOwnRecipes(...own);
      }
      fixture.destroy();
      TestBed.resetTestingModule();
      configure([{ provide: RECIPE_IMAGES, useValue: images }]);
      await openPage();
    }
  });

  function configure(providers: Provider[] = []) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        { provide: RANDOM, useValue: seededRandom(1) },
        { provide: TODAY, useValue: () => '2026-10-24' },
        ...providers,
      ],
    });
  }

  async function openPage() {
    await loadStoresOnce();
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

  async function search(text: string, label = 'Search recipes') {
    const field = searchField(label);
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function searchField(name = 'Search recipes'): HTMLInputElement {
    const field = Array.from(
      element.querySelectorAll<HTMLInputElement>('input[type="search"]'),
    ).find(
      (input) =>
        input.getAttribute('aria-label') === name ||
        Array.from(input.labels ?? []).some((label) => textOf(label) === name),
    );
    expect(field, `no search field labelled "${name}"`).toBeDefined();
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

  function nameLinkOf(name: string): HTMLAnchorElement {
    const link = cardOf(name).querySelector<HTMLAnchorElement>('h2 a');
    expect(link, `no link in the name of "${name}"`).not.toBeNull();
    return link!;
  }

  function listedNames(): string[] {
    return articles().map((article) => textOf(article.querySelector('h2')!));
  }

  function cardOf(name: string): HTMLElement {
    const article = articles().find((candidate) => textOf(candidate.querySelector('h2')!) === name);
    expect(article, `"${name}" not shown`).toBeDefined();
    return article!;
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
