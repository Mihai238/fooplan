import { acceptPlan, Plan, PlanDay } from '../plan/plan';
import { covered, day, picked } from '../plan/testing';
import { Recipe } from '../recipes/recipe';
import { byName, bySection, GroceryItem, groceryList, itemKey, shoppingView } from './groceries';
import { Section, SECTIONS, sectionOf } from './sections';

const RECIPES: readonly Recipe[] = [
  {
    name: 'Spaghetti',
    servings: 2,
    ingredients: [
      { name: 'spaghetti', amount: 200, unit: 'g' },
      { name: 'tomatoes', amount: 400, unit: 'g' },
    ],
  },
  {
    name: 'Chili',
    servings: 2,
    ingredients: [
      { name: 'tomatoes', amount: 200, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pc' },
    ],
  },
  {
    name: 'Soup',
    servings: 4,
    ingredients: [
      { name: 'carrots', amount: 500, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pc' },
    ],
  },
  {
    name: 'Stew',
    servings: 4,
    ingredients: [
      { name: 'onion', amount: 1, unit: 'pc' },
      { name: 'stock', amount: 500, unit: 'ml' },
    ],
  },
  {
    name: 'Fried onions',
    servings: 2,
    ingredients: [{ name: 'onion', amount: 300, unit: 'g' }],
  },
  {
    name: 'Rice',
    servings: 2,
    ingredients: [{ name: 'rice', amount: 150, unit: 'g' }],
  },
  {
    name: 'Salad',
    servings: 3,
    ingredients: [{ name: 'lettuce', amount: 200, unit: 'g' }],
  },
  {
    name: 'Dressing',
    servings: 4,
    ingredients: [{ name: 'soy sauce', amount: 3, unit: 'tbsp' }],
  },
  {
    name: 'Porridge',
    servings: 2,
    ingredients: [{ name: 'sugar', amount: 0.4, unit: 'tsp' }],
  },
  {
    name: 'Bread',
    servings: 2,
    ingredients: [{ name: 'sugar', amount: 1.6, unit: 'tsp' }],
  },
  {
    name: 'Market',
    servings: 2,
    ingredients: [
      { name: 'parmesan', amount: 50, unit: 'g' },
      { name: 'beef', amount: 300, unit: 'g' },
      { name: 'zucchini', amount: 1, unit: 'pc' },
      { name: 'zucchini', amount: 200, unit: 'g' },
      { name: 'basil', amount: 20, unit: 'g' },
    ],
  },
  {
    name: 'Exotic',
    servings: 2,
    ingredients: [{ name: 'dragon fruit', amount: 1, unit: 'pc' }],
  },
  {
    name: 'Staples',
    servings: 2,
    ingredients: [
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
      { name: 'sesame oil', amount: 1, unit: 'tbsp' },
      { name: 'vegetable oil', amount: 1, unit: 'tbsp' },
      { name: 'salt', amount: 1, unit: 'tsp' },
      { name: 'pepper', amount: 1, unit: 'tsp' },
      { name: 'black pepper', amount: 1, unit: 'tsp' },
      { name: 'bell pepper', amount: 2, unit: 'pc' },
    ],
  },
];

const STAPLES = ['olive oil', 'sesame oil', 'vegetable oil', 'salt', 'pepper', 'black pepper'];

describe('groceries', () => {
  describe('groceryList', () => {
    it('lists nothing for a plan that is not accepted yet, even a complete one', () => {
      const plan = planFor(2, day('2026-10-24', picked('Spaghetti'), picked('Chili')));
      expect(groceryList(acceptPlan(plan), RECIPES), 'accepted plan').not.toEqual([]);

      expect(groceryList(plan, RECIPES)).toEqual([]);
    });

    it("scales a recipe's amounts from its servings to the people", () => {
      const plan = acceptedPlanFor(4, day('2026-10-24', picked('Spaghetti'), picked('Rice')));
      expect(groceryList(plan, RECIPES)).toContainEqual(item('spaghetti', 400, 'g'));
    });

    it('keeps an amount that scales to a whole number and halves a recipe for more servings than people', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Rice'), picked('Soup')));
      expect(sorted(groceryList(plan, RECIPES))).toEqual(
        sorted([item('rice', 150, 'g'), item('carrots', 250, 'g'), item('onion', 1, 'pc')]),
      );
    });

    it('merges the same ingredient in the same unit from two recipes into one line with the summed amount', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Spaghetti'), picked('Chili')));
      expect(linesOf(groceryList(plan, RECIPES), 'tomatoes')).toEqual([item('tomatoes', 600, 'g')]);
    });

    it('keeps the same ingredient in different units on separate lines', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Chili'), picked('Fried onions')));
      const onions = linesOf(groceryList(plan, RECIPES), 'onion');
      expect(sorted(onions)).toEqual(sorted([item('onion', 300, 'g'), item('onion', 1, 'pc')]));
    });

    it('counts a dinner cooked extra for twice the people and nothing for the lunch its leftovers cover', () => {
      const plan = acceptedPlanFor(
        2,
        day('2026-10-24', picked('Rice'), picked('Spaghetti'), true),
        day('2026-10-25', covered(), picked('Fried onions')),
      );
      expect(sorted(groceryList(plan, RECIPES))).toEqual(
        sorted([
          item('rice', 150, 'g'),
          item('spaghetti', 400, 'g'),
          item('tomatoes', 800, 'g'),
          item('onion', 300, 'g'),
        ]),
      );
    });

    it('rounds a fraction of a piece up to the next whole piece', () => {
      const plan = acceptedPlanFor(3, day('2026-10-24', picked('Chili'), picked('Rice')));
      expect(linesOf(groceryList(plan, RECIPES), 'onion')).toEqual([item('onion', 2, 'pc')]);
    });

    it('rounds up grams and tablespoons too, like 133.3 g to 134 g and 1.5 tbsp to 2 tbsp', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Salad'), picked('Dressing')));
      expect(sorted(groceryList(plan, RECIPES))).toEqual(
        sorted([item('lettuce', 134, 'g'), item('soy sauce', 2, 'tbsp')]),
      );
    });

    it('does not add a unit for float noise in an amount that sums to a whole number', () => {
      // 0.4 × 3 / 2 + 1.6 × 3 / 2 is 3.0000000000000004 in floating point
      const plan = acceptedPlanFor(3, day('2026-10-24', picked('Porridge'), picked('Bread')));
      expect(linesOf(groceryList(plan, RECIPES), 'sugar')).toEqual([item('sugar', 3, 'tsp')]);
    });

    it('merges amounts before rounding them up, so two half onions make one', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Soup'), picked('Stew')));
      expect(linesOf(groceryList(plan, RECIPES), 'onion')).toEqual([item('onion', 1, 'pc')]);
    });

    it("sorts the items by section in the shop's order, then by name, then by unit", () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Market'), picked('Rice')));
      expect(groceryList(plan, RECIPES)).toEqual([
        item('basil', 20, 'g', 'Fruit & vegetables'),
        item('zucchini', 200, 'g', 'Fruit & vegetables'),
        item('zucchini', 1, 'pc', 'Fruit & vegetables'),
        item('beef', 300, 'g', 'Meat & fish'),
        item('parmesan', 50, 'g', 'Dairy & eggs'),
        item('rice', 150, 'g', 'Pasta, rice & grains'),
      ]);
    });

    it('puts an ingredient missing from the section mapping under "Other", the last section', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Exotic'), picked('Rice')));
      const list = groceryList(plan, RECIPES);
      expect(linesOf(list, 'dragon fruit')).toEqual([item('dragon fruit', 1, 'pc', 'Other')]);
      expect(list.at(-1)?.name).toBe('dragon fruit');
      expect(SECTIONS.at(-1)).toBe('Other');
    });

    it('leaves olive oil, sesame oil, vegetable oil, salt, pepper and black pepper off the list', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Staples'), picked('Rice')));
      const names = groceryList(plan, RECIPES).map((line) => line.name);
      for (const staple of STAPLES) {
        expect(names, staple).not.toContain(staple);
      }
      expect(names, 'empty grocery list').toContain('rice');
    });

    it('lists bell pepper, as only the exact staple names are left off', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Staples'), picked('Rice')));
      expect(linesOf(groceryList(plan, RECIPES), 'bell pepper')).toEqual([
        item('bell pepper', 2, 'pc', 'Fruit & vegetables'),
      ]);
    });
  });

  describe('shoppingView', () => {
    const basil = item('basil', 20, 'g', 'Fruit & vegetables');
    const zucchini = item('zucchini', 1, 'pc', 'Fruit & vegetables');
    const beef = item('beef', 300, 'g', 'Meat & fish');
    const parmesan = item('parmesan', 50, 'g', 'Dairy & eggs');
    const list = [basil, zucchini, beef, parmesan];

    it('groups everything under its section and puts nothing in the cart while nothing is ticked', () => {
      expect(shoppingView(list, [])).toEqual({ sections: bySection(list), inCart: [] });
    });

    it('moves the ticked items out of their sections into the cart, alphabetical by name then unit', () => {
      const ticked = [zucchini, beef, basil].map(itemKey);
      expect(shoppingView(list, ticked)).toEqual({
        sections: [{ section: 'Dairy & eggs', items: [parmesan] }],
        inCart: [basil, beef, zucchini],
      });
    });

    it('ignores ticks whose item is not on the list', () => {
      const stale = itemKey(item('dragon fruit', 1, 'pc'));
      expect(shoppingView(list, [stale, itemKey(beef)])).toEqual({
        sections: bySection([basil, zucchini, parmesan]),
        inCart: [beef],
      });
    });
  });

  describe('bySection', () => {
    it("groups the items under their sections in the shop's order and leaves out sections without items", () => {
      expect(bySection([])).toEqual([]);

      const basil = item('basil', 20, 'g', 'Fruit & vegetables');
      const zucchini = item('zucchini', 1, 'pc', 'Fruit & vegetables');
      const beef = item('beef', 300, 'g', 'Meat & fish');
      const parmesan = item('parmesan', 50, 'g', 'Dairy & eggs');
      const dragonFruit = item('dragon fruit', 1, 'pc', 'Other');
      expect(bySection([beef, basil, dragonFruit, parmesan, zucchini])).toEqual([
        { section: 'Fruit & vegetables', items: [basil, zucchini] },
        { section: 'Meat & fish', items: [beef] },
        { section: 'Dairy & eggs', items: [parmesan] },
        { section: 'Other', items: [dragonFruit] },
      ]);
    });
  });

  describe('itemKey', () => {
    it('gives items that differ in name or in unit different keys, and the same item the same key', () => {
      const onionPieces = itemKey(item('onion', 1, 'pc'));
      expect(itemKey(item('onion', 3, 'pc'))).toBe(onionPieces);
      expect(itemKey(item('onion', 1, 'g'))).not.toBe(onionPieces);
      expect(itemKey(item('garlic', 1, 'pc'))).not.toBe(onionPieces);
    });
  });

  function acceptedPlanFor(people: number, ...days: PlanDay[]): Plan {
    return { ...planFor(people, ...days), accepted: true };
  }

  function planFor(people: number, ...days: PlanDay[]): Plan {
    return { days, people, accepted: false, ticked: [] };
  }

  function item(
    name: string,
    amount: number,
    unit: GroceryItem['unit'],
    section: Section = sectionOf(name),
  ): GroceryItem {
    return { name, amount, unit, section };
  }

  function linesOf(list: GroceryItem[], name: string): GroceryItem[] {
    return list.filter((line) => line.name === name);
  }

  // Only the sorting test checks the order of the lines
  function sorted(list: GroceryItem[]): GroceryItem[] {
    return [...list].sort(byName);
  }
});
