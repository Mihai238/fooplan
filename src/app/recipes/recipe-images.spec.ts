import { TestBed } from '@angular/core/testing';
import { pictureOf, RECIPE_IMAGES } from './recipe-images';
import recipeImages from './recipe-images.json';
import { Recipe } from './recipe';
import { recipeSlug } from './recipe-slug';
import { RECIPES } from './recipes';
import { LISTED_IMAGES, ownRecipe, QUICK_DAL } from './testing';

const BUILT_IN_SLUGS = RECIPES.map((recipe) => recipeSlug(recipe.name));

describe('pictureOf', () => {
  it('gives a listed built-in recipe the src images/recipes/<slug>.webp (#63)', () => {
    expect(pictureOf(builtIn('Spaghetti pomodoro'), LISTED_IMAGES)).toBe(
      'images/recipes/spaghetti-pomodoro.webp',
    );
    expect(pictureOf(builtIn('Pizza toast'), LISTED_IMAGES)).toBe(
      'images/recipes/pizza-toast.webp',
    );
  });

  it("gives a built-in recipe the list doesn't hold no src, so nothing is requested for it (#63)", () => {
    expect(pictureOf(builtIn('Penne arrabbiata'), LISTED_IMAGES)).toBeUndefined();
    expect(pictureOf(builtIn('Spaghetti pomodoro'), [])).toBeUndefined();
  });

  it('finds "Niçoise salad" by its slug "nicoise-salad" (#63)', () => {
    expect(pictureOf(builtIn('Niçoise salad'), ['nicoise-salad'])).toBe(
      'images/recipes/nicoise-salad.webp',
    );
  });

  it('gives an own recipe no src, even one named like a listed built-in recipe (#63)', () => {
    expect(pictureOf(QUICK_DAL, LISTED_IMAGES)).toBeUndefined();
    expect(pictureOf(ownRecipe('Spaghetti pomodoro'), LISTED_IMAGES)).toBeUndefined();
    expect(pictureOf(ownRecipe('Quick Dal'), ['quick-dal'])).toBeUndefined();
  });

  it('gives no src when there is no recipe, such as a planned name no recipe has any more', () => {
    expect(pictureOf(undefined, LISTED_IMAGES)).toBeUndefined();
  });
});

describe('recipe-images.json', () => {
  it('is committed as [] (#63 6)', () => {
    expect(recipeImages).toEqual([]);
  });

  it('holds only slugs of built-in recipes, sorted as Array.prototype.sort sorts strings, without duplicates (#63 6)', () => {
    expect(listProblems(recipeImages)).toEqual([]);
  });

  it('is what RECIPE_IMAGES gives the app when nothing replaces it', () => {
    expect(TestBed.inject(RECIPE_IMAGES)).toEqual(recipeImages);
  });

  describe('the checks on sample lists', () => {
    it('pass the specs\' stub ["pizza-toast", "spaghetti-pomodoro"] and every built-in slug, sorted (#63 6)', () => {
      expect(listProblems(LISTED_IMAGES)).toEqual([]);
      expect(listProblems([...BUILT_IN_SLUGS].sort())).toEqual([]);
    });

    it('fail ["b-recipe", "a-recipe"] as not sorted, and two built-in slugs out of order with only that (#63 6a)', () => {
      expect(listProblems(['b-recipe', 'a-recipe'])).toContain('not sorted');
      expect(listProblems(['spaghetti-pomodoro', 'pizza-toast'])).toEqual(['not sorted']);
    });

    it('fail a list with a duplicate, even a sorted one of built-in slugs (#63 6b)', () => {
      expect(listProblems(['pizza-toast', 'pizza-toast', 'spaghetti-pomodoro'])).toEqual([
        'duplicate "pizza-toast"',
      ]);
    });

    it('fail a list with a slug no built-in recipe has, such as an own recipe\'s "quick-dal" or a recipe name instead of its slug (#63 6c)', () => {
      expect(listProblems(['pizza-toast', 'quick-dal'])).toEqual([
        'no built-in recipe "quick-dal"',
      ]);
      expect(listProblems(['Pizza toast'])).toEqual(['no built-in recipe "Pizza toast"']);
    });

    it('take "nicoise-salad", the slug of "Niçoise salad", as a built-in slug, and not "niçoise-salad" (#63 6d)', () => {
      expect(listProblems(['nicoise-salad'])).toEqual([]);
      expect(listProblems(['niçoise-salad'])).toEqual(['no built-in recipe "niçoise-salad"']);
    });
  });

  // What keeps a list from being one recipe-images.json may hold, none for a valid one
  function listProblems(list: readonly string[]): string[] {
    const sorted = [...list].sort();
    return [
      ...(list.every((slug, i) => slug === sorted[i]) ? [] : ['not sorted']),
      ...list.filter((slug, i) => list.indexOf(slug) !== i).map((slug) => `duplicate "${slug}"`),
      ...list
        .filter((slug) => !BUILT_IN_SLUGS.includes(slug))
        .map((slug) => `no built-in recipe "${slug}"`),
    ];
  }
});

function builtIn(name: string): Recipe {
  return RECIPES.find((recipe) => recipe.name === name)!;
}
