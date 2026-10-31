import { acceptPlan, addedKey, Plan, PlanDay } from '../plan/plan';
import { covered, day, eatingOut, picked } from '../plan/testing';
import { Recipe } from '../recipes/recipe';
import { RECIPES as BUILT_IN_RECIPES } from '../recipes/recipes';
import {
  AddedItem,
  addedItems,
  addedSection,
  addFeedback,
  byName,
  byShownName,
  bySection,
  cartCount,
  GroceryItem,
  groceryList,
  itemKey,
  listItems,
  shoppingView,
  ShoppingView,
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
  describe('cartCount', () => {
    it("counts the plan's lines and the added items, and those of them ticked into the cart", () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Spaghetti'), picked('Chili'))),
        'coffee',
        'toilet paper',
      );
      const lines = groceryList(plan, RECIPES);
      expect(lines.map((line) => line.name)).toEqual(['onion', 'spaghetti', 'tomatoes']);
      expect(cartCount(plan, RECIPES)).toEqual({ inCart: 0, total: 5 });

      const ticked = { ...plan, ticked: [itemKey(lines[0]), addedKey('coffee')] };
      expect(cartCount(ticked, RECIPES)).toEqual({ inCart: 2, total: 5 });
    });

    it('counts only the added items for a plan that is not accepted yet, the ticked "coffee" in the cart of 2 with "tea" (#52 3c)', () => {
      const plan = {
        ...withAdded(
          planFor(2, day('2026-10-24', picked('Spaghetti'), picked('Chili'))),
          'coffee',
          'tea',
        ),
        ticked: [addedKey('coffee')],
      };
      expect(cartCount(plan, RECIPES)).toEqual({ inCart: 1, total: 2 });
    });

    it('leaves out a tick whose item is not on the list', () => {
      const plan = {
        ...acceptedPlanFor(2, day('2026-10-24', picked('Rice'), eatingOut())),
        ticked: [itemKey(item('dragon fruit', 1, 'pc')), itemKey(item('rice', 150, 'g'))],
      };
      expect(cartCount(plan, RECIPES)).toEqual({ inCart: 1, total: 1 });
    });
  });

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

    it('sorts the items by section in the shop\'s order, then by name, then by unit, the rice under "Probably at home" first (changed by #61)', () => {
      const plan = acceptedPlanFor(2, day('2026-10-24', picked('Market'), picked('Rice')));
      expect(groceryList(plan, RECIPES)).toEqual([
        item('rice', 150, 'g', 'Probably at home'),
        item('basil', 20, 'g', 'Fruit & vegetables'),
        item('tomato', 200, 'g', 'Fruit & vegetables'),
        item('tomato', 1, 'pc', 'Fruit & vegetables'),
        item('beef sirloin', 300, 'g', 'Meat & fish'),
        item('parmesan', 50, 'g', 'Dairy & eggs'),
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

    it('lists exactly the non-staple ingredients of "Spaghetti aglio e olio" for 2 people when the lunch is eating out, and nothing when both meals are', () => {
      const plan = acceptedPlanFor(
        2,
        day(
          '2026-10-24',
          eatingOut(['Fish tacos', 'Potato goulash', 'Penne arrabbiata']),
          picked('Spaghetti aglio e olio'),
        ),
      );
      expect(sorted(groceryList(plan, BUILT_IN_RECIPES))).toEqual(
        sorted([
          item('spaghetti', 200, 'g'),
          item('garlic clove', 4, 'pc'),
          item('chili flakes', 1, 'tsp'),
          item('parsley', 10, 'g'),
        ]),
      );

      const eatingOutOnly = acceptedPlanFor(
        2,
        day(
          '2026-10-24',
          eatingOut(['Fish tacos', 'Potato goulash', 'Penne arrabbiata']),
          eatingOut(['Spaghetti aglio e olio', 'Mac and cheese', 'Bean burritos']),
        ),
      );
      expect(groceryList(eatingOutOnly, BUILT_IN_RECIPES)).toEqual([]);
    });

    it('keeps its own scaling and rounding up for "Beef stroganoff with rice" (4 servings) in a plan for 3, which the recipe page shows to 2 decimals: 1 pc onion, 23 g butter and 188 ml beef stock, no vegetable oil (#55 2b)', () => {
      const plan = acceptedPlanFor(
        3,
        day(
          '2026-10-24',
          eatingOut(['Fish tacos', 'Potato goulash', 'Penne arrabbiata']),
          picked('Beef stroganoff with rice'),
        ),
      );
      expect(sorted(groceryList(plan, BUILT_IN_RECIPES))).toEqual(
        sorted([
          item('beef sirloin', 450, 'g'),
          item('onion', 1, 'pc'),
          item('mushroom', 225, 'g'),
          item('butter', 23, 'g'),
          item('paprika', 1, 'tsp'),
          item('mustard', 1, 'tbsp'),
          item('beef stock', 188, 'ml'),
          item('sour cream', 150, 'g'),
          item('parsley', 8, 'g'),
          item('rice', 225, 'g'),
        ]),
      );
    });

    it('lists "Croque monsieur" and "Chicken fried rice" of a 1-day plan for 2 under their sections: butter, egg, flour, garlic clove, milk, mustard, the 0.5 tsp nutmeg rounded up to 1 tsp, rice and soy sauce under Probably at home first, ham and chicken breast under Meat & fish, emmental under Dairy & eggs, bread under Bread & bakery, no Pasta, rice & grains or Spices & sauces, nothing under Other and no oil (#58 10, changed by #61)', () => {
      const plan = acceptedPlanFor(
        2,
        day('2026-10-24', picked('Croque monsieur'), picked('Chicken fried rice')),
      );
      const list = groceryList(plan, BUILT_IN_RECIPES);
      expect(
        bySection(list).map(({ section, items }) => [
          section,
          items.map(({ amount, unit, name }) => `${amount} ${unit} ${name}`),
        ]),
      ).toEqual([
        [
          'Probably at home',
          [
            '30 g butter',
            '2 pc egg',
            '20 g flour',
            '2 pc garlic clove',
            '200 ml milk',
            '1 tbsp mustard',
            '1 tsp nutmeg',
            '200 g rice',
            '3 tbsp soy sauce',
          ],
        ],
        ['Fruit & vegetables', ['1 pc carrot', '100 g pea', '3 pc spring onion']],
        ['Meat & fish', ['250 g chicken breast', '150 g ham']],
        ['Dairy & eggs', ['150 g emmental']],
        ['Bread & bakery', ['200 g bread']],
      ]);
      expect(
        list.filter((line) => /oil/.test(line.name)),
        'oils',
      ).toEqual([]);
    });

    describe('edge cases', () => {
      it('adds up the ham, emmental, milk, butter and flour of "Croque monsieur" and "Savoury pancakes with ham and cheese" in a 1-day plan for 2 into one line each: 300 g ham, 300 g emmental, and 500 ml milk, 60 g butter and 170 g flour under Probably at home (#58 10a, changed by #61)', () => {
        const plan = acceptedPlanFor(
          2,
          day(
            '2026-10-24',
            picked('Croque monsieur'),
            picked('Savoury pancakes with ham and cheese'),
          ),
        );
        const list = groceryList(plan, BUILT_IN_RECIPES);
        expect(
          ['ham', 'emmental', 'milk', 'butter', 'flour'].flatMap((name) => linesOf(list, name)),
        ).toEqual([
          item('ham', 300, 'g', 'Meat & fish'),
          item('emmental', 300, 'g', 'Dairy & eggs'),
          item('milk', 500, 'ml', 'Probably at home'),
          item('butter', 60, 'g', 'Probably at home'),
          item('flour', 170, 'g', 'Probably at home'),
        ]);
      });
    });
  });

  describe('addedItems', () => {
    it('puts an added item matching an ingredient name under that ingredient\'s section, "lemon" under "Probably at home", sorted by name among the plan\'s items, and olive oil, salt and other text under "Other" (changed by #61)', () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Market'), picked('Rice'))),
        'toilet paper',
        'salt',
        'lemon',
        'olive oil',
      );
      expect(shoppingView(listItems(plan, RECIPES), []).sections).toEqual([
        {
          section: 'Probably at home',
          items: [added('lemon', 'Probably at home'), item('rice', 150, 'g')],
        },
        {
          section: 'Fruit & vegetables',
          items: [item('basil', 20, 'g'), item('tomato', 200, 'g'), item('tomato', 1, 'pc')],
        },
        { section: 'Meat & fish', items: [item('beef sirloin', 300, 'g')] },
        { section: 'Dairy & eggs', items: [item('parmesan', 50, 'g')] },
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

    it('matches the whole text with an ingredient name ignoring case, and keeps the text as typed (changed by #61)', () => {
      const plan = withAdded(
        acceptedPlanFor(2, day('2026-10-24', picked('Rice'), picked('Salad'))),
        'Lemon',
        'Canned Tomatoes',
        '2 lemons',
        'lemon juice',
      );
      expect(addedItems(plan)).toEqual([
        added('Lemon', 'Probably at home'),
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
      const vegetables = shoppingView(listItems(plan, RECIPES), []).sections.find(
        ({ section }) => section === 'Fruit & vegetables',
      );
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

    it('says an entry is added under its section, already on the list or already in the cart, and nothing for a blank entry (changed by #52 and #61)', () => {
      expect(addFeedback(plan, 'tea')).toEqual({
        id: 'groceries.added',
        params: { item: 'tea', section: 'Other' },
      });
      expect(addFeedback(plan, ' Lemon ')).toEqual({
        id: 'groceries.added',
        params: { item: 'Lemon', section: 'Probably at home' },
      });
      expect(addFeedback(plan, '  ')).toBeNull();

      const withCoffee = withAdded(plan, 'coffee');
      expect(addFeedback(withCoffee, ' COFFEE ')).toEqual({
        id: 'groceries.alreadyOnList',
        params: { item: 'coffee' },
      });
      const coffeeTicked = { ...withCoffee, ticked: [addedKey('coffee')] };
      expect(addFeedback(coffeeTicked, 'coffee')).toEqual({
        id: 'groceries.alreadyInCart',
        params: { item: 'coffee' },
      });

      expect(addFeedback(withAdded(plan, 'Café'), 'cafe')).toEqual({
        id: 'groceries.added',
        params: { item: 'cafe', section: 'Other' },
      });
    });

    it('says "Added" for an entry named like a plan line, which is not an added item (changed by #61)', () => {
      expect(groceryList(plan, RECIPES), 'onion line').toContainEqual(onion);
      expect(addFeedback(plan, 'onion')).toEqual({
        id: 'groceries.added',
        params: { item: 'onion', section: 'Probably at home' },
      });
      expect(addFeedback(plan, 'Onion')).toEqual({
        id: 'groceries.added',
        params: { item: 'Onion', section: 'Probably at home' },
      });
    });

    it('never says "already in the cart" because a plan line of that name is ticked, as only added items count (changed by #61)', () => {
      const onionTicked = { ...plan, ticked: [itemKey(onion)] };
      expect(addFeedback(onionTicked, 'onion')).toEqual({
        id: 'groceries.added',
        params: { item: 'onion', section: 'Probably at home' },
      });
      expect(addFeedback(withAdded(onionTicked, 'onion'), 'ONION')).toEqual({
        id: 'groceries.alreadyOnList',
        params: { item: 'onion' },
      });
    });

    it('names an item already added by its stored text, not by the entry', () => {
      const withPaper = withAdded(plan, 'Toilet Paper');
      expect(addFeedback(withPaper, ' toilet PAPER ')).toEqual({
        id: 'groceries.alreadyOnList',
        params: { item: 'Toilet Paper' },
      });
      const paperTicked = { ...withPaper, ticked: [addedKey('Toilet Paper')] };
      expect(addFeedback(paperTicked, 'TOILET PAPER')).toEqual({
        id: 'groceries.alreadyInCart',
        params: { item: 'Toilet Paper' },
      });
    });

    it('keeps the inner spaces of an entry, which make it another item than the one with a single space', () => {
      expect(addFeedback(withAdded(plan, 'toilet paper'), ' toilet  paper ')).toEqual({
        id: 'groceries.added',
        params: { item: 'toilet  paper', section: 'Other' },
      });
    });

    it('says "Added" for an entry that only a stale tick names, as it is not an added item', () => {
      const staleTick = { ...plan, ticked: [addedKey('coffee')] };
      expect(addFeedback(staleTick, 'coffee')).toEqual({
        id: 'groceries.added',
        params: { item: 'coffee', section: 'Other' },
      });
    });

    it('returns no message for an empty entry, also while items are added and ticked', () => {
      const withCoffee = { ...withAdded(plan, 'coffee'), ticked: [addedKey('coffee')] };
      expect(addFeedback(plan, '')).toBeNull();
      expect(addFeedback(withCoffee, '')).toBeNull();
      expect(addFeedback(withCoffee, '   ')).toBeNull();
    });
  });

  describe('before acceptance (#52)', () => {
    const notAccepted = planFor(2, day('2026-10-24', picked('Spaghetti'), picked('Chili')));

    it('lists only the added "toilet paper" under Other and "Lemon" under Probably at home for a plan that is not accepted, and says "toilet paper" is already on the list and "tea" is added to Other (#52 3, changed by #61)', () => {
      const plan = withAdded(notAccepted, 'toilet paper', 'Lemon');
      expect(listItems(plan, RECIPES)).toEqual([
        added('toilet paper', 'Other'),
        added('Lemon', 'Probably at home'),
      ]);
      expect(addFeedback(plan, 'toilet paper')).toEqual({
        id: 'groceries.alreadyOnList',
        params: { item: 'toilet paper' },
      });
      expect(addFeedback(plan, 'tea')).toEqual({
        id: 'groceries.added',
        params: { item: 'tea', section: 'Other' },
      });
    });

    it('lists no plan line and puts no ticked plan line in the cart for a complete plan that is not accepted with an added item, and lists the added item (#52 3a)', () => {
      const plan = {
        ...withAdded(notAccepted, 'coffee'),
        ticked: [itemKey(item('onion', 1, 'pc'))],
      };
      expect(groceryList(acceptPlan(plan), RECIPES), 'accepted plan').toContainEqual(
        item('onion', 1, 'pc'),
      );
      expect(groceryList(plan, RECIPES)).toEqual([]);
      expect(shoppingView(listItems(plan, RECIPES), plan.ticked).inCart).toEqual([]);

      expect(listItems(plan, RECIPES)).toEqual([added('coffee', 'Other')]);
    });

    it('returns no message for a blank entry on a plan that is not accepted, says the ticked "Coffee" is already in the cart by its stored text, and "Zitrone" is added to Probably at home in German (#52 3b, changed by #61)', () => {
      const plan = { ...withAdded(notAccepted, 'Coffee'), ticked: [addedKey('Coffee')] };
      expect(addFeedback(plan, '   ')).toBeNull();

      expect(addFeedback(plan, ' coffee ')).toEqual({
        id: 'groceries.alreadyInCart',
        params: { item: 'Coffee' },
      });
      expect(addFeedback(notAccepted, 'Zitrone', 'de')).toEqual({
        id: 'groceries.added',
        params: { item: 'Zitrone', section: 'Probably at home' },
      });
    });
  });

  describe('addedSection', () => {
    it('puts "Zitrone" under Probably at home and "käse" under Other in German, "lemon" still under Probably at home in German, and "Zitrone" under Other in English (changed by #61)', () => {
      expect(addedSection('Zitrone', 'de')).toBe('Probably at home');
      expect(addedSection('käse', 'de')).toBe('Other');
      expect(addedSection('lemon', 'de')).toBe('Probably at home');
      expect(addedSection('Zitrone', 'en')).toBe('Other');
    });

    describe('edge cases', () => {
      it('puts the German names "Knoblauchzehe", "rote Zwiebel", "Bratwürste" and "Dosentomaten" under Other in English, and under their sections in German, "Knoblauchzehe" under Probably at home (changed by #61)', () => {
        for (const [name, section] of [
          ['Knoblauchzehe', 'Probably at home'],
          ['rote Zwiebel', 'Fruit & vegetables'],
          ['Bratwürste', 'Meat & fish'],
          ['Dosentomaten', 'Cans & jars'],
        ] as const) {
          expect(addedSection(name, 'en'), `${name} in English`).toBe('Other');
          expect(addedSection(name, 'de'), `${name} in German`).toBe(section);
        }
      });

      it('puts the English names "garlic clove", "canned tomatoes" and "bratwurst" under the same sections in German as their German names', () => {
        for (const [english, germanName] of [
          ['garlic clove', 'Knoblauchzehe'],
          ['canned tomatoes', 'Dosentomaten'],
          ['bratwurst', 'Bratwürste'],
        ]) {
          expect(addedSection(english, 'de'), english).toBe(addedSection(english, 'en'));
          expect(addedSection(germanName, 'de'), germanName).toBe(addedSection(english, 'en'));
        }
      });

      it('ignores case in German, putting "ZITRONE" and "LEMON" under Probably at home and "Rote zwiebel" under Fruit & vegetables (changed by #61)', () => {
        for (const name of ['ZITRONE', 'LEMON']) {
          expect(addedSection(name, 'de'), name).toBe('Probably at home');
        }
        expect(addedSection('Rote zwiebel', 'de')).toBe('Fruit & vegetables');
      });

      it('puts "Zwiebel" under Probably at home in German, but the inflected "Zwiebeln" and "Zitronen" under Other, as only a whole German name counts (changed by #61)', () => {
        expect(addedSection('Zwiebel', 'de')).toBe('Probably at home');
        expect(addedSection('Zwiebeln', 'de')).toBe('Other');
        expect(addedSection('Zitronen', 'de')).toBe('Other');
      });
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

  describe('byShownName', () => {
    it('sorts by the shown name in the given locale, e.g. "Römersalat" with the o in German, while the items keep their names', () => {
      const shown = new Map([
        ['romaine lettuce', 'Römersalat'],
        ['red cabbage', 'Rotkohl'],
        ['avocado', 'Avocado'],
      ]);
      const romaine = item('romaine lettuce', 1, 'pc');
      const cabbage = item('red cabbage', 1, 'pc');
      const avocado = item('avocado', 1, 'pc');
      const typed = added('Zitrone', 'Fruit & vegetables');
      const order = byShownName((line) => shown.get(line.name) ?? line.name, 'de');
      expect([typed, cabbage, romaine, avocado].sort(order)).toEqual([
        avocado,
        romaine,
        cabbage,
        typed,
      ]);
    });

    it("puts the plan's line before an added item of the same shown name, and orders by unit next", () => {
      const order = byShownName((line) => line.name.toUpperCase(), 'de');
      const typed = added('Ei', 'Dairy & eggs');
      const pieces = item('ei', 2, 'pc');
      const grams = item('ei', 100, 'g');
      expect([typed, pieces, grams].sort(order)).toEqual([grams, pieces, typed]);
    });
  });

  describe('shoppingView with an order', () => {
    it('sorts the sections and the cart by the order it is given, keeping each item in its section, onion and garlic clove under "Probably at home" (changed by #61)', () => {
      const onion = item('onion', 1, 'pc');
      const garlic = item('garlic clove', 2, 'pc');
      const tomato = item('tomato', 3, 'pc');
      const shown = new Map([
        ['onion', 'Zwiebel'],
        ['garlic clove', 'Knoblauchzehe'],
        ['tomato', 'Tomate'],
      ]);
      const order = byShownName((line) => shown.get(line.name) ?? line.name, 'de');
      expect(shoppingView([onion, garlic, tomato], [], order).sections).toEqual([
        { section: 'Probably at home', items: [garlic, onion] },
        { section: 'Fruit & vegetables', items: [tomato] },
      ]);
      expect(shoppingView([onion, garlic, tomato], [onion, tomato].map(itemKey), order)).toEqual({
        sections: [{ section: 'Probably at home', items: [garlic] }],
        inCart: [tomato, onion],
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

    it('gives an added item the key addedKey makes, which no plan item of that name has, so the two are ticked separately (changed by #61)', () => {
      const planOnion = item('onion', 1, 'pc');
      const addedOnion = added('onion', 'Probably at home');
      expect(itemKey(addedOnion)).toBe(addedKey('onion'));
      expect(itemKey(addedOnion)).not.toBe(itemKey(planOnion));
      expect(itemKey(addedOnion)).not.toBe(itemKey(item('onion', 1, 'g')));

      const list = [planOnion, addedOnion];
      expect(shoppingView(list, [itemKey(planOnion)])).toEqual({
        sections: [{ section: 'Probably at home', items: [addedOnion] }],
        inCart: [planOnion],
      });
      expect(shoppingView(list, [itemKey(addedOnion)])).toEqual({
        sections: [{ section: 'Probably at home', items: [planOnion] }],
        inCart: [addedOnion],
      });
    });
  });

  describe('"Probably at home" (#61)', () => {
    const HUMMUS_AND_CURRY = day(
      '2026-10-24',
      picked('Hummus plate with bread and vegetables'),
      picked('Chicken curry with rice'),
    );
    const AT_HOME_LINES = [
      '2 tsp curry powder',
      '2 pc garlic clove',
      '1 pc lemon',
      '1 pc onion',
      '1 tsp paprika',
      '150 g rice',
    ];

    it('groups the lines of "Hummus plate with bread and vegetables" and "Chicken curry with rice" for 2 under Probably at home first, then Fruit & vegetables, Meat & fish, Bread & bakery and Cans & jars, with no Pasta, rice & grains or Spices & sauces; puts the added "Lemon" and "rice" of a plan not accepted under Probably at home and "tea" under Other, the added "Zitrone" under Probably at home in German, and says "rice" is added to Probably at home (#61 2)', () => {
      const plan = acceptedPlanFor(2, HUMMUS_AND_CURRY);
      expect(shownBySection(shoppingView(listItems(plan, BUILT_IN_RECIPES), []))).toEqual([
        ['Probably at home', AT_HOME_LINES],
        [
          'Fruit & vegetables',
          ['2 pc carrot', '150 g cherry tomato', '1 pc cucumber', '10 g ginger'],
        ],
        ['Meat & fish', ['300 g chicken breast']],
        ['Bread & bakery', ['200 g bread']],
        ['Cans & jars', ['200 g canned tomatoes', '200 ml coconut milk', '200 g hummus']],
      ]);

      const notAccepted = withAdded(planFor(2, HUMMUS_AND_CURRY), 'rice', 'Lemon', 'tea');
      expect(shoppingView(listItems(notAccepted, BUILT_IN_RECIPES), []).sections).toEqual([
        {
          section: 'Probably at home',
          items: [added('Lemon', 'Probably at home'), added('rice', 'Probably at home')],
        },
        { section: 'Other', items: [added('tea', 'Other')] },
      ]);

      const german = withAdded(planFor(2, HUMMUS_AND_CURRY), 'Zitrone');
      expect(shoppingView(listItems(german, BUILT_IN_RECIPES, 'de'), []).sections).toEqual([
        { section: 'Probably at home', items: [added('Zitrone', 'Probably at home')] },
      ]);

      expect(addFeedback(plan, 'rice')).toEqual({
        id: 'groceries.added',
        params: { item: 'rice', section: 'Probably at home' },
      });
    });

    describe('edge cases', () => {
      it('lists none of the lemon, onion, garlic clove, rice, paprika and curry powder under a shop section as well, and each of the 15 lines once (#61 2a)', () => {
        const plan = acceptedPlanFor(2, HUMMUS_AND_CURRY);
        const { sections } = shoppingView(listItems(plan, BUILT_IN_RECIPES), []);
        const atHome = ['lemon', 'onion', 'garlic clove', 'rice', 'paprika', 'curry powder'];
        expect(sections[0]?.section, 'first section').toBe('Probably at home');
        expect(
          sections
            .slice(1)
            .flatMap(({ items }) => items)
            .filter((line) => atHome.includes(line.name)),
        ).toEqual([]);
        expect(sections.flatMap(({ items }) => items)).toHaveLength(15);
      });

      it('moves the ticked "1 pc lemon" out of Probably at home into the cart, not into Fruit & vegetables, and counts it as 1 of 15 in the cart (#61 2b)', () => {
        const plan = {
          ...acceptedPlanFor(2, HUMMUS_AND_CURRY),
          ticked: [itemKey(item('lemon', 1, 'pc'))],
        };
        const view = shoppingView(listItems(plan, BUILT_IN_RECIPES), plan.ticked);
        expect(view.inCart).toEqual([item('lemon', 1, 'pc', 'Probably at home')]);
        expect(shownBySection(view).slice(0, 2)).toEqual([
          ['Probably at home', AT_HOME_LINES.filter((line) => line !== '1 pc lemon')],
          [
            'Fruit & vegetables',
            ['2 pc carrot', '150 g cherry tomato', '1 pc cucumber', '10 g ginger'],
          ],
        ]);
        expect(cartCount(plan, BUILT_IN_RECIPES)).toEqual({ inCart: 1, total: 15 });
      });

      it('lists the plan\'s "1 pc lemon" and then the added "lemon" as separate lines under Probably at home (#61 2c)', () => {
        const plan = withAdded(acceptedPlanFor(2, HUMMUS_AND_CURRY), 'lemon');
        const [first] = shoppingView(listItems(plan, BUILT_IN_RECIPES), []).sections;
        expect(first).toEqual({
          section: 'Probably at home',
          items: [
            item('curry powder', 2, 'tsp'),
            item('garlic clove', 2, 'pc'),
            item('lemon', 1, 'pc'),
            added('lemon', 'Probably at home'),
            item('onion', 1, 'pc'),
            item('paprika', 1, 'tsp'),
            item('rice', 150, 'g'),
          ],
        });
      });

      it('shows no Probably at home section for lines without one of the 29, and one holding only the added "rice", first, once it is added (#61 2d)', () => {
        const plan = acceptedPlanFor(2, day('2026-10-24', picked('Spaghetti'), picked('Market')));
        const sectionsOf = (shown: Plan) =>
          shoppingView(listItems(shown, RECIPES), []).sections.map(({ section }) => section);
        expect(sectionsOf(plan)).toEqual([
          'Fruit & vegetables',
          'Meat & fish',
          'Dairy & eggs',
          'Pasta, rice & grains',
          'Other',
        ]);

        const withRice = withAdded(plan, 'rice');
        expect(sectionsOf(withRice)).toEqual([
          'Probably at home',
          'Fruit & vegetables',
          'Meat & fish',
          'Dairy & eggs',
          'Pasta, rice & grains',
          'Other',
        ]);
        expect(shoppingView(listItems(withRice, RECIPES), []).sections[0].items).toEqual([
          added('rice', 'Probably at home'),
        ]);
      });
    });
  });

  function acceptedPlanFor(people: number, ...days: PlanDay[]): Plan {
    return { ...planFor(people, ...days), accepted: true };
  }

  function planFor(people: number, ...days: PlanDay[]): Plan {
    return { days, people, accepted: false, ticked: [], added: [], shown: [], kidFriendly: false };
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

  function shownBySection({ sections }: ShoppingView): [Section, string[]][] {
    return sections.map(({ section, items }) => [
      section,
      items.map((line) =>
        'added' in line ? line.name : `${line.amount} ${line.unit} ${line.name}`,
      ),
    ]);
  }

  function linesOf(list: GroceryItem[], name: string): GroceryItem[] {
    return list.filter((line) => line.name === name);
  }

  // Only the sorting test checks the order of the lines
  function sorted(list: GroceryItem[]): GroceryItem[] {
    return [...list].sort(byName);
  }
});
