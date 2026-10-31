import { RECIPES } from './recipes';
import german from './recipes.de.json';

// #58's German names of its recipes and of its new ingredients
const ADDED_NAMES: Record<string, string> = {
  'Chicken fried rice': 'Gebratener Reis mit Hähnchen',
  'Beef and broccoli stir-fry with rice': 'Rindfleisch-Brokkoli-Pfanne mit Reis',
  'Pork and bell pepper stir-fry with rice': 'Schweinefilet-Paprika-Pfanne mit Reis',
  'Salmon teriyaki with rice and broccoli': 'Teriyaki-Lachs mit Reis und Brokkoli',
  'Garlic prawns with rice': 'Knoblauchgarnelen mit Reis',
  'Chicken satay with rice': 'Hähnchen-Satay mit Reis',
  'Spinach rice with feta': 'Spinatreis mit Feta',
  'Coconut prawn curry with rice': 'Kokos-Garnelen-Curry mit Reis',
  'Potato and cauliflower curry with rice': 'Kartoffel-Blumenkohl-Curry mit Reis',
  'Tagliatelle alfredo with chicken': 'Tagliatelle Alfredo mit Hähnchen',
  'Chicken chow mein': 'Chow Mein mit Hähnchen',
  'Chicken paprikash with egg noodles': 'Paprikahähnchen mit Eiernudeln',
  'Chicken parmigiana with spaghetti': 'Hähnchen-Parmigiana mit Spaghetti',
  'Penne with Italian sausage and tomato sauce': 'Penne mit Salsiccia und Tomatensauce',
  'Tortellini with ham and peas': 'Tortellini mit Schinken und Erbsen',
  'Spaghetti puttanesca': 'Spaghetti alla Puttanesca',
  'Tagliatelle with smoked salmon and dill': 'Tagliatelle mit Räucherlachs und Dill',
  'Pasta alla norma': 'Pasta alla Norma',
  'Pasta salad with mozzarella and cherry tomatoes': 'Nudelsalat mit Mozzarella und Kirschtomaten',
  'Spätzle with creamy mushroom sauce': 'Spätzle mit Champignon-Rahmsauce',
  'Pork chops with mashed potatoes and apple sauce':
    'Schweinekoteletts mit Kartoffelpüree und Apfelmus',
  'Fish cakes with peas': 'Fischfrikadellen mit Erbsen',
  'Frankfurters with potato salad': 'Frankfurter Würstchen mit Kartoffelsalat',
  'Fried potatoes with bacon and fried eggs': 'Bratkartoffeln mit Speck und Spiegelei',
  'Pan-fried cod with potatoes and spinach': 'Gebratener Kabeljau mit Kartoffeln und Spinat',
  'Chicken thighs with roast potatoes and rosemary': 'Hähnchenschenkel mit Rosmarinkartoffeln',
  'Currywurst with fries': 'Currywurst mit Pommes',
  'Trout with potatoes and parsley butter': 'Forelle Müllerin mit Kartoffeln',
  'Tuna melts': 'Thunfisch-Toasts mit Käse',
  'Smoked salmon bagels': 'Bagels mit Räucherlachs',
  'Steak sandwiches with caramelised onions': 'Steak-Sandwiches mit karamellisierten Zwiebeln',
  'Croque monsieur': 'Croque Monsieur',
  'Chicken gyros with pita and tzatziki': 'Hähnchen-Gyros mit Pita und Tzatziki',
  'BLT sandwiches': 'BLT-Sandwiches',
  'Lamb koftas with pita and tzatziki': 'Lamm-Köfte mit Pita und Tzatziki',
  'Beef tacos': 'Rindfleisch-Tacos',
  'White bean stew with chorizo and bread': 'Weiße-Bohnen-Eintopf mit Chorizo und Brot',
  'Baked cod with tomatoes, olives and bread': 'Ofenkabeljau mit Tomaten, Oliven und Brot',
  'Savoury pancakes with ham and cheese': 'Herzhafte Pfannkuchen mit Schinken und Käse',
  'Salmon with couscous and roasted vegetables': 'Lachs mit Couscous und Ofengemüse',
};
const ADDED_INGREDIENTS: Record<string, string> = {
  apple: 'Apfel',
  bacon: 'Speck',
  bagel: 'Bagel',
  caper: 'Kapern',
  cauliflower: 'Blumenkohl',
  chorizo: 'Chorizo',
  'cream cheese': 'Frischkäse',
  emmental: 'Emmentaler',
  fusilli: 'Fusilli',
  'ground lamb': 'Lammhackfleisch',
  ham: 'Kochschinken',
  'italian sausage': 'Salsiccia',
  mayonnaise: 'Mayonnaise',
  'peanut butter': 'Erdnussbutter',
  'pita bread': 'Pitabrot',
  'pork chop': 'Schweinekotelett',
  'pork tenderloin': 'Schweinefilet',
  rocket: 'Rucola',
  rosemary: 'Rosmarin',
  'smoked salmon': 'Räucherlachs',
  spätzle: 'Spätzle',
  tagliatelle: 'Tagliatelle',
  tortellini: 'Tortellini',
  trout: 'Forelle',
  yogurt: 'Joghurt',
};

describe('recipes.de.json', () => {
  it('translates every recipe of RECIPES with a name and one non-empty step per English step, every ingredient name RECIPES uses, and nothing RECIPES does not have', () => {
    const recipes: Record<string, { name: string; steps: string[] }> = german.recipes;
    const ingredients: Record<string, string> = german.ingredients;

    expect(Object.keys(recipes).sort()).toEqual(RECIPES.map((recipe) => recipe.name).sort());
    for (const recipe of RECIPES) {
      const translation = recipes[recipe.name];
      expect(translation.name.trim(), `German name of "${recipe.name}"`).not.toBe('');
      expect(translation.steps, `German steps of "${recipe.name}"`).toHaveLength(
        recipe.steps?.length ?? 0,
      );
      expect(
        translation.steps.filter((step) => step.trim() === ''),
        `empty German steps of "${recipe.name}"`,
      ).toEqual([]);
    }

    const used = new Set(RECIPES.flatMap((recipe) => recipe.ingredients.map(({ name }) => name)));
    expect(Object.keys(ingredients).sort()).toEqual([...used].sort());
    for (const [name, translation] of Object.entries(ingredients)) {
      expect(translation.trim(), `German name of "${name}"`).not.toBe('');
    }
  });

  it('translates the 40 recipes of #58 under their English names with their German names and one non-empty step per English step, and the 25 new ingredients with their German names (#58 4)', () => {
    const recipes: Record<string, { name: string; steps: string[] }> = german.recipes;
    const ingredients: Record<string, string> = german.ingredients;
    const added = RECIPES.slice(44, 84);
    expect(
      added.map((recipe) => recipe.name),
      'recipes of #58',
    ).toEqual(Object.keys(ADDED_NAMES));
    expect(
      Object.fromEntries(added.map((recipe) => [recipe.name, recipes[recipe.name]?.name])),
    ).toEqual(ADDED_NAMES);
    for (const recipe of added) {
      const steps = recipes[recipe.name].steps;
      expect(steps, `German steps of "${recipe.name}"`).toHaveLength(recipe.steps?.length ?? 0);
      expect(steps.length, `German steps of "${recipe.name}"`).toBeGreaterThanOrEqual(3);
      expect(
        steps.filter((step) => step.trim() === ''),
        `empty steps of "${recipe.name}"`,
      ).toEqual([]);
    }
    expect(
      Object.fromEntries(Object.keys(ADDED_INGREDIENTS).map((name) => [name, ingredients[name]])),
    ).toEqual(ADDED_INGREDIENTS);
  });
});
