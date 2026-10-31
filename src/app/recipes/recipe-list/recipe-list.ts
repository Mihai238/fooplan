import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageStore } from '../../language-store';
import { MIN_SUGGESTED } from '../../plan/plan';
import { PlanStore } from '../../plan/plan-store';
import { nutritionMessage } from '../nutrition';
import { PicturePlaceholder } from '../picture-placeholder';
import { Recipe, servingsMessage } from '../recipe';
import { pictureOf, RECIPE_IMAGES } from '../recipe-images';
import { searchRecipes } from '../recipe-search';
import { recipeSlug } from '../recipe-slug';
import { RecipeStore } from '../recipe-store';

@Component({
  imports: [PicturePlaceholder, RouterLink],
  selector: 'app-recipe-list',
  styleUrl: './recipe-list.css',
  templateUrl: './recipe-list.html',
})
export class RecipeList {
  protected readonly store = inject(PlanStore);
  private readonly injector = inject(Injector);
  protected readonly recipeStore = inject(RecipeStore);
  protected readonly language = inject(LanguageStore);
  protected readonly images = inject(RECIPE_IMAGES);
  protected readonly query = signal('');
  private readonly search = computed(() => this.query().trim());
  protected readonly recipes = computed(() =>
    searchRecipes(this.recipeStore.all(), this.search(), this.recipeStore),
  );
  protected readonly matchStatus = computed(() => this.matchStatusText());
  protected readonly nutritionLines = computed(
    () =>
      new Map(this.recipeStore.all().map((recipe) => [recipe.name, this.nutritionLine(recipe)])),
  );
  protected readonly recipeSlug = recipeSlug;
  protected readonly pictureOf = pictureOf;
  protected readonly minSuggested = MIN_SUGGESTED;

  protected servingsText(servings: number): string {
    const { id, params } = servingsMessage(servings);
    return this.language.t(id, params);
  }

  protected dontSuggest(name: string, button: HTMLButtonElement): void {
    this.store.removeRecipe(name);
    this.focusReplacement(button);
  }

  protected suggestAgain(name: string, button: HTMLButtonElement): void {
    this.store.restoreRecipe(name);
    this.focusReplacement(button);
  }

  private matchStatusText(): string {
    const search = this.search();
    const count = this.recipes().length;
    if (search === '') {
      return '';
    }
    if (count === 0) {
      return this.language.t('recipes.noMatch', { search });
    }
    return count === 1
      ? this.language.t('recipes.oneMatch', { search })
      : this.language.t('recipes.matches', { count, search });
  }

  private nutritionLine(recipe: Recipe): string | undefined {
    const { id, params } = nutritionMessage(recipe);
    return id === 'nutrition.perServing' ? this.language.t(id, params) : undefined;
  }

  // "Don't suggest" and "Suggest again" replace each other, so the focus would drop to the page along
  // with the clicked one; the button replacing it exists only once the page is rendered
  private focusReplacement(clicked: HTMLButtonElement): void {
    if (document.activeElement === clicked) {
      const suggest = clicked.parentElement!;
      afterNextRender(() => suggest.querySelector('button')?.focus(), { injector: this.injector });
    }
  }
}
