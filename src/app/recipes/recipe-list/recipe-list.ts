import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { displayAmount } from '../amount';
import { searchRecipes } from '../recipe-search';
import { recipeSlug } from '../recipe-slug';
import { RECIPES } from '../recipes';

@Component({
  imports: [RouterLink],
  selector: 'app-recipe-list',
  styleUrl: './recipe-list.css',
  templateUrl: './recipe-list.html',
})
export class RecipeList {
  protected readonly query = signal('');
  private readonly search = computed(() => this.query().trim());
  protected readonly recipes = computed(() => searchRecipes(RECIPES, this.search()));
  protected readonly matchStatus = computed(() =>
    matchStatusText(this.search(), this.recipes().length),
  );
  protected readonly displayAmount = displayAmount;
  protected readonly recipeSlug = recipeSlug;
}

function matchStatusText(search: string, count: number): string {
  if (search === '') {
    return '';
  }
  if (count === 0) {
    return `No recipe matches "${search}".`;
  }
  return count === 1 ? `1 recipe matches "${search}".` : `${count} recipes match "${search}".`;
}
