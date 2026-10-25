import { acceptPlan, addedKey, Plan, PlanDay } from '../plan/plan';
import { covered, day, picked } from '../plan/testing';
import { Recipe } from '../recipes/recipe';
import {
  AddedItem,
  addedItems,
  addFeedback,
  byName,
  bySection,
  GroceryItem,
  groceryList,
  itemKey,
  listItems,
  shoppingView,
} from './groceries';
import { Section, SECTIONS, sectionOf } from './sections';

const RECIPES: readonly Recipe[] = [
  {
    name: 'Spaghetti',
    servings: 2,
    ingredients: [
      { name: 'spaghetti', amount: 200, unit: 'g' },
      { name: 'tomatoes', amount: 400, unit: 'g' },
    ],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Chili',
    servings: 2,
    ingredients: [
      { name: 'tomatoes', amount: 200, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pc' },
    ],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Soup',
    servings: 4,
    ingredients: [
      { name: 'carrots', amount: 500, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pc' },
    ],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Stew',
    servings: 4,
    ingredients: [
      { name: 'onion', amount: 1, unit: 'pc' },
      { name: 'stock', amount: 500, unit: 'ml' },
    ],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Fried onions',
    servings: 2,
    ingredients: [{ name: 'onion', amount: 300, unit: 'g' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Rice',
    servings: 2,
    ingredients: [{ name: 'rice', amount: 150, unit: 'g' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Salad',
    servings: 3,
    ingredients: [{ name: 'lettuce', amount: 200, unit: 'g' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Dressing',
    servings: 4,
    ingredients: [{ name: 'soy sauce', amount: 3, unit: 'tbsp' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Porridge',
    servings: 2,
    ingredients: [{ name: 'sugar', amount: 0.4, unit: 'tsp' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Bread',
    servings: 2,
    ingredients: [{ name: 'sugar', amount: 1.6, unit: 'tsp' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Market',
    servings: 2,
    ingredients: [
      { name: 'parmesan', amount: 50, unit: 'g' },
      { name: 'beef sirloin', amount: 300, unit: 'g' },
      { name: 'tomato', amount: 1, unit: 'pc' },
      { name: 'tomato', amount: 200, unit: 'g' },
      { name: 'basil', amount: 20, unit: 'g' },
    ],
    minutes: 30,
    workMinutes: 15,
    steps: [],
  },
  {
    name: 'Exotic',
    servings: 2,
    ingredients: [{ name: 'dragon fruit', amount: 1, unit: 'pc' }],
    minutes: 30,
    workMinutes: 15,
    steps: [],
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
    minutes: 30,
    workMinutes: 15,
    steps: [],
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
        item('tomato', 200, 'g', 'Fruit & vegetables'),
        item('tomato', 1, 'pc', 'Fruit & vegetables'),
        item('beef sirloin', 300, 'g', 'Meat & fish'),
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

  describe('addedItems', () => {
    it('lists nothing for a plan that is not accepted, even one with added items', () => {
      const plan = withAdded(
        planFor(2, day('2026-10-24', picked('Rice'), picked('Salad'))),
        'coffee',
      );
      expect(addedItems({ ...plan, accepted: true }), 'accepted plan').toEqual([
        added('coffee', 'Other'),
      ]);

      expect(addedItems(plan)).toEqual([]);
    });

    it('puts an added item matching an ingredient name under that ingredient\'s section, sorted by name among the plan\'s items, and olive oil, salt and other text under "Other"', () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Market'), picked('Rice'))),
        'toilet paper',
        'salt',
        'lemon',
        'olive oil',
      );
      expect(shoppingView(listItems(plan, RECIPES), []).sections).toEqual([
        {
          section: 'Fruit & vegetables',
          items: [
            item('basil', 20, 'g'),
            added('lemon', 'Fruit & vegetables'),
            item('tomato', 200, 'g'),
            item('tomato', 1, 'pc'),
          ],
        },
        { section: 'Meat & fish', items: [item('beef sirloin', 300, 'g')] },
        { section: 'Dairy & eggs', items: [item('parmesan', 50, 'g')] },
        { section: 'Pasta, rice & grains', items: [item('rice', 150, 'g')] },
        {
          section: 'Other',
          items: [
            added('olive oil', 'Other'),
            added('salt', 'Other'),
            added('toilet paper', 'Other'),
          ],
        },
      ]);
    });

    it('matches the whole text with an ingredient name ignoring case, and keeps the text as typed', () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Rice'), picked('Salad'))),
        'Lemon',
        'Canned Tomatoes',
        '2 lemons',
        'lemon juice',
      );
      expect(addedItems(plan)).toEqual([
        added('Lemon', 'Fruit & vegetables'),
        added('Canned Tomatoes', 'Cans & jars'),
        added('2 lemons', 'Other'),
        added('lemon juice', 'Other'),
      ]);
    });

    it("lists an added item named like a plan item on its own line, after the plan's lines of that name", () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Market'), picked('Rice'))),
        'tomato',
      );
      const [vegetables] = shoppingView(listItems(plan, RECIPES), []).sections;
      expect(vegetables).toEqual({
        section: 'Fruit & vegetables',
        items: [
          item('basil', 20, 'g'),
          item('tomato', 200, 'g'),
          item('tomato', 1, 'pc'),
          added('tomato', 'Fruit & vegetables'),
        ],
      });
    });
  });

  describe('addFeedback', () => {
    const plan = acceptedPlanFor(2, day('2026-10-24', picked('Chili'), picked('Rice')));
    const onion = item('onion', 1, 'pc');

    it('says an entry is added under its section, already on the list or already in the cart, and nothing for a blank entry or a plan that is not accepted', () => {
      expect(addFeedback(plan, 'tea')).toBe('Added "tea" to Other.');
      expect(addFeedback(plan, ' Lemon ')).toBe('Added "Lemon" to Fruit & vegetables.');
      expect(addFeedback(plan, '  ')).toBe('');

      const withCoffee = withAdded(plan, 'coffee');
      expect(addFeedback(withCoffee, ' COFFEE ')).toBe('"coffee" is already on the list.');
      const coffeeTicked = { ...withCoffee, ticked: [addedKey('coffee')] };
      expect(addFeedback(coffeeTicked, 'coffee')).toBe('"coffee" is already in the cart.');

      expect(addFeedback(withAdded(plan, 'Café'), 'cafe')).toBe('Added "cafe" to Other.');

      const notAccepted = planFor(2, day('2026-10-24', picked('Chili'), picked('Rice')));
      expect(addFeedback(notAccepted, 'tea')).toBe('');
    });

    it('says "Added" for an entry named like a plan line, which is not an added item', () => {
      expect(groceryList(plan, RECIPES), 'onion line').toContainEqual(onion);
      expect(addFeedback(plan, 'onion')).toBe('Added "onion" to Fruit & vegetables.');
      expect(addFeedback(plan, 'Onion')).toBe('Added "Onion" to Fruit & vegetables.');
    });

    it('never says "already in the cart" because a plan line of that name is ticked, as only added items count', () => {
      const onionTicked = { ...plan, ticked: [itemKey(onion)] };
      expect(addFeedback(onionTicked, 'onion')).toBe('Added "onion" to Fruit & vegetables.');
      expect(addFeedback(withAdded(onionTicked, 'onion'), 'ONION')).toBe(
        '"onion" is already on the list.',
      );
    });

    it('names an item already added by its stored text, not by the entry', () => {
      const withPaper = withAdded(plan, 'Toilet Paper');
      expect(addFeedback(withPaper, ' toilet PAPER ')).toBe(
        '"Toilet Paper" is already on the list.',
      );
      const paperTicked = { ...withPaper, ticked: [addedKey('Toilet Paper')] };
      expect(addFeedback(paperTicked, 'TOILET PAPER')).toBe(
        '"Toilet Paper" is already in the cart.',
      );
    });

    it('keeps the inner spaces of an entry, which make it another item than the one with a single space', () => {
      expect(addFeedback(withAdded(plan, 'toilet paper'), ' toilet  paper ')).toBe(
        'Added "toilet  paper" to Other.',
      );
    });

    it('says "Added" for an entry that only a stale tick names, as it is not an added item', () => {
      const staleTick = { ...plan, ticked: [addedKey('coffee')] };
      expect(addFeedback(staleTick, 'coffee')).toBe('Added "coffee" to Other.');
    });

    it('returns an empty text for an empty entry, also while items are added and ticked', () => {
      const withCoffee = { ...withAdded(plan, 'coffee'), ticked: [addedKey('coffee')] };
      expect(addFeedback(plan, '')).toBe('');
      expect(addFeedback(withCoffee, '')).toBe('');
      expect(addFeedback(withCoffee, '   ')).toBe('');
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

    it("sorts added and plan items in the cart together by name, the plan's line first for the same name", () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Market'), picked('Rice'))),
        'toilet paper',
        'tomato',
        'coffee',
      );
      const list = listItems(plan, RECIPES);
      expect(shoppingView(list, list.map(itemKey))).toEqual({
        sections: [],
        inCart: [
          item('basil', 20, 'g'),
          item('beef sirloin', 300, 'g'),
          added('coffee', 'Other'),
          item('parmesan', 50, 'g'),
          item('rice', 150, 'g'),
          added('toilet paper', 'Other'),
          item('tomato', 200, 'g'),
          item('tomato', 1, 'pc'),
          added('tomato', 'Fruit & vegetables'),
        ],
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

    it('gives an added item the key addedKey makes, which no plan item of that name has, so the two are ticked separately', () => {
      const planOnion = item('onion', 1, 'pc');
      const addedOnion = added('onion', 'Fruit & vegetables');
      expect(itemKey(addedOnion)).toBe(addedKey('onion'));
      expect(itemKey(addedOnion)).not.toBe(itemKey(planOnion));
      expect(itemKey(addedOnion)).not.toBe(itemKey(item('onion', 1, 'g')));

      const list = [planOnion, addedOnion];
      expect(shoppingView(list, [itemKey(planOnion)])).toEqual({
        sections: [{ section: 'Fruit & vegetables', items: [addedOnion] }],
        inCart: [planOnion],
      });
      expect(shoppingView(list, [itemKey(addedOnion)])).toEqual({
        sections: [{ section: 'Fruit & vegetables', items: [planOnion] }],
        inCart: [addedOnion],
      });
    });
  });

  function acceptedPlanFor(people: number, ...days: PlanDay[]): Plan {
    return { ...planFor(people, ...days), accepted: true };
  }

  function planFor(people: number, ...days: PlanDay[]): Plan {
    return { days, people, accepted: false, ticked: [], added: [], shown: [] };
  }

  function withAdded(plan: Plan, ...texts: string[]): Plan {
    return { ...plan, added: texts };
  }

  function added(name: string, section: Section): AddedItem {
    return { name, section, added: true };
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
