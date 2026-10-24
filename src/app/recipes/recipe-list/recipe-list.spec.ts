import { TestBed } from '@angular/core/testing';
import { RECIPES } from '../recipes';
import { RecipeList } from './recipe-list';

describe('RecipeList', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(RecipeList);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows each recipe with its name, servings and every ingredient with amount, unit and name', () => {
    expectAllRecipesRendered();
    articles().forEach((article, i) => {
      const recipe = RECIPES[i];
      expect(textOf(article.querySelector('h2')!), `name of article ${i}`).toBe(recipe.name);
      expect(textOf(article), `servings of "${recipe.name}"`).toContain(
        `${recipe.servings} servings`,
      );
      expect(
        Array.from(article.querySelectorAll('li')).map(textOf),
        `ingredients of "${recipe.name}"`,
      ).toEqual(
        recipe.ingredients.map(
          (ingredient) => `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`,
        ),
      );
    });
  });

  it('lists exactly as many ingredients per article as the recipe has', () => {
    expectAllRecipesRendered();
    articles().forEach((article, i) => {
      expect(article.querySelectorAll('li').length, `ingredients of "${RECIPES[i].name}"`).toBe(
        RECIPES[i].ingredients.length,
      );
    });
  });

  it('shows the recipes in RECIPES order', () => {
    expectAllRecipesRendered();
    expect(articles().map((article) => textOf(article.querySelector('h2')!))).toEqual(
      RECIPES.map((recipe) => recipe.name),
    );
  });

  function articles(): HTMLElement[] {
    return Array.from(element.querySelectorAll('article'));
  }

  function textOf(node: Element): string {
    return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function expectAllRecipesRendered() {
    expect(RECIPES.length, 'no recipes loaded').toBeGreaterThan(0);
    expect(articles()).toHaveLength(RECIPES.length);
  }
});
