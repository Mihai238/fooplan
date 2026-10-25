import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { MIN_SUGGESTED } from '../../plan/plan';
import { PlanStore } from '../../plan/plan-store';
import { displayAmount } from '../amount';
import { servingsText } from '../recipe';
import { RecipeStore } from '../recipe-store';

@Component({
  imports: [RouterLink],
  selector: 'app-recipe-page',
  styleUrl: './recipe-page.css',
  templateUrl: './recipe-page.html',
})
export class RecipePage {
  private readonly router = inject(Router);
  protected readonly store = inject(PlanStore);
  private readonly injector = inject(Injector);
  private readonly recipes = inject(RecipeStore);
  // The router reuses this page for another slug, and the route's guard lets only a known one in
  protected readonly page = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => ({
        recipe: this.recipes.bySlug(params.get('slug')!)!,
        back: this.previousUrl(),
      })),
    ),
    { requireSync: true },
  );
  protected readonly step = linkedSignal({ source: this.page, computation: () => 0 });
  protected readonly last = computed(
    () => this.step() === (this.page().recipe.steps?.length ?? 0) - 1,
  );
  protected readonly displayAmount = displayAmount;
  protected readonly servingsText = servingsText;
  protected readonly minSuggested = MIN_SUGGESTED;
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly doneLink = viewChild<ElementRef<HTMLAnchorElement>>('doneLink');
  private readonly dontSuggestButton =
    viewChild<ElementRef<HTMLButtonElement>>('dontSuggestButton');
  private readonly suggestAgainButton =
    viewChild<ElementRef<HTMLButtonElement>>('suggestAgainButton');

  // A button disabled while it has the focus drops the focus to the page, so on the first step the
  // focus moves on to "Next". In a recipe of two steps "Next" replaces "Done" there, so it exists
  // only once the page is rendered
  protected showPrevious(previous: HTMLButtonElement): void {
    this.step.update((step) => step - 1);
    if (this.step() === 0 && document.activeElement === previous) {
      afterNextRender(() => this.nextButton()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  // On the last step "Done" replaces "Next", whose focus would drop to the page along with it; the
  // link exists only once the page is rendered
  protected showNext(next: HTMLButtonElement): void {
    this.step.update((step) => step + 1);
    if (this.last() && document.activeElement === next) {
      afterNextRender(() => this.doneLink()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  // "Don't suggest" and "Suggest again" replace each other, so the focus would drop to the page along
  // with the clicked one; the button replacing it exists only once the page is rendered
  protected dontSuggest(name: string, dontSuggest: HTMLButtonElement): void {
    this.store.removeRecipe(name);
    if (document.activeElement === dontSuggest) {
      afterNextRender(() => this.suggestAgainButton()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  protected suggestAgain(name: string, suggestAgain: HTMLButtonElement): void {
    this.store.restoreRecipe(name);
    if (document.activeElement === suggestAgain) {
      afterNextRender(() => this.dontSuggestButton()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  // The params change while the navigation here runs, so the one before it is where the user came
  // from; there is none when the app started on this page. A recipe saved from the form replaced it
  // in the history, so "Back" leads where the form's "Cancel" does rather than to an empty form
  private previousUrl(): UrlTree {
    const previous = this.router.currentNavigation()?.previousNavigation?.finalUrl;
    return previous && this.router.serializeUrl(previous) !== '/add-recipe'
      ? previous
      : this.router.parseUrl('/recipes');
  }
}
