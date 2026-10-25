# Fooplan

Fooplan plans lunch and dinner for the next few days from a set of built-in recipes, then turns the plan into a grocery list.

The app opens on the "Plan" page (unknown URLs lead there too). It plans lunch and dinner for 1–5 days starting today (default 5) and for a number of people (default 2). Each open meal offers three recipe suggestions: pick one, or ask for other suggestions; a picked meal can be cleared again. A picked dinner (except on the last day) offers "Cook extra for tomorrow's lunch": the next day's lunch then becomes "Leftovers: <recipe>", whether it was open or picked (a lunch pick is dropped, so its recipe can be suggested again); it counts as filled and isn't a repeat, and the grocery list counts that dinner for twice the people. Unticking it, or clearing the dinner, opens that lunch again; shrinking the plan so that the dinner is on the last day turns the option off. No recipe is used twice in a plan: a picked recipe is never suggested for another meal. Once every meal is filled (a recipe or leftovers), "Accept plan" makes the plan read-only; such a dinner then shows "Cooking extra for tomorrow's lunch". "New plan", offered while planning and once accepted, discards the plan after a confirmation and starts an empty one from today for the same number of people. The plan is saved in the browser (`localStorage`), so it survives a reload and keeps its dates when reopened on a later day; "New plan" is the way to start a fresh one from today.

The "Grocery list" page lists what to buy for the accepted plan; until the plan is accepted it only says to accept a plan first, with a link to the plan. Each recipe's amounts are scaled from its servings to the number of people (a dinner cooked extra counts twice the people, and the lunch its leftovers cover adds nothing). The same ingredient in the same unit is merged into one line with the summed amount, and only then rounded up to a whole number (two half onions make one onion, 133.3 g becomes 134 g); the same ingredient in different units stays on separate lines. Olive oil, sesame oil, vegetable oil, salt, pepper and black pepper are left off. The lines are grouped by shop section in the order Fruit & vegetables, Meat & fish, Dairy & eggs, Bread & bakery, Pasta, rice & grains, Cans & jars, Spices & sauces, Nuts & seeds, Drinks and Other (for an ingredient without a section), alphabetical by name and then unit within a section; sections without lines aren't shown. Ticking a line moves it out of its section into a collapsed "In the cart (n)" section at the bottom (alphabetical), where unticking it moves it back. When ticked or unticked with the keyboard, the focus then goes to the next line in the same section or cart, else to the previous one; after the last line of a section, to the first line of the next section, else to the cart; after the last line of the cart, to the unticked line back in its section. A click or tap leaves the focus alone. Ticks are saved with the plan, so they survive a reload; "New plan" clears them.

The "Recipes" page shows the 60 sample recipes from `src/app/recipes/recipes.json` with their servings and ingredients.

## Running it

Needs Node ≥ 24.15.

```bash
npm install
npm start
```

Then open `http://localhost:4200/`.

## Testing and building

```bash
npx ng test --watch=false   # Vitest unit and component tests
npm run build               # type check and production build into dist/fooplan/
```

## Deployment

Every push to `main` runs the tests, builds the app and publishes it to GitHub Pages at <https://mihai238.github.io/fooplan/> (`.github/workflows/deploy.yml`). A failing test stops the deployment. The workflow can also be started by hand from the Actions tab.

One-time setup: Settings → Pages → Source: "GitHub Actions".
