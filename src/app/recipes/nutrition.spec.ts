import { nutritionMessage, NutritionEntry, nutritionOf } from './nutrition';
import nutrition from './nutrition.json';
import { Ingredient, Recipe } from './recipe';
import { RECIPES } from './recipes';
import { PLAIN_RICE, QUICK_DAL } from './testing';

const TABLE: Record<string, NutritionEntry> = nutrition;

describe('nutrition.json', () => {
  it('has grams for every ingredient of every built-in recipe in its unit, only entries a built-in recipe uses, its keys in sorted order, whole values ≥ 0 with protein + carbs + fat ≤ 100, grams factors > 0, and the entries of egg, olive oil, milk, paprika and vegetable oil of #60', () => {
    for (const recipe of RECIPES) {
      for (const { name, unit } of recipe.ingredients) {
        const entry = TABLE[name];
        expect(entry, `entry of "${name}" (${recipe.name})`).toBeDefined();
        if (unit !== 'g') {
          expect(
            entry.grams?.[unit],
            `grams of 1 ${unit} "${name}" (${recipe.name})`,
          ).toBeDefined();
        }
      }
    }
    const used = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map(({ name }) => name)));
    const keys = Object.keys(TABLE);
    expect(
      keys.filter((key) => !used.has(key)),
      'entries no built-in recipe uses',
    ).toEqual([]);
    expect(keys, 'keys').toEqual([...keys].sort());
    expect(keys, 'entries').toHaveLength(137);

    for (const [name, entry] of Object.entries(TABLE)) {
      for (const value of [entry.kcal, entry.protein, entry.carbs, entry.fat]) {
        expect(Number.isInteger(value) && value >= 0, `values of "${name}"`).toBe(true);
      }
      expect(
        entry.protein + entry.carbs + entry.fat,
        `protein + carbs + fat of "${name}"`,
      ).toBeLessThanOrEqual(100);
      for (const [unit, grams] of Object.entries(entry.grams ?? {})) {
        expect(grams, `grams of 1 ${unit} "${name}"`).toBeGreaterThan(0);
      }
    }

    expect(TABLE['egg']).toEqual({ kcal: 155, protein: 13, carbs: 1, fat: 11, grams: { pc: 60 } });
    expect(TABLE['olive oil']).toEqual({
      kcal: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      grams: { tbsp: 14, ml: 0.92 },
    });
    expect(TABLE['milk']).toEqual({ kcal: 64, protein: 3, carbs: 5, fat: 4, grams: { ml: 1.03 } });
    expect(TABLE['paprika']).toEqual({
      kcal: 282,
      protein: 14,
      carbs: 54,
      fat: 13,
      grams: { tsp: 2.3 },
    });
    expect(TABLE['vegetable oil']).toEqual({
      kcal: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      grams: { ml: 0.92 },
    });
  });
});

describe('nutritionOf', () => {
  it('gives one serving of "Spaghetti pomodoro" 615 kcal, 21 g protein, 85 g carbs and 20 g fat, of "Pizza toast" 567/24/57/27, of "Chicken curry with rice" 763/44/74/31, of "Croque monsieur" 850/50/63/44, of the own "Plain Rice" 270/5/59/1, of an own recipe of 100 ml olive oil for 1 813 kcal and 92 g fat, and values to every built-in recipe', () => {
    expect(nutritionOf(recipeNamed('Spaghetti pomodoro'))).toEqual({
      perServing: { kcal: 615, protein: 21, carbs: 85, fat: 20 },
    });
    expect(nutritionOf(recipeNamed('Pizza toast'))).toEqual({
      perServing: { kcal: 567, protein: 24, carbs: 57, fat: 27 },
    });
    expect(nutritionOf(recipeNamed('Chicken curry with rice'))).toEqual({
      perServing: { kcal: 763, protein: 44, carbs: 74, fat: 31 },
    });
    expect(nutritionOf(recipeNamed('Croque monsieur'))).toEqual({
      perServing: { kcal: 850, protein: 50, carbs: 63, fat: 44 },
    });
    expect(nutritionOf(PLAIN_RICE)).toEqual({
      perServing: { kcal: 270, protein: 5, carbs: 59, fat: 1 },
    });
    expect(nutritionOf(ownOf(1, { name: 'olive oil', amount: 100, unit: 'ml' }))).toEqual({
      perServing: expect.objectContaining({ kcal: 813, fat: 92 }),
    });
    for (const recipe of RECIPES) {
      expect(nutritionOf(recipe), recipe.name).toHaveProperty('perServing');
    }
  });

  it('lists "mystery spice" as missing for "Quick Dal", and "flour" and "mystery spice" once each for 1 pc flour, which has no piece weight, and mystery spice twice under different units', () => {
    expect(nutritionOf(QUICK_DAL)).toEqual({ missing: ['mystery spice'] });
    expect(
      nutritionOf(
        ownOf(
          2,
          { name: 'flour', amount: 1, unit: 'pc' },
          { name: 'mystery spice', amount: 1, unit: 'pc' },
          { name: 'mystery spice', amount: 2, unit: 'tsp' },
        ),
      ),
    ).toEqual({ missing: ['flour', 'mystery spice'] });
  });

  describe('edge cases', () => {
    it('rounds the summed serving, not each ingredient: 40 g rice and 40 g rice noodle for 1 have 1 g fat from 0.4 g each (#60 2a)', () => {
      expect(
        nutritionOf(
          ownOf(
            1,
            { name: 'rice', amount: 40, unit: 'g' },
            { name: 'rice noodle', amount: 40, unit: 'g' },
          ),
        ),
      ).toEqual({ perServing: { kcal: 288, protein: 5, carbs: 64, fat: 1 } });
    });

    it('rounds a half up, as Math.round does: 50 g rice for 1 has 180 kcal, 4 g protein from 3.5, 40 g carbs from 39.5 and 1 g fat from 0.5 (#60 2b)', () => {
      expect(nutritionOf(ownOf(1, { name: 'rice', amount: 50, unit: 'g' }))).toEqual({
        perServing: { kcal: 180, protein: 4, carbs: 40, fat: 1 },
      });
    });

    it("takes the amount in g as the grams even when the entry has factors: 100 g olive oil for 1 is 884 kcal and 100 g fat, not 100 ml's 813 and 92 (#60 2c)", () => {
      expect(nutritionOf(ownOf(1, { name: 'olive oil', amount: 100, unit: 'g' }))).toEqual({
        perServing: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
      });
    });

    it('lists an ingredient of the table as missing in a unit it has no factor for: 10 ml soy sauce, which has only tbsp, and 1 tbsp milk, which has only ml (#60 3a)', () => {
      expect(nutritionOf(ownOf(2, { name: 'soy sauce', amount: 10, unit: 'ml' }))).toEqual({
        missing: ['soy sauce'],
      });
      expect(
        nutritionOf(
          ownOf(
            2,
            { name: 'rice', amount: 150, unit: 'g' },
            { name: 'milk', amount: 1, unit: 'tbsp' },
          ),
        ),
      ).toEqual({ missing: ['milk'] });
    });

    it('lists the missing names in the order of the ingredients, not sorted: "mystery spice" before "flour" when it comes first (#60 3b)', () => {
      expect(
        nutritionOf(
          ownOf(
            2,
            { name: 'mystery spice', amount: 1, unit: 'pc' },
            { name: 'rice', amount: 150, unit: 'g' },
            { name: 'flour', amount: 1, unit: 'pc' },
          ),
        ),
      ).toEqual({ missing: ['mystery spice', 'flour'] });
    });
  });
});

describe('nutritionMessage', () => {
  it('reads nutrition.perServing with the values of one serving for "Spaghetti pomodoro", and nutrition.missing with the missing names joined by ", " for "Quick Dal" and for flour and mystery spice', () => {
    expect(nutritionMessage(recipeNamed('Spaghetti pomodoro'))).toEqual({
      id: 'nutrition.perServing',
      params: { kcal: 615, protein: 21, carbs: 85, fat: 20 },
    });
    expect(nutritionMessage(QUICK_DAL)).toEqual({
      id: 'nutrition.missing',
      params: { names: 'mystery spice' },
    });
    expect(
      nutritionMessage(
        ownOf(
          2,
          { name: 'flour', amount: 1, unit: 'pc' },
          { name: 'rice', amount: 150, unit: 'g' },
          { name: 'mystery spice', amount: 1, unit: 'pc' },
        ),
      ),
    ).toEqual({ id: 'nutrition.missing', params: { names: 'flour, mystery spice' } });
  });
});

function recipeNamed(name: string): Recipe {
  const recipe = RECIPES.find((candidate) => candidate.name === name);
  expect(recipe, `no recipe "${name}"`).toBeDefined();
  return recipe!;
}

function ownOf(servings: number, ...ingredients: Ingredient[]): Recipe {
  return { name: 'Test dish', servings, ingredients, own: true };
}
