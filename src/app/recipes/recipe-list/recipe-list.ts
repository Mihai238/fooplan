import { Component } from '@angular/core';
import { RECIPES } from '../recipes';

@Component({
  selector: 'app-recipe-list',
  styleUrl: './recipe-list.css',
  templateUrl: './recipe-list.html',
})
export class RecipeList {
  protected readonly recipes = RECIPES;
}
