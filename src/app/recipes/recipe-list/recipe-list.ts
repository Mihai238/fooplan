import { afterNextRender, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MIN_SUGGESTED } from '../../plan/plan';
import { PlanStore } from '../../plan/plan-store';
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
  protected readonly store = inject(PlanStore);
  private readonly injector = inject(Injector);
  protected readonly query = signal('');
  private readonly search = computed(() => this.query().trim());
  protected readonly recipes = computed(() => searchRecipes(RECIPES, this.search()));
  protected readonly matchStatus = computed(() =>
    matchStatusText(this.search(), this.recipes().length),
  );
  protected readonly displayAmount = displayAmount;
  protected readonly recipeSlug = recipeSlug;
  protected readonly minSuggested = MIN_SUGGESTED;

  protected dontSuggest(name: string, button: HTMLButtonElement): void {
    this.store.removeRecipe(name);
    this.focusReplacement(button);
  }

  protected suggestAgain(name: string, button: HTMLButtonElement): void {
    this.store.restoreRecipe(name);
    this.focusReplacement(button);
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

function matchStatusText(search: string, count: number): string {
  if (search === '') {
    return '';
  }
  if (count === 0) {
    return `No recipe matches "${search}".`;
  }
  return count === 1 ? `1 recipe matches "${search}".` : `${count} recipes match "${search}".`;
}
