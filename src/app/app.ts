import { Component, computed, inject } from '@angular/core';
import { isActive, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Language, LanguageStore } from './language-store';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly language = inject(LanguageStore);
  // A recipe page and the form to add one belong to Recipes, so the link stays current there, but
  // they aren't that page. RouterLinkActive can't do this: it would take the class and aria-current
  // off again on /add-recipe, which isn't under /recipes
  protected readonly onRecipesPage = isActive('/recipes', this.router, { paths: 'exact' });
  protected readonly inRecipes = computed(() => this.underRecipes() || this.onAddRecipe());
  private readonly underRecipes = isActive('/recipes', this.router);
  private readonly onAddRecipe = isActive('/add-recipe', this.router);

  protected showLanguage(language: Language): void {
    if (language !== this.language.language()) {
      this.language.set(language);
    }
  }
}
