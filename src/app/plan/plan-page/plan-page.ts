import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageId } from '../../i18n';
import { Language, LanguageStore } from '../../language-store';
import { recipeSlug } from '../../recipes/recipe-slug';
import { RecipeStore } from '../../recipes/recipe-store';
import {
  DEFAULT_DAYS,
  filledMeals,
  isComplete,
  leftoversOf,
  MAX_DAYS,
  MealKind,
  MIN_DAYS,
  MIN_PEOPLE,
  MIN_SUGGESTED,
} from '../plan';
import { PlanStore, TODAY } from '../plan-store';

const DATE_FORMATS: Record<Language, string> = { en: 'EEE d MMM', de: 'EEE, d. MMM' };

interface RemovalRow {
  dontSuggest: HTMLButtonElement;
  suggestion: HTMLButtonElement;
}

@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-plan-page',
  styleUrl: './plan-page.css',
  templateUrl: './plan-page.html',
})
export class PlanPage {
  protected readonly store = inject(PlanStore);
  protected readonly language = inject(LanguageStore);
  private readonly recipes = inject(RecipeStore);
  private readonly readToday = inject(TODAY);
  private readonly injector = inject(Injector);
  protected readonly plan = this.store.plan;
  // Not a live date: it is read when the page opens and taken from a new plan's first day when one
  // starts, so a page left open past midnight keeps its marking until then
  protected readonly today = signal(this.readToday());
  protected readonly complete = computed(() => isComplete(this.plan()));
  protected readonly status = computed(() =>
    this.plan().accepted ? this.language.t('plan.acceptedStatus') : '',
  );
  protected readonly filled = computed(() => filledMeals(this.plan()));
  protected readonly dateFormat = computed(() => DATE_FORMATS[this.language.language()]);
  protected readonly summary = computed(() => {
    const { days, people, kidFriendly } = this.plan();
    return this.language.t(kidFriendly ? 'plan.summaryKidFriendly' : 'plan.summary', {
      days: days.length,
      dayWord: this.language.t(days.length === 1 ? 'day.one' : 'day.other'),
      people,
      personWord: this.personWord(people),
    });
  });
  protected readonly nextPlan = computed(() => {
    const people = this.plan().people;
    return this.language.t(this.store.kidFriendly() ? 'newPlan.nextKidFriendly' : 'newPlan.next', {
      days: DEFAULT_DAYS,
      people,
      personWord: this.personWord(people),
    });
  });
  protected readonly minDays = MIN_DAYS;
  protected readonly maxDays = MAX_DAYS;
  protected readonly minPeople = MIN_PEOPLE;
  protected readonly minSuggested = MIN_SUGGESTED;
  protected readonly fewestDays = computed(() => this.plan().days.length <= MIN_DAYS);
  protected readonly mostDays = computed(() => this.plan().days.length >= MAX_DAYS);
  protected readonly fewestPeople = computed(() => this.plan().people <= MIN_PEOPLE);
  protected readonly kidFriendlyDisabled = computed(() => !this.store.canBeKidFriendly());
  protected readonly recipeSlug = recipeSlug;
  protected readonly meals: readonly { kind: MealKind; label: MessageId }[] = [
    { kind: 'lunch', label: 'meal.lunch' },
    { kind: 'dinner', label: 'meal.dinner' },
  ];
  private readonly recipesByName = computed(
    () => new Map(this.recipes.all().map((recipe) => [recipe.name, recipe])),
  );
  private readonly groceriesLink = viewChild<ElementRef<HTMLAnchorElement>>('groceriesLink');
  protected readonly removing = signal('');
  private removalRow: RemovalRow | null = null;
  private pressedOnBackdrop = false;

  protected stepDays(delta: number): void {
    this.store.setDays(this.plan().days.length + delta);
  }

  protected stepPeople(delta: number): void {
    this.store.setPeople(this.plan().people + delta);
  }

  // A button disabled while it has the focus drops the focus to the page, so the focus moves on to
  // the value, where the arrow keys go on stepping it
  protected keepFocus(arrow: HTMLButtonElement, atLimit: boolean, value: HTMLElement): void {
    if (atLimit && document.activeElement === arrow) {
      value.focus();
    }
  }

  protected leftovers(kind: MealKind, day: number): string | null {
    return kind === 'lunch' ? leftoversOf(this.plan(), day) : null;
  }

  protected displayName(name: string): string {
    const recipe = this.recipesByName().get(name);
    return recipe ? this.recipes.displayName(recipe) : name;
  }

  protected minutes(recipe: string): number | undefined {
    return this.recipesByName().get(recipe)?.minutes;
  }

  // The focus moves whether or not the click focused the button (Safari and Firefox on macOS don't),
  // since it would otherwise drop to the page along with the button; the link taking the button's
  // place exists only once the page is rendered
  protected accept(): void {
    this.store.accept();
    afterNextRender(() => this.groceriesLink()?.nativeElement.focus(), { injector: this.injector });
  }

  protected newPlan(dialog: HTMLDialogElement): void {
    if (this.filled() > 0 || this.plan().accepted) {
      this.openDialog(dialog);
    } else {
      this.startPlan();
    }
  }

  protected startNewPlan(dialog: HTMLDialogElement): void {
    this.startPlan();
    dialog.close();
  }

  protected askDontSuggest(recipe: string, row: RemovalRow, dialog: HTMLDialogElement): void {
    this.removing.set(recipe);
    this.removalRow = row;
    // A screen reader reads the heading as the dialog's name when it opens, so the dialog opens
    // once the heading names the recipe
    afterNextRender(() => this.openDialog(dialog), { injector: this.injector });
  }

  protected confirmDontSuggest(dialog: HTMLDialogElement): void {
    this.store.removeRecipe(this.removing());
    dialog.close();
  }

  // The row keeps its elements when its recipe changes, so its "×" takes the focus back, named after
  // the replacement; only at the limit, where the "×" buttons go away, does the focus move on to the
  // row's suggestion
  protected focusRow(): void {
    if (!this.removalRow) {
      return;
    }
    const { dontSuggest, suggestion } = this.removalRow;
    (this.store.canRemove() ? dontSuggest : suggestion).focus();
    this.removalRow = null;
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

  private openDialog(dialog: HTMLDialogElement): void {
    // A second click on a "×" before the first one's render opens the dialog asks to open it again
    if (dialog.open) {
      return;
    }
    // A leftover press from the last time would otherwise let a click without a press of its own
    // (element.click(), some assistive technology) close the dialog right after reopening
    this.pressedOnBackdrop = false;
    dialog.showModal();
  }

  private personWord(people: number): string {
    return this.language.t(people === 1 ? 'person.one' : 'person.other');
  }

  private startPlan(): void {
    this.store.newPlan();
    this.today.set(this.plan().days[0].date);
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
