import { TestBed } from '@angular/core/testing';
import { LanguageStore } from '../language-store';
import { RANDOM, TODAY } from '../plan/plan-store';
import { seededRandom } from '../plan/testing';
import { Ingredient, Recipe } from './recipe';
import { searchRecipes } from './recipe-search';
import { RecipeStore } from './recipe-store';
import { RECIPES } from './recipes';
import { ownRecipe, storeOwnRecipes } from './testing';

describe('searchRecipes', () => {
  it('finds the recipes whose name contains the search text, ignoring case, accents and surrounding spaces, in RECIPES order', () => {
    const spaghetti = [
      'Spaghetti pomodoro',
      'Spaghetti carbonara',
      'Spaghetti aglio e olio',
      'Spaghetti with zucchini and parmesan',
      'Spaghetti with meatballs',
    ];
    expect(namesFor('spaghetti')).toEqual(spaghetti);
    expect(namesFor('  SPAGHETTI ')).toEqual(spaghetti);
    expect(namesFor('nicoise')).toEqual(['Niçoise salad']);
  });

  it('does not match a recipe whose name holds the words of the search text only in another order', () => {
    expect(namesFor('carbonara spaghetti')).toEqual([]);
    expect(namesFor('spaghetti carbonara')).toEqual(['Spaghetti carbonara']);
  });

  it('ignores accents in the search text too', () => {
    const recipes = [recipe('Käsespätzle'), recipe('Apfelstrudel'), recipe('Kasekuchen')];
    expect(names(searchRecipes(recipes, 'käse'))).toEqual(['Käsespätzle', 'Kasekuchen']);
    expect(names(searchRecipes(recipes, 'KÄSE'))).toEqual(['Käsespätzle', 'Kasekuchen']);
  });

  it('takes the search text literally, not as a pattern', () => {
    const recipes = [recipe('Lasagne'), recipe('Mac. and cheese')];
    expect(names(searchRecipes(recipes, '.'))).toEqual(['Mac. and cheese']);
    expect(names(searchRecipes(recipes, '('))).toEqual([]);
  });

  it('returns all recipes in RECIPES order for an empty search', () => {
    expect(searchRecipes(RECIPES, '')).toEqual([...RECIPES]);
  });

  it('returns all recipes in RECIPES order for a search of only spaces', () => {
    expect(searchRecipes(RECIPES, '   ')).toEqual([...RECIPES]);
  });

  it('finds the recipes with an ingredient whose name contains the search text, in RECIPES order', () => {
    expect(namesFor('feta')).toEqual([
      'Shakshuka with bread',
      'Greek salad with feta and bread',
      'Spinach and feta omelette',
    ]);
  });

  it("does not match the search text against an ingredient's amount or unit", () => {
    const recipes = [recipe('Soup', { name: 'water', amount: 500, unit: 'ml' })];
    expect(searchRecipes(recipes, 'water'), 'not found by its ingredient').toEqual(recipes);
    expect(searchRecipes(recipes, '500')).toEqual([]);
    expect(searchRecipes(recipes, 'ml')).toEqual([]);
  });

  it('matches part of an ingredient name ignoring case, accents and surrounding spaces', () => {
    expect(
      names(
        searchRecipes(
          [
            recipe('French onion soup', { name: 'gruyère', amount: 100, unit: 'g' }),
            recipe('Tomato soup', { name: 'tomato', amount: 500, unit: 'g' }),
          ],
          '  GRUYERE ',
        ),
      ),
    ).toEqual(['French onion soup']);
    expect(namesFor(' Cherry ')).toEqual([
      'Pesto pasta with cherry tomatoes',
      'Couscous salad with halloumi',
      'Hummus plate with bread and vegetables',
      'Pizza toast',
    ]);
  });

  it('lists a recipe that matches by its name and by several ingredients once', () => {
    const soup = recipe('Tomato soup', 'tomato', 'cherry tomato');
    expect(searchRecipes([soup], 'tomato')).toEqual([soup]);
  });

  it('keeps the order of the given recipes when name and ingredient matches mix', () => {
    const recipes = [
      recipe('Tomato salad', 'lettuce'),
      recipe('Bruschetta', 'tomato'),
      recipe('Risotto', 'rice'),
      recipe('Tomato soup', 'onion'),
    ];
    expect(names(searchRecipes(recipes, 'tomato'))).toEqual([
      'Tomato salad',
      'Bruschetta',
      'Tomato soup',
    ]);
  });

  describe('German texts (#36)', () => {
    let store: RecipeStore;

    beforeEach(() => {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [
          { provide: RANDOM, useValue: seededRandom(1) },
          { provide: TODAY, useValue: () => '2026-10-24' },
        ],
      });
      store = TestBed.inject(RecipeStore);
    });

    it('matches the German recipe and ingredient names in German, not the English ones, and the English names in English, not the German ones', () => {
      const garlic = RECIPES.filter((recipe) => uses(recipe, 'garlic clove')).map(
        (recipe) => recipe.name,
      );
      expect(garlic, 'recipes with garlic clove').toContain('Spaghetti pomodoro');

      TestBed.inject(LanguageStore).set('de');
      expect(namesIn('knoblauch')).toEqual(garlic);
      expect(namesIn('kirschtomaten')).toContain('Pesto pasta with cherry tomatoes');
      expect(namesIn('garlic')).toEqual([]);
      expect(namesIn('cherry')).toEqual([]);

      TestBed.inject(LanguageStore).set('en');
      expect(namesIn('garlic')).toEqual(garlic);
      expect(namesIn('knoblauch')).toEqual([]);
      expect(namesIn('kirschtomaten')).toEqual([]);
    });

    it('ignores accents in German: "kummel" finds the recipes with Kümmel and Kreuzkümmel, while "kuemmel" and "kase" find nothing', () => {
      const kummel = RECIPES.filter(
        (recipe) => uses(recipe, 'caraway') || uses(recipe, 'cumin'),
      ).map((recipe) => recipe.name);
      expect(kummel, 'recipes with caraway or cumin').toContain('Potato goulash');

      TestBed.inject(LanguageStore).set('de');
      expect(namesIn('kummel')).toEqual(kummel);
      expect(namesIn('KÜMMEL')).toEqual(kummel);
      expect(namesIn('kuemmel')).toEqual([]);
      expect(namesIn('kase')).toEqual([]);
    });

    it('matches the ingredients of an own recipe as typed in German, "onion" and not "zwiebel", and its name as typed', () => {
      storeOwnRecipes(ownRecipe('Kuchen vom Blech'));
      TestBed.resetTestingModule();
      store = TestBed.inject(RecipeStore);

      TestBed.inject(LanguageStore).set('de');
      expect(namesIn('onion')).toEqual(['Kuchen vom Blech']);
      expect(namesIn('zwiebel')).not.toContain('Kuchen vom Blech');
      expect(namesIn('vom blech')).toEqual(['Kuchen vom Blech']);
    });

    function namesIn(query: string): string[] {
      return names(searchRecipes(store.all(), query, store));
    }

    function uses(recipe: Recipe, ingredient: string): boolean {
      return recipe.ingredients.some(({ name }) => name === ingredient);
    }
  });

  function namesFor(query: string): string[] {
    return names(searchRecipes(RECIPES, query));
  }

  function names(recipes: readonly Recipe[]): string[] {
    return recipes.map((found) => found.name);
  }

  function recipe(name: string, ...ingredients: (string | Ingredient)[]): Recipe {
    return {
      name,
      servings: 2,
      ingredients: ingredients.map((ingredient) =>
        typeof ingredient === 'string' ? { name: ingredient, amount: 1, unit: 'pc' } : ingredient,
      ),
      minutes: 30,
      workMinutes: 15,
      steps: [],
    };
  }
});
