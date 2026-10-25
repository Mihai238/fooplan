import { Ingredient, Recipe } from './recipe';
import { searchRecipes } from './recipe-search';
import { RECIPES } from './recipes';

describe('searchRecipes', () => {
  it('finds the recipes whose name contains the search text, ignoring case, accents and surrounding spaces, in RECIPES order', () => {
    const spaghetti = [
      'Spaghetti pomodoro',
      'Spaghetti carbonara',
      'Spaghetti bolognese',
      'Spaghetti aglio e olio',
    ];
    expect(namesFor('spaghetti')).toEqual(spaghetti);
    expect(namesFor('  SPAGHETTI ')).toEqual(spaghetti);
    expect(namesFor('kase')).toEqual(['Käsespätzle']);
    expect(namesFor('nicoise')).toEqual(['Niçoise salad']);
  });

  it('does not match a recipe whose name holds the words of the search text only in another order', () => {
    expect(namesFor('carbonara spaghetti')).toEqual([]);
    expect(namesFor('spaghetti bolognese')).toEqual(['Spaghetti bolognese']);
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
      'Spinach and feta quiche',
      'Greek salad with feta and bread',
    ]);
  });

  it("does not match the search text against an ingredient's amount or unit", () => {
    const recipes = [recipe('Soup', { name: 'water', amount: 500, unit: 'ml' })];
    expect(searchRecipes(recipes, 'water'), 'not found by its ingredient').toEqual(recipes);
    expect(searchRecipes(recipes, '500')).toEqual([]);
    expect(searchRecipes(recipes, 'ml')).toEqual([]);
  });

  it('matches part of an ingredient name ignoring case, accents and surrounding spaces', () => {
    expect(namesFor('  GRUYERE ')).toEqual(['French onion soup']);
    expect(namesFor(' Cherry ')).toEqual([
      'Pesto pasta with cherry tomatoes',
      'Couscous salad with halloumi',
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
      steps: [],
    };
  }
});
