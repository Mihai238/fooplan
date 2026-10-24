# Fooplan

Fooplan plans lunch and dinner for the next few days from a set of built-in recipes, then turns the plan into a grocery list.

So far it ships the recipe list: the "Recipes" page shows the 30 sample recipes from `src/app/recipes/recipes.json` with their servings and ingredients.

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
