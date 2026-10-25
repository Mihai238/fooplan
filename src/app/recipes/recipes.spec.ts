import { MIN_SUGGESTED } from '../plan/plan';
import { isKidFriendly } from './kid-friendly';
import { Recipe, UNITS, Unit } from './recipe';
import { RECIPES } from './recipes';

const SPEC_NAMES = [
  'Spaghetti pomodoro',
  'Spaghetti carbonara',
  'Pesto pasta with cherry tomatoes',
  'Beef burgers with oven fries',
  'Chicken curry with rice',
  'Teriyaki chicken with rice',
  'Chicken fajitas',
  'Chicken Caesar salad',
  'Oven-baked salmon with potatoes and green beans',
  'Fish tacos',
  'Chickpea and spinach curry',
  'Vegetable stir-fry with noodles',
  'Shakshuka with bread',
  'Couscous salad with halloumi',
  'Greek salad with feta and bread',
  'Penne arrabbiata',
  'Spaghetti aglio e olio',
  'Mac and cheese',
  'Gnocchi with tomato sauce and mozzarella',
  'Beef stroganoff with rice',
  'Bratwurst with sauerkraut and mashed potatoes',
  'Chicken quesadillas',
  'Pad thai with chicken',
  'Tuna pasta bake',
  'Thai green curry with prawns',
  'Bean burritos',
  'Potato goulash',
  'Sweet potato and black bean chili',
  'Niçoise salad',
  'Hummus plate with bread and vegetables',
  'Avocado toast with fried egg',
  'Caprese salad with bread',
  'Spinach and feta omelette',
  'Tuna and white bean salad with bread',
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

const SPEC_TIMES: Record<string, { minutes: number; workMinutes: number }> = {
  'Spaghetti pomodoro': { minutes: 25, workMinutes: 15 },
  'Spaghetti carbonara': { minutes: 20, workMinutes: 20 },
  'Pesto pasta with cherry tomatoes': { minutes: 20, workMinutes: 15 },
  'Beef burgers with oven fries': { minutes: 45, workMinutes: 25 },
  'Chicken curry with rice': { minutes: 40, workMinutes: 25 },
  'Teriyaki chicken with rice': { minutes: 30, workMinutes: 25 },
  'Chicken fajitas': { minutes: 30, workMinutes: 25 },
  'Chicken Caesar salad': { minutes: 25, workMinutes: 25 },
  'Oven-baked salmon with potatoes and green beans': { minutes: 45, workMinutes: 15 },
  'Fish tacos': { minutes: 30, workMinutes: 30 },
  'Chickpea and spinach curry': { minutes: 30, workMinutes: 20 },
  'Vegetable stir-fry with noodles': { minutes: 25, workMinutes: 20 },
  'Shakshuka with bread': { minutes: 30, workMinutes: 15 },
  'Couscous salad with halloumi': { minutes: 25, workMinutes: 25 },
  'Greek salad with feta and bread': { minutes: 15, workMinutes: 15 },
  'Penne arrabbiata': { minutes: 25, workMinutes: 15 },
  'Spaghetti aglio e olio': { minutes: 15, workMinutes: 15 },
  'Mac and cheese': { minutes: 35, workMinutes: 15 },
  'Gnocchi with tomato sauce and mozzarella': { minutes: 30, workMinutes: 15 },
  'Beef stroganoff with rice': { minutes: 35, workMinutes: 30 },
  'Bratwurst with sauerkraut and mashed potatoes': { minutes: 40, workMinutes: 20 },
  'Chicken quesadillas': { minutes: 25, workMinutes: 20 },
  'Pad thai with chicken': { minutes: 30, workMinutes: 20 },
  'Tuna pasta bake': { minutes: 45, workMinutes: 20 },
  'Thai green curry with prawns': { minutes: 30, workMinutes: 25 },
  'Bean burritos': { minutes: 35, workMinutes: 25 },
  'Potato goulash': { minutes: 45, workMinutes: 20 },
  'Sweet potato and black bean chili': { minutes: 45, workMinutes: 20 },
  'Niçoise salad': { minutes: 30, workMinutes: 15 },
  'Hummus plate with bread and vegetables': { minutes: 10, workMinutes: 10 },
  'Avocado toast with fried egg': { minutes: 15, workMinutes: 15 },
  'Caprese salad with bread': { minutes: 10, workMinutes: 10 },
  'Spinach and feta omelette': { minutes: 15, workMinutes: 15 },
  'Tuna and white bean salad with bread': { minutes: 10, workMinutes: 5 },
  'Chicken schnitzel with cucumber salad': { minutes: 25, workMinutes: 25 },
  'Fish fingers with mashed potatoes and peas': { minutes: 35, workMinutes: 25 },
  'Spaghetti with zucchini and parmesan': { minutes: 25, workMinutes: 20 },
  'Chicken and rice with carrots and peas': { minutes: 35, workMinutes: 15 },
  'Pizza toast': { minutes: 15, workMinutes: 10 },
  'Potato pancakes with sour cream': { minutes: 35, workMinutes: 30 },
  'Spaghetti with meatballs': { minutes: 40, workMinutes: 25 },
  'Creamy salmon pasta with spinach': { minutes: 25, workMinutes: 20 },
  'Chicken and vegetable skewers with rice': { minutes: 35, workMinutes: 25 },
  'Pasta with broccoli and parmesan': { minutes: 20, workMinutes: 15 },
};

// #29's data, so a changed amount or a typo in a step fails, not just a broken rule
const EASY_RECIPES: Recipe[] = [
  {
    name: 'Hummus plate with bread and vegetables',
    servings: 2,
    minutes: 10,
    workMinutes: 10,
    ingredients: [
      { name: 'hummus', amount: 200, unit: 'g' },
      { name: 'bread', amount: 200, unit: 'g' },
      { name: 'cucumber', amount: 1, unit: 'pc' },
      { name: 'carrot', amount: 2, unit: 'pc' },
      { name: 'cherry tomato', amount: 150, unit: 'g' },
      { name: 'lemon', amount: 0.5, unit: 'pc' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'paprika', amount: 1, unit: 'tsp' },
    ],
    steps: [
      'Cut the cucumber and the carrots into sticks and halve the cherry tomatoes.',
      'Spread the hummus in a shallow bowl, squeeze the lemon over it, drizzle it with the olive oil and sprinkle it with the paprika.',
      'Toast the bread slices in a dry pan over medium heat, about 1 minute per side.',
      'Serve the hummus with the bread and the vegetables for dipping.',
    ],
  },
  {
    name: 'Avocado toast with fried egg',
    servings: 2,
    minutes: 15,
    workMinutes: 15,
    ingredients: [
      { name: 'bread', amount: 150, unit: 'g' },
      { name: 'avocado', amount: 1, unit: 'pc' },
      { name: 'lemon', amount: 0.5, unit: 'pc' },
      { name: 'egg', amount: 2, unit: 'pc' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'chili flakes', amount: 0.5, unit: 'tsp' },
    ],
    steps: [
      'Toast the bread slices in a toaster or a dry pan until golden.',
      'Halve the avocado, scoop out the flesh and mash it with the juice of the lemon, salt and pepper.',
      'Heat the olive oil in a pan over medium heat and fry the eggs for 3 to 4 minutes until the whites are set and the yolks still soft.',
      'Spread the avocado on the toast, top each slice with a fried egg and sprinkle with the chili flakes.',
    ],
  },
  {
    name: 'Caprese salad with bread',
    servings: 2,
    minutes: 10,
    workMinutes: 10,
    ingredients: [
      { name: 'tomato', amount: 4, unit: 'pc' },
      { name: 'mozzarella', amount: 250, unit: 'g' },
      { name: 'basil', amount: 15, unit: 'g' },
      { name: 'olive oil', amount: 3, unit: 'tbsp' },
      { name: 'bread', amount: 200, unit: 'g' },
    ],
    steps: [
      'Slice the tomatoes and the mozzarella into rounds about 1 cm thick.',
      'Arrange them on a plate in alternating, overlapping slices and tuck the basil leaves in between.',
      'Season with salt and pepper and drizzle the olive oil over the salad.',
      'Slice the bread and serve it with the salad.',
    ],
  },
  {
    name: 'Spinach and feta omelette',
    servings: 2,
    minutes: 15,
    workMinutes: 15,
    ingredients: [
      { name: 'egg', amount: 4, unit: 'pc' },
      { name: 'spinach', amount: 100, unit: 'g' },
      { name: 'feta', amount: 100, unit: 'g' },
      { name: 'spring onion', amount: 2, unit: 'pc' },
      { name: 'butter', amount: 20, unit: 'g' },
    ],
    steps: [
      'Rinse the spinach and slice the spring onions finely.',
      'Whisk the eggs with salt and pepper and crumble the feta.',
      'Melt the butter in a non-stick pan over medium heat and cook the spring onions and the spinach for 2 minutes until the spinach wilts.',
      'Pour in the eggs, scatter the feta over them and cook for 3 to 4 minutes until the omelette is set at the edges but still soft on top.',
      'Fold the omelette in half, cut it in two and serve.',
    ],
  },
  {
    name: 'Tuna and white bean salad with bread',
    servings: 2,
    minutes: 10,
    workMinutes: 5,
    ingredients: [
      { name: 'canned white beans', amount: 400, unit: 'g' },
      { name: 'canned tuna', amount: 150, unit: 'g' },
      { name: 'red onion', amount: 0.5, unit: 'pc' },
      { name: 'parsley', amount: 10, unit: 'g' },
      { name: 'lemon', amount: 1, unit: 'pc' },
      { name: 'olive oil', amount: 3, unit: 'tbsp' },
      { name: 'bread', amount: 200, unit: 'g' },
    ],
    steps: [
      'Drain and rinse the canned white beans and drain the canned tuna.',
      'Slice the red onion into thin half-rings and chop the parsley.',
      'Mix the beans, the tuna, the red onion and the parsley in a bowl with the juice of the lemon, the olive oil, salt and pepper.',
      'Let the salad stand for 5 minutes, then slice the bread and serve it alongside.',
    ],
  },
];

// #32's data, checked the same way
const FAMILY_RECIPES: Recipe[] = [
  {
    name: 'Chicken schnitzel with cucumber salad',
    servings: 2,
    minutes: 25,
    workMinutes: 25,
    ingredients: [
      { name: 'chicken breast', amount: 300, unit: 'g' },
      { name: 'flour', amount: 50, unit: 'g' },
      { name: 'egg', amount: 1, unit: 'pc' },
      { name: 'breadcrumbs', amount: 80, unit: 'g' },
      { name: 'vegetable oil', amount: 60, unit: 'ml' },
      { name: 'lemon', amount: 1, unit: 'pc' },
      { name: 'cucumber', amount: 1, unit: 'pc' },
      { name: 'sour cream', amount: 100, unit: 'g' },
      { name: 'dill', amount: 10, unit: 'g' },
    ],
    steps: [
      'Slice the cucumber thinly, chop the dill and mix both with the sour cream, salt and pepper for the salad.',
      'Halve the chicken breast lengthwise and flatten each half to about 1 cm with a rolling pin.',
      'Season the chicken with salt and pepper, then coat it in the flour, the beaten egg and the breadcrumbs in turn.',
      'Heat the vegetable oil in a large pan over medium-high heat and fry the schnitzels for 3 to 4 minutes per side until golden.',
      'Serve with the cucumber salad and a wedge of the lemon to squeeze over.',
    ],
  },
  {
    name: 'Fish fingers with mashed potatoes and peas',
    servings: 2,
    minutes: 35,
    workMinutes: 25,
    ingredients: [
      { name: 'potato', amount: 600, unit: 'g' },
      { name: 'milk', amount: 100, unit: 'ml' },
      { name: 'butter', amount: 30, unit: 'g' },
      { name: 'cod', amount: 400, unit: 'g' },
      { name: 'flour', amount: 50, unit: 'g' },
      { name: 'egg', amount: 1, unit: 'pc' },
      { name: 'breadcrumbs', amount: 80, unit: 'g' },
      { name: 'vegetable oil', amount: 60, unit: 'ml' },
      { name: 'pea', amount: 200, unit: 'g' },
    ],
    steps: [
      'Peel the potatoes, cut them into chunks and boil them in salted water for 20 minutes until soft.',
      'Meanwhile cut the cod into finger-sized strips and coat them in the flour, the beaten egg and the breadcrumbs in turn.',
      'Heat the vegetable oil in a large pan over medium heat and fry the fish fingers for 2 to 3 minutes per side until golden and cooked through.',
      'Cook the peas in boiling water for 3 minutes and drain them.',
      'Drain the potatoes, mash them with the milk and the butter, season with salt and serve with the fish fingers and the peas.',
    ],
  },
  {
    name: 'Spaghetti with zucchini and parmesan',
    servings: 2,
    minutes: 25,
    workMinutes: 20,
    ingredients: [
      { name: 'spaghetti', amount: 200, unit: 'g' },
      { name: 'zucchini', amount: 2, unit: 'pc' },
      { name: 'garlic clove', amount: 1, unit: 'pc' },
      { name: 'olive oil', amount: 3, unit: 'tbsp' },
      { name: 'parmesan', amount: 50, unit: 'g' },
      { name: 'basil', amount: 10, unit: 'g' },
    ],
    steps: [
      'Bring a large pot of salted water to the boil and cook the spaghetti until al dente, about 9 minutes.',
      'Meanwhile slice the zucchini into thin rounds and finely chop the garlic clove.',
      'Heat the olive oil in a large pan over medium-high heat and fry the zucchini for 6 to 8 minutes until golden, adding the garlic for the last minute.',
      'Scoop out a cup of the pasta water, drain the spaghetti and toss it in the pan with half of the grated parmesan and a splash of the pasta water.',
      'Tear the basil over the pasta, season with salt and pepper and serve with the rest of the parmesan.',
    ],
  },
  {
    name: 'Chicken and rice with carrots and peas',
    servings: 2,
    minutes: 35,
    workMinutes: 15,
    ingredients: [
      { name: 'chicken thigh', amount: 400, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pc' },
      { name: 'carrot', amount: 2, unit: 'pc' },
      { name: 'rice', amount: 200, unit: 'g' },
      { name: 'vegetable stock', amount: 500, unit: 'ml' },
      { name: 'pea', amount: 150, unit: 'g' },
      { name: 'vegetable oil', amount: 30, unit: 'ml' },
      { name: 'paprika', amount: 1, unit: 'tsp' },
    ],
    steps: [
      'Cut the chicken thighs into bite-sized pieces, dice the onion and the carrots.',
      'Heat the vegetable oil in a wide pot over medium-high heat and brown the chicken for 4 minutes, then add the onion and the carrots and cook for 3 more minutes.',
      'Stir in the rice and the paprika, pour in the vegetable stock, season with salt and bring to the boil.',
      'Cover, turn the heat to low and simmer for 15 minutes until the rice has absorbed the stock.',
      'Stir in the peas, cover again for 3 minutes and serve.',
    ],
  },
  {
    name: 'Pizza toast',
    servings: 2,
    minutes: 15,
    workMinutes: 10,
    ingredients: [
      { name: 'bread', amount: 200, unit: 'g' },
      { name: 'tomato paste', amount: 3, unit: 'tbsp' },
      { name: 'oregano', amount: 1, unit: 'tsp' },
      { name: 'mozzarella', amount: 150, unit: 'g' },
      { name: 'cherry tomato', amount: 100, unit: 'g' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
    ],
    steps: [
      'Heat the oven to 220 °C and lay the bread slices on a baking tray.',
      'Spread the tomato paste thinly over the bread and sprinkle it with the oregano.',
      'Tear the mozzarella over the slices, halve the cherry tomatoes and scatter them on top, then drizzle with the olive oil.',
      'Bake for 8 to 10 minutes until the cheese bubbles and the edges are crisp, and serve hot.',
    ],
  },
  {
    name: 'Potato pancakes with sour cream',
    servings: 2,
    minutes: 35,
    workMinutes: 30,
    ingredients: [
      { name: 'potato', amount: 600, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'pc' },
      { name: 'egg', amount: 1, unit: 'pc' },
      { name: 'flour', amount: 40, unit: 'g' },
      { name: 'vegetable oil', amount: 90, unit: 'ml' },
      { name: 'sour cream', amount: 150, unit: 'g' },
      { name: 'chive', amount: 10, unit: 'g' },
    ],
    steps: [
      'Peel and coarsely grate the potatoes and the onion, then squeeze the mixture in a clean towel to wring out the liquid.',
      'Mix the potatoes and the onion with the egg, the flour, salt and pepper.',
      'Heat a third of the vegetable oil in a large pan over medium-high heat, drop in heaped spoonfuls of the mixture, flatten them and fry for 3 to 4 minutes per side until golden and crisp.',
      'Fry the rest in two more batches with the remaining vegetable oil, keeping the done pancakes warm.',
      'Chop the chives, stir them into the sour cream and serve it with the pancakes.',
    ],
  },
  {
    name: 'Spaghetti with meatballs',
    servings: 2,
    minutes: 40,
    workMinutes: 25,
    ingredients: [
      { name: 'ground beef', amount: 300, unit: 'g' },
      { name: 'breadcrumbs', amount: 40, unit: 'g' },
      { name: 'egg', amount: 1, unit: 'pc' },
      { name: 'onion', amount: 1, unit: 'pc' },
      { name: 'garlic clove', amount: 1, unit: 'pc' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
      { name: 'canned tomatoes', amount: 400, unit: 'g' },
      { name: 'spaghetti', amount: 200, unit: 'g' },
      { name: 'parmesan', amount: 30, unit: 'g' },
    ],
    steps: [
      'Finely dice the onion and chop the garlic clove.',
      'Mix the ground beef with the breadcrumbs, the egg, half of the onion, salt and pepper, and roll it into 12 meatballs.',
      'Heat the olive oil in a wide pan over medium-high heat and brown the meatballs on all sides for 5 minutes, then take them out.',
      'Fry the rest of the onion and the garlic in the pan for 2 minutes, add the canned tomatoes, season with salt and pepper, return the meatballs and simmer for 15 minutes.',
      'Meanwhile cook the spaghetti in salted boiling water until al dente, about 9 minutes, and drain it.',
      'Serve the spaghetti with the meatballs and their sauce, with the parmesan grated over.',
    ],
  },
  {
    name: 'Creamy salmon pasta with spinach',
    servings: 2,
    minutes: 25,
    workMinutes: 20,
    ingredients: [
      { name: 'penne', amount: 200, unit: 'g' },
      { name: 'salmon', amount: 300, unit: 'g' },
      { name: 'garlic clove', amount: 1, unit: 'pc' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'cream', amount: 200, unit: 'ml' },
      { name: 'spinach', amount: 100, unit: 'g' },
      { name: 'lemon', amount: 0.5, unit: 'pc' },
      { name: 'parmesan', amount: 30, unit: 'g' },
    ],
    steps: [
      'Bring a large pot of salted water to the boil and cook the penne until al dente, about 11 minutes.',
      'Meanwhile cut the salmon into 2 cm cubes and chop the garlic clove.',
      'Heat the olive oil in a large pan over medium heat and fry the salmon for 3 minutes, turning it once, then add the garlic for 30 seconds.',
      'Pour in the cream, add the spinach and let it wilt for 2 minutes, then season with salt, pepper and the juice of the lemon.',
      'Drain the penne, toss it in the sauce and serve with the parmesan grated over.',
    ],
  },
  {
    name: 'Chicken and vegetable skewers with rice',
    servings: 2,
    minutes: 35,
    workMinutes: 25,
    ingredients: [
      { name: 'chicken breast', amount: 300, unit: 'g' },
      { name: 'bell pepper', amount: 1, unit: 'pc' },
      { name: 'zucchini', amount: 1, unit: 'pc' },
      { name: 'red onion', amount: 1, unit: 'pc' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
      { name: 'paprika', amount: 1, unit: 'tsp' },
      { name: 'lemon', amount: 1, unit: 'pc' },
      { name: 'rice', amount: 200, unit: 'g' },
    ],
    steps: [
      'Cook the rice in salted water according to its packet, about 15 minutes, and keep it warm.',
      'Cut the chicken breast, the bell pepper, the zucchini and the red onion into 3 cm pieces.',
      'Toss them with the olive oil, the paprika, the juice of half the lemon, salt and pepper, and thread them onto skewers, alternating chicken and vegetables.',
      'Grill the skewers in a hot grill pan over medium-high heat for 10 to 12 minutes, turning them every 3 minutes, until the chicken is cooked through.',
      'Serve the skewers on the rice with the other half of the lemon cut into wedges.',
    ],
  },
  {
    name: 'Pasta with broccoli and parmesan',
    servings: 2,
    minutes: 20,
    workMinutes: 15,
    ingredients: [
      { name: 'penne', amount: 200, unit: 'g' },
      { name: 'broccoli', amount: 400, unit: 'g' },
      { name: 'garlic clove', amount: 2, unit: 'pc' },
      { name: 'olive oil', amount: 3, unit: 'tbsp' },
      { name: 'butter', amount: 20, unit: 'g' },
      { name: 'parmesan', amount: 50, unit: 'g' },
    ],
    steps: [
      'Bring a large pot of salted water to the boil and cook the penne until al dente, about 11 minutes.',
      'Cut the broccoli into small florets and add them to the pasta water for the last 4 minutes.',
      'Meanwhile slice the garlic cloves and warm them in the olive oil and the butter in a large pan over low heat for 2 minutes without browning.',
      'Scoop out a cup of the pasta water, drain the penne and the broccoli and toss them in the pan with the grated parmesan and a splash of the pasta water until creamy.',
      'Season with salt and pepper and serve.',
    ],
  },
];

const FAMILY_START = SPEC_NAMES.length - FAMILY_RECIPES.length;
const EASY_START = FAMILY_START - EASY_RECIPES.length;

const REMOVED_NAMES = [
  'Lasagne',
  'Chili con carne',
  'Goulash with bread',
  'Stuffed peppers',
  'Schnitzel with potato salad',
  'Fried rice with egg and vegetables',
  'Ratatouille with rice',
  'Spinach and feta quiche',
  'Baked potatoes with herb quark',
  'Minestrone',
  'Spaghetti bolognese',
  'Spinach and ricotta cannelloni',
  'Pizza margherita',
  "Shepherd's pie",
  'Meatballs in tomato sauce with rice',
  'Chicken drumsticks with roasted vegetables',
  'Butter chicken with naan',
  'Chicken noodle soup',
  'Fish and chips',
  'Seafood paella',
  'Falafel wraps with hummus',
  'Eggplant parmigiana',
  'Spanish tortilla with salad',
  'French onion soup',
  'Käsespätzle',
  'Mushroom risotto',
  'Sweet and sour pork with rice',
];

// #31's list, with #29's "Avocado toast with fried egg"
const NOT_KID_FRIENDLY = [
  'Chicken fajitas',
  'Chicken Caesar salad',
  'Penne arrabbiata',
  'Spaghetti aglio e olio',
  'Chicken quesadillas',
  'Pad thai with chicken',
  'Thai green curry with prawns',
  'Bean burritos',
  'Sweet potato and black bean chili',
  'Niçoise salad',
  'Avocado toast with fried egg',
];

// #24's list without "chive" and "cream", which #32's recipes use again
const SOUP_INGREDIENTS = ['leek', 'pumpkin', 'pumpkin seed', 'red lentil'];

describe('RECIPES', () => {
  it('has a unique name, servings > 0 and at least one ingredient with amount > 0 and a known unit per recipe', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    const seenNames = new Set<string>();
    for (const recipe of RECIPES) {
      if (seenNames.has(recipe.name)) problems.push(`"${recipe.name}": duplicate name`);
      seenNames.add(recipe.name);
      if (!(recipe.servings > 0)) problems.push(`"${recipe.name}": servings ${recipe.servings}`);
      if (recipe.ingredients.length === 0) problems.push(`"${recipe.name}": no ingredients`);
      for (const ingredient of recipe.ingredients) {
        if (!(ingredient.amount > 0)) {
          problems.push(`"${recipe.name}" / "${ingredient.name}": amount ${ingredient.amount}`);
        }
        if (!UNITS.includes(ingredient.unit)) {
          problems.push(
            `"${recipe.name}" / "${ingredient.name}": unknown unit "${ingredient.unit}"`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has whole-number servings', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter((recipe) => !Number.isInteger(recipe.servings)).map(
      (recipe) => `"${recipe.name}": servings ${recipe.servings}`,
    );
    expect(problems).toEqual([]);
  });

  it('contains exactly the 44 recipes of the spec table, in its order, each with its minutes and workMinutes', () => {
    expect(Object.keys(SPEC_TIMES), 'recipes in the times table').toEqual(SPEC_NAMES);
    expect(
      RECIPES.map(({ name, minutes, workMinutes }) => ({ name, minutes, workMinutes })),
    ).toEqual(SPEC_NAMES.map((name) => ({ name, ...SPEC_TIMES[name] })));
  });

  it('holds the 5 easy recipes of #29 after the first 29, in their order, each with exactly its servings, minutes, workMinutes, ingredients and steps', () => {
    expect(RECIPES.slice(EASY_START, FAMILY_START)).toEqual(EASY_RECIPES);
  });

  it('holds the 10 family recipes of #32 after the first 34, in their order, each with exactly its servings, minutes, workMinutes, ingredients and steps', () => {
    expect(RECIPES.slice(FAMILY_START)).toEqual(FAMILY_RECIPES);
  });

  it('gives none of the 10 family recipes of #32 the name of one of the 27 recipes the spec removes', () => {
    const family = RECIPES.slice(FAMILY_START).map((recipe) => recipe.name);
    expect(family, 'family recipes loaded').toHaveLength(10);
    expect(family.filter((name) => REMOVED_NAMES.includes(name))).toEqual([]);
  });

  it('uses "broccoli", "chive", "cream", "pea" and "zucchini" as the only ingredient names in the 10 family recipes that the first 34 recipes do not use', () => {
    const known = new Set(
      RECIPES.slice(0, FAMILY_START).flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ingredient.name),
      ),
    );
    const family = RECIPES.slice(FAMILY_START).flatMap((recipe) =>
      recipe.ingredients.map((ingredient) => ingredient.name),
    );
    expect(family.length, 'no family recipes loaded').toBeGreaterThan(0);
    expect([...new Set(family.filter((name) => !known.has(name)))].sort()).toEqual([
      'broccoli',
      'chive',
      'cream',
      'pea',
      'zucchini',
    ]);
  });

  it('has exactly the 11 recipes of #31 and #29 that are not kid-friendly, the other 33 kid-friendly, the 10 of #32 among them, at least MIN_SUGGESTED of them', () => {
    expect(RECIPES.filter((recipe) => !isKidFriendly(recipe)).map((recipe) => recipe.name)).toEqual(
      SPEC_NAMES.filter((name) => NOT_KID_FRIENDLY.includes(name)),
    );
    const kidFriendly = RECIPES.filter(isKidFriendly).map((recipe) => recipe.name);
    expect(kidFriendly).toEqual(SPEC_NAMES.filter((name) => !NOT_KID_FRIENDLY.includes(name)));
    expect(kidFriendly).toHaveLength(33);
    expect(kidFriendly.slice(-10), 'family recipes').toEqual(SPEC_NAMES.slice(FAMILY_START));
    expect(kidFriendly.length).toBeGreaterThanOrEqual(MIN_SUGGESTED);
  });

  it('uses "canned white beans" and "hummus" as the only ingredient names in the 5 easy recipes that the first 29 recipes do not use', () => {
    const known = new Set(
      RECIPES.slice(0, EASY_START).flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ingredient.name),
      ),
    );
    const easy = RECIPES.slice(EASY_START, FAMILY_START).flatMap((recipe) =>
      recipe.ingredients.map((ingredient) => ingredient.name),
    );
    expect(easy.length, 'no easy recipes loaded').toBeGreaterThan(0);
    expect([...new Set(easy.filter((name) => !known.has(name)))].sort()).toEqual([
      'canned white beans',
      'hummus',
    ]);
  });

  it('has workMinutes that are a whole multiple of 5 from 5 up to its minutes and at most 30, and minutes of at most 45, for every recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter(
      (recipe) =>
        !Number.isInteger(recipe.workMinutes) ||
        recipe.workMinutes! % 5 !== 0 ||
        recipe.workMinutes! < 5 ||
        recipe.workMinutes! > recipe.minutes! ||
        recipe.workMinutes! > 30 ||
        recipe.minutes! > 45,
    ).map(
      (recipe) => `"${recipe.name}": workMinutes ${recipe.workMinutes}, minutes ${recipe.minutes}`,
    );
    expect(problems).toEqual([]);
  });

  it('contains none of the 27 recipes the spec removes', () => {
    expectRecipesLoaded();
    expect(
      RECIPES.map((recipe) => recipe.name).filter((name) => REMOVED_NAMES.includes(name)),
    ).toEqual([]);
  });

  it('has no recipe whose name contains "soup"', () => {
    expectRecipesLoaded();
    expect(RECIPES.map((recipe) => recipe.name).filter((name) => /soup/i.test(name))).toEqual([]);
  });

  it('uses none of the 4 ingredients only the soups used in any recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => SOUP_INGREDIENTS.includes(ingredient.name))
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}"`),
    );
    expect(problems).toEqual([]);
  });

  it('has minutes that are a whole multiple of 5 from 10 to 240 for every recipe', () => {
    expectRecipesLoaded();
    const problems = RECIPES.filter(
      (recipe) =>
        !Number.isInteger(recipe.minutes) ||
        recipe.minutes! % 5 !== 0 ||
        recipe.minutes! < 10 ||
        recipe.minutes! > 240,
    ).map((recipe) => `"${recipe.name}": minutes ${recipe.minutes}`);
    expect(problems).toEqual([]);
  });

  it('lists no ingredient name twice within a recipe', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      const seen = new Set<string>();
      for (const ingredient of recipe.ingredients) {
        if (seen.has(ingredient.name)) {
          problems.push(`"${recipe.name}": "${ingredient.name}" twice`);
        }
        seen.add(ingredient.name);
      }
    }
    expect(problems).toEqual([]);
  });

  it('spells ingredient names in lowercase without leading or trailing whitespace', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => ingredient.name !== ingredient.name.trim().toLowerCase())
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}"`),
    );
    expect(problems).toEqual([]);
  });

  it('uses the same unit for an ingredient name in every recipe', () => {
    expectRecipesLoaded();
    const firstUse = new Map<string, { unit: Unit; recipe: string }>();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      for (const ingredient of recipe.ingredients) {
        const first = firstUse.get(ingredient.name);
        if (!first) {
          firstUse.set(ingredient.name, { unit: ingredient.unit, recipe: recipe.name });
        } else if (first.unit !== ingredient.unit) {
          problems.push(
            `"${ingredient.name}": ${first.unit} in "${first.recipe}", ${ingredient.unit} in "${recipe.name}"`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has no ingredient name that is another ingredient name plus "s" or "es"', () => {
    expectRecipesLoaded();
    const names = new Set(
      RECIPES.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)),
    );
    const problems = [...names].flatMap((name) =>
      ['s', 'es']
        .filter((suffix) => names.has(name + suffix))
        .map((suffix) => `"${name}" and "${name + suffix}"`),
    );
    expect(problems).toEqual([]);
  });

  it('stores vegetable oil in ml in every recipe', () => {
    const oils = RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => ingredient.name === 'vegetable oil')
        .map((ingredient) => ({ recipe: recipe.name, unit: ingredient.unit })),
    );
    expect(oils.length, 'no recipe with vegetable oil').toBeGreaterThan(0);
    expect(oils.filter((oil) => oil.unit !== 'ml')).toEqual([]);
  });

  it('has at least three steps per recipe, none of them empty', () => {
    expectRecipesLoaded();
    const problems: string[] = [];
    for (const recipe of RECIPES) {
      const steps = stepsOf(recipe);
      if (steps.length < 3) problems.push(`"${recipe.name}": ${steps.length} steps`);
      steps.forEach((step, index) => {
        if (typeof step !== 'string' || step.trim() === '') {
          problems.push(`"${recipe.name}": step ${index + 1} empty`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it('names every ingredient of a recipe in at least one of its steps', () => {
    expectRecipesLoaded();
    const problems = RECIPES.flatMap((recipe) => {
      const text = stepsOf(recipe).join('\n').toLowerCase();
      return recipe.ingredients
        .filter((ingredient) => !containsWord(text, ingredient.name))
        .map((ingredient) => `"${recipe.name}": "${ingredient.name}" in no step`);
    });
    expect(problems).toEqual([]);
  });

  // Water, salt and pepper, which steps may use, need no exception: the recipe rules keep them off
  // every ingredient list, so they aren't in the catalog
  it('names no ingredient of the catalog that the recipe does not list as a whole word in its steps', () => {
    expectRecipesLoaded();
    const recipesWithoutSteps = RECIPES.filter((recipe) => stepsOf(recipe).length === 0);
    expect(
      recipesWithoutSteps.map((recipe) => recipe.name),
      'recipes without steps pass vacuously',
    ).toEqual([]);
    const catalog = new Set(
      RECIPES.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)),
    );
    const problems = RECIPES.flatMap((recipe) =>
      unlistedIngredients(
        stepsOf(recipe),
        recipe.ingredients.map((ingredient) => ingredient.name),
        catalog,
      ).map((name) => `"${recipe.name}": "${name}" not listed`),
    );
    expect(problems).toEqual([]);
  });

  it('reports an unlisted ingredient that contains a listed name or is in the plural, but not a listed plural or a name inside another word', () => {
    const catalog = [
      'egg',
      'eggplant',
      'onion',
      'red onion',
      'spring onion',
      'oil',
      'pea',
      'anchovy',
    ];
    expect(unlistedIngredients(['Fry the eggplant.'], ['egg'], catalog)).toEqual(['eggplant']);
    expect(unlistedIngredients(['Chop the spring onion.'], ['onion'], catalog)).toEqual([
      'spring onion',
    ]);
    expect(unlistedIngredients(['Slice the onions.'], ['red onion'], catalog)).toEqual(['onion']);
    expect(unlistedIngredients(['Slice the red onions.'], ['red onion'], catalog)).toEqual([]);
    expect(unlistedIngredients(['Beat the eggs.'], ['egg'], catalog)).toEqual([]);
    expect(unlistedIngredients(['Boil the peanuts.'], [], catalog)).toEqual([]);
    expect(unlistedIngredients(['Chop the anchovies.'], [], catalog)).toEqual(['anchovy']);
    expect(unlistedIngredients(['Add the bay leaves.'], ['bay leaf'], catalog)).toEqual([]);
  });

  it('names an ingredient as a whole word or its plural, not inside another word', () => {
    expect(containsWord('slice the onions', 'onion')).toBe(true);
    expect(containsWord('peel the potatoes', 'potato')).toBe(true);
    expect(containsWord('grate the gruyère', 'gruyère')).toBe(true);
    expect(containsWord('chop the anchovies', 'anchovy')).toBe(true);
    expect(containsWord('add the bay leaves', 'bay leaf')).toBe(true);
    expect(containsWord('bring to the boil', 'oil')).toBe(false);
    expect(containsWord('add the peanuts', 'pea')).toBe(false);
    expect(containsWord('roast the turkies', 'turkey')).toBe(false);
    expect(containsWord('brown the beeves', 'beef')).toBe(false);
  });

  // Without it, the invariant tests would pass vacuously on an empty list
  function expectRecipesLoaded() {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
  }

  // recipes.json is only cast to Recipe, so a recipe without steps gets here as undefined
  function stepsOf(recipe: Recipe): string[] {
    return recipe.steps ?? [];
  }

  // Longest first, each name blanked once looked for: a listed "red onion" leaves no "onion" behind,
  // and an unlisted "spring onion" is found before a listed "onion" inside it is blanked
  function unlistedIngredients(
    steps: string[],
    own: string[],
    catalog: Iterable<string>,
  ): string[] {
    const unlisted: string[] = [];
    let text = steps.join('\n').toLowerCase();
    for (const name of [...new Set([...catalog, ...own])].sort((a, b) => b.length - a.length)) {
      if (!own.includes(name) && containsWord(text, name)) unlisted.push(name);
      text = text.replace(wordPattern(name, 'gu'), ' ');
    }
    return unlisted;
  }

  function containsWord(text: string, name: string): boolean {
    return wordPattern(name, 'u').test(text);
  }

  // \b only knows ASCII letters, and names like "gruyère" have others. The plural endings let
  // "onions", "tomatoes", "anchovies" and "leaves" name their ingredient. f→ves only after a, l or r,
  // since "beef" has no "beeves"
  function wordPattern(name: string, flags: string): RegExp {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const irregular = escaped.replace(/(?<=[^aeiou])y$/, 'ies').replace(/(?<=[alr])f$/, 'ves');
    const plurals = irregular === escaped ? '(?:e?s)?' : `(?:e?s)?|${irregular}`;
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped}${plurals})(?![\\p{L}\\p{N}])`, flags);
  }
});
