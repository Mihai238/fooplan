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
  });

  describe('addedItems', () => {
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

    it('says an entry is added under its section, already on the list or already in the cart, and nothing for a blank entry (changed by #52)', () => {
      expect(addFeedback(plan, 'tea')).toEqual({
        id: 'groceries.added',
        params: { item: 'tea', section: 'Other' },
      });
      expect(addFeedback(plan, ' Lemon ')).toEqual({
        id: 'groceries.added',
        params: { item: 'Lemon', section: 'Fruit & vegetables' },
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

    it('says "Added" for an entry named like a plan line, which is not an added item', () => {
      expect(groceryList(plan, RECIPES), 'onion line').toContainEqual(onion);
      expect(addFeedback(plan, 'onion')).toEqual({
        id: 'groceries.added',
        params: { item: 'onion', section: 'Fruit & vegetables' },
      });
      expect(addFeedback(plan, 'Onion')).toEqual({
        id: 'groceries.added',
        params: { item: 'Onion', section: 'Fruit & vegetables' },
      });
    });

    it('never says "already in the cart" because a plan line of that name is ticked, as only added items count', () => {
      const onionTicked = { ...plan, ticked: [itemKey(onion)] };
      expect(addFeedback(onionTicked, 'onion')).toEqual({
        id: 'groceries.added',
        params: { item: 'onion', section: 'Fruit & vegetables' },
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

    it('lists only the added "toilet paper" under Other and "Lemon" under Fruit & vegetables for a plan that is not accepted, and says "toilet paper" is already on the list and "tea" is added to Other (#52 3)', () => {
      const plan = withAdded(notAccepted, 'toilet paper', 'Lemon');
      expect(listItems(plan, RECIPES)).toEqual([
        added('toilet paper', 'Other'),
        added('Lemon', 'Fruit & vegetables'),
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

    it('returns no message for a blank entry on a plan that is not accepted, says the ticked "Coffee" is already in the cart by its stored text, and "Zitrone" is added to Fruit & vegetables in German (#52 3b)', () => {
      const plan = { ...withAdded(notAccepted, 'Coffee'), ticked: [addedKey('Coffee')] };
      expect(addFeedback(plan, '   ')).toBeNull();

      expect(addFeedback(plan, ' coffee ')).toEqual({
        id: 'groceries.alreadyInCart',
        params: { item: 'Coffee' },
      });
      expect(addFeedback(notAccepted, 'Zitrone', 'de')).toEqual({
        id: 'groceries.added',
        params: { item: 'Zitrone', section: 'Fruit & vegetables' },
      });
    });
  });

  describe('addedSection', () => {
    it('puts "Zitrone" under Fruit & vegetables and "käse" under Other in German, "lemon" still under Fruit & vegetables in German, and "Zitrone" under Other in English', () => {
      expect(addedSection('Zitrone', 'de')).toBe('Fruit & vegetables');
      expect(addedSection('käse', 'de')).toBe('Other');
      expect(addedSection('lemon', 'de')).toBe('Fruit & vegetables');
      expect(addedSection('Zitrone', 'en')).toBe('Other');
    });

    describe('edge cases', () => {
      it('puts the German names "Knoblauchzehe", "rote Zwiebel", "Bratwürste" and "Dosentomaten" under Other in English, and under their sections in German', () => {
        for (const [name, section] of [
          ['Knoblauchzehe', 'Fruit & vegetables'],
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

      it('ignores case in German, putting "ZITRONE", "Rote zwiebel" and "LEMON" under Fruit & vegetables', () => {
        for (const name of ['ZITRONE', 'Rote zwiebel', 'LEMON']) {
          expect(addedSection(name, 'de'), name).toBe('Fruit & vegetables');
        }
      });

      it('puts "Zwiebel" under Fruit & vegetables in German, but the inflected "Zwiebeln" and "Zitronen" under Other, as only a whole German name counts', () => {
        expect(addedSection('Zwiebel', 'de')).toBe('Fruit & vegetables');
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
    it('sorts the sections and the cart by the order it is given, keeping each item in its section', () => {
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
        { section: 'Fruit & vegetables', items: [garlic, tomato, onion] },
      ]);
      expect(shoppingView([onion, garlic, tomato], [onion, tomato].map(itemKey), order)).toEqual({
        sections: [{ section: 'Fruit & vegetables', items: [garlic] }],
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

  function linesOf(list: GroceryItem[], name: string): GroceryItem[] {
    return list.filter((line) => line.name === name);
  }

  // Only the sorting test checks the order of the lines
  function sorted(list: GroceryItem[]): GroceryItem[] {
    return [...list].sort(byName);
  }
});
