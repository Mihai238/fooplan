import { NgTemplateOutlet } from '@angular/common';
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
import { LanguageStore } from '../../language-store';
import { MIN_SUGGESTED } from '../../plan/plan';
import { PlanStore } from '../../plan/plan-store';
import { servingsMessage } from '../recipe';
import { recipeSlug } from '../recipe-slug';
import { RecipeStore } from '../recipe-store';
import { stepParts } from '../step-amounts';
import { StepsView, StepsViewStore } from '../steps-view-store';

const FORM_URL = /^\/(add-recipe|recipes\/[^/]+\/edit)$/;

@Component({
  imports: [NgTemplateOutlet, RouterLink],
  selector: 'app-recipe-page',
  styleUrl: './recipe-page.css',
  templateUrl: './recipe-page.html',
})
export class RecipePage {
  private readonly router = inject(Router);
  protected readonly store = inject(PlanStore);
  private readonly injector = inject(Injector);
  private readonly recipes = inject(RecipeStore);
  private readonly stepsView = inject(StepsViewStore);
  protected readonly language = inject(LanguageStore);
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
  protected readonly name = computed(() => this.recipes.displayName(this.page().recipe));
  protected readonly ingredients = computed(() =>
    this.recipes.displayIngredients(this.page().recipe),
  );
  protected readonly steps = computed(() =>
    this.recipes
      .displaySteps(this.page().recipe)
      ?.map((step) =>
        stepParts(step, this.ingredients(), (amount) => this.language.amount(amount)),
      ),
  );
  protected readonly view = this.stepsView.view;
  protected readonly step = linkedSignal({ source: this.page, computation: () => 0 });
  protected readonly last = computed(() => this.step() === (this.steps()?.length ?? 0) - 1);
  protected readonly minSuggested = MIN_SUGGESTED;
  protected readonly recipeSlug = recipeSlug;
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly doneLink = viewChild<ElementRef<HTMLAnchorElement>>('doneLink');
  private readonly dontSuggestButton =
    viewChild<ElementRef<HTMLButtonElement>>('dontSuggestButton');
  private readonly suggestAgainButton =
    viewChild<ElementRef<HTMLButtonElement>>('suggestAgainButton');
  private readonly deleteButton = viewChild<ElementRef<HTMLButtonElement>>('deleteButton');
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private pressedOnBackdrop = false;

  protected servingsText(servings: number): string {
    const { id, params } = servingsMessage(servings);
    return this.language.t(id, params);
  }

  protected showView(view: StepsView): void {
    if (view !== this.view()) {
      this.stepsView.set(view);
    }
  }

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

  protected openDeleteDialog(): void {
    // A leftover press from the last time would otherwise let a click without a press of its own
    // (element.click(), some assistive technology) close the dialog right after reopening
    this.pressedOnBackdrop = false;
    this.dialog()?.nativeElement.showModal();
  }

  protected deleteRecipe(name: string): void {
    this.store.deleteRecipe(name);
    void this.router.navigateByUrl('/recipes', { replaceUrl: true });
  }

  protected focusDelete(): void {
    this.deleteButton()?.nativeElement.focus();
  }

  // A click on the backdrop targets the dialog itself, as does one on its padding, which lies
  // inside its box. So does a press inside the dialog released on the backdrop (selecting its
  // text, say), so only a press that started on the backdrop too closes it
  protected pressBackdrop(event: PointerEvent, dialog: HTMLDialogElement): void {
    this.pressedOnBackdrop = this.isOnBackdrop(event, dialog);
  }

  protected closeOnBackdrop(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (this.pressedOnBackdrop && this.isOnBackdrop(event, dialog)) {
      dialog.close();
    }
    this.pressedOnBackdrop = false;
  }

  // A modal dialog keeps Tab off the page behind, but lets it leave for the browser's toolbar, and
  // Safari's Tab skips buttons by default; so every Tab moves between the two buttons here, with
  // the focus elsewhere in the dialog counting as before the first and after the last
  protected trapFocus(event: KeyboardEvent, first: HTMLElement, last: HTMLElement): void {
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    const [from, to] = event.shiftKey ? [last, first] : [first, last];
    (document.activeElement === from ? to : from).focus();
  }

  // The params change while the navigation here runs, so the one before it is where the user came
  // from; there is none when the app started on this page. A recipe saved from a form replaced it
  // in the history, so after a form "Back" leads to the Recipes page rather than back into it
  private previousUrl(): UrlTree {
    const previous = this.router.currentNavigation()?.previousNavigation?.finalUrl;
    return previous && !FORM_URL.test(this.router.serializeUrl(previous))
      ? previous
      : this.router.parseUrl('/recipes');
  }

  private isOnBackdrop(event: MouseEvent, dialog: HTMLDialogElement): boolean {
    if (event.target !== dialog) {
      return false;
    }
    const box = dialog.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  }
}
