import { isKidFriendly, STRONG_FLAVOURS } from './kid-friendly';
import { Ingredient, Recipe } from './recipe';

const STRONG = [
  'chili flakes',
  'chili powder',
  'green curry paste',
  'fish sauce',
  'anchovy',
  'tamarind paste',
];

describe('isKidFriendly', () => {
  it('is true for a recipe of spaghetti, canned tomatoes and parmesan, false for one with chili flakes, chili powder, green curry paste, fish sauce, anchovy or tamarind paste among them, and false for an own recipe with chili flakes', () => {
    const pomodoro = recipeOf(['spaghetti', 'canned tomatoes', 'parmesan']);
    expect(isKidFriendly(pomodoro), 'spaghetti, canned tomatoes and parmesan').toBe(true);
    for (const flavour of STRONG) {
      expect(isKidFriendly(recipeOf(['spaghetti', flavour, 'parmesan'])), flavour).toBe(false);
    }
    expect(isKidFriendly({ ...recipeOf(['rice', 'chili flakes']), own: true }), 'own').toBe(false);
  });

  describe('edge cases', () => {
    it('is true for ingredients that only contain the words of a strong flavour: chili, sweet chili sauce, red curry paste, anchovy paste and tamarind', () => {
      for (const name of [
        'chili',
        'sweet chili sauce',
        'red curry paste',
        'anchovy paste',
        'tamarind',
      ]) {
        expect(isKidFriendly(recipeOf(['rice', name])), name).toBe(true);
      }
    });

    it('lists exactly the six strong flavours in STRONG_FLAVOURS', () => {
      expect([...STRONG_FLAVOURS].sort()).toEqual([...STRONG].sort());
    });
  });

  function recipeOf(names: string[]): Recipe {
    const ingredients: Ingredient[] = names.map((name) => ({ name, amount: 1, unit: 'pc' }));
    return { name: 'Test dish', servings: 2, ingredients };
  }
});
