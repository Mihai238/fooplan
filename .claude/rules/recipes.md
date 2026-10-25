---
paths:
  - "src/app/recipes/recipes.json"
---

# Recipe data

- Each recipe is the classic, widely known version of its dish: the ingredients it's normally made with, in realistic home-cooking amounts for its servings. A well-known regional variant is fine; an invented one isn't.
- No soups: no built-in recipe's name contains "soup".
- Every ingredient name has one spelling and one unit across all recipes, so the grocery list can add them up. Reuse an existing name before adding one, and don't add a near-duplicate (`garlic` next to `garlic clove`). Different products may have similar names (`beef` and `beef sirloin`).
- New names are lowercase and singular, with `canned …` for canned goods. Units: `pc` for countable items, `ml` for liquids, `tbsp`/`tsp` for spices and small amounts, `g` for the rest. `vegetable oil` is in `ml`, because frying amounts in spoons are unreadable.
- No salt, pepper or water: pantry basics stay off the grocery list.
- Each recipe has at least three non-empty `steps`. They describe the classic way to cook it, in order, one action a cook can do before looking at the screen again, with times and heat where they matter. Every ingredient is named in a step by its ingredient name; no step uses anything that isn't listed, apart from water, salt and pepper.
- Servings are 2 or 4: 4 for oven dishes and stews, 2 for quick pan dishes.
- `minutes` is the total time from starting to cook to serving the recipe's servings, including preparation, marinating, oven, simmering and dough rising, excluding soaking the day before; a multiple of 5, from 10 to 240.
- `workMinutes` is the hands-on time (preparing, chopping, stirring, frying, assembling), without unattended oven, boiling, simmering, soaking or resting time; a multiple of 5, from 5 up to `minutes`. A recipe takes at most 30 minutes of work and at most 45 minutes in total.
- Parts home cooks normally buy are one ingredient (naan, tortilla, gnocchi, curry paste, hummus); the part the dish is about is made from its ingredients (pizza dough, falafel, fish batter, meatballs).
- Recipe names and their order are pinned by `recipes.spec.ts`, and saved plans refer to recipes by name: renaming one breaks both.
- A recipe is kid-friendly unless it uses one of the strong flavours in `STRONG_FLAVOURS` (`src/app/recipes/kid-friendly.ts`); at least 15 built-in recipes stay kid-friendly.
- A recipe's base (pasta, rice, potato, bread) and protein (chicken, meat, fish) are derived from its ingredient names by `src/app/plan/ranking.ts`; a new ingredient of one of these kinds goes into its list there.
