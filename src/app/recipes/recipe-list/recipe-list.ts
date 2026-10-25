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
  protected readonly recipes = computed(() => searchRecipes(RECIPES, this.query()));
  protected readonly displayAmount = displayAmount;
  protected readonly recipeSlug = recipeSlug;
}
