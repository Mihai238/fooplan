---
paths:
  - "src/app/recipes/recipes.json"
---

# Recipe data

- Each recipe is the classic, widely known version of its dish: the ingredients it's normally made with, in realistic home-cooking amounts for its servings. A well-known regional variant is fine; an invented one isn't.
- Every ingredient name has one spelling and one unit across all recipes, so the grocery list can add them up. Reuse an existing name before adding one, and don't add a near-duplicate (`garlic` next to `garlic clove`). Different products may have similar names (`beef` and `beef sirloin`).
- New names are lowercase and singular, with `canned …` for canned goods. Units: `pc` for countable items, `ml` for liquids, `tbsp`/`tsp` for spices and small amounts, `g` for the rest. `vegetable oil` is in `ml`, because frying amounts in spoons are unreadable.
- No salt, pepper or water: pantry basics stay off the grocery list.
- Servings are 2 or 4: 4 for oven dishes, soups and stews, 2 for quick pan dishes.
- Parts home cooks normally buy are one ingredient (naan, tortilla, gnocchi, curry paste, hummus); the part the dish is about is made from its ingredients (pizza dough, falafel, fish batter, meatballs).
- Recipe names and their order are pinned by `recipes.spec.ts`, and saved plans refer to recipes by name: renaming one breaks both.
