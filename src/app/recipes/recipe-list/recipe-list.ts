import { Component, computed, signal } from '@angular/core';
import { displayAmount } from '../amount';
import { searchRecipes } from '../recipe-search';
import { RECIPES } from '../recipes';

@Component({
  selector: 'app-recipe-list',
  styleUrl: './recipe-list.css',
  templateUrl: './recipe-list.html',
})
export class RecipeList {
  protected readonly query = signal('');
  protected readonly recipes = computed(() => searchRecipes(RECIPES, this.query()));
  protected readonly displayAmount = displayAmount;
}
