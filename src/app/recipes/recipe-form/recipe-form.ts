import { afterNextRender, Component, ElementRef, inject, Injector, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  checkRecipe,
  IngredientDraft,
  MAX_INGREDIENTS,
  RecipeProblems,
  RowProblems,
} from '../own-recipe';
import { Unit, UNITS } from '../recipe';
import { recipeSlug } from '../recipe-slug';
import { RecipeStore } from '../recipe-store';

interface Row extends IngredientDraft {
  id: number;
}

// Row problems are kept by the row's id, so a removed row takes its messages along and the rows
// after it keep theirs as they move up
interface ShownProblems extends Omit<RecipeProblems, 'rows'> {
  rows: ReadonlyMap<number, RowProblems>;
}

@Component({
  imports: [RouterLink],
  selector: 'app-recipe-form',
  styleUrl: './recipe-form.css',
  templateUrl: './recipe-form.html',
})
export class RecipeForm {
  private readonly router = inject(Router);
  private readonly recipes = inject(RecipeStore);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private nextId = 0;
  private saved = false;
  protected readonly units = UNITS;
  protected readonly maxRows = MAX_INGREDIENTS;
  protected readonly name = signal('');
  protected readonly servings = signal('2');
  protected readonly rows = signal<readonly Row[]>([this.emptyRow()]);
  // Set only on "Save recipe", so the messages stay as they are while the user types
  protected readonly problems = signal<ShownProblems>({ rows: new Map() });

  // Without preventDefault the browser would submit the form and reload the page
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    // A submit while the navigation to the saved recipe is under way would find its name taken.
    // After a failed navigation the form stays, and a submit gets the usual checks again
    if (this.saved) {
      return;
    }
    const rows = this.rows();
    const check = checkRecipe(
      {
        name: this.name(),
        servings: this.servings(),
        ingredients: rows.map(({ id, ...draft }) => draft),
      },
      this.recipes.all(),
    );
    if ('recipe' in check) {
      this.recipes.add(check.recipe);
      this.saved = true;
      // Replacing the form in the history keeps the browser's back button from returning to it
      this.router
        .navigate(['/recipes', recipeSlug(check.recipe.name)], { replaceUrl: true })
        .catch(() => false)
        .then((navigated) => (this.saved = navigated));
      return;
    }
    const { rows: rowProblems, ...fieldProblems } = check.problems;
    this.problems.set({
      ...fieldProblems,
      rows: new Map(rows.map((row, i) => [row.id, rowProblems[i]])),
    });
    afterNextRender(() => this.host.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), {
      injector: this.injector,
    });
  }

  protected chooseUnit(row: Row, select: HTMLSelectElement): void {
    this.edit(row, { unit: select.value as Unit });
  }

  protected edit(row: Row, change: Partial<IngredientDraft>): void {
    this.rows.update((rows) =>
      rows.map((candidate) => (candidate.id === row.id ? { ...candidate, ...change } : candidate)),
    );
  }

  protected addRow(): void {
    const row = this.emptyRow();
    this.rows.update((rows) => [...rows, row]);
    this.focusAmount(row);
  }

  // A removed button that had the focus would drop it to <body>, sending keyboard and screen-reader
  // users back to the top of the page; a focus elsewhere stays where it is
  protected remove(index: number, button: HTMLButtonElement): void {
    const hadFocus = document.activeElement === button;
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
    if (hadFocus) {
      this.focusAmount(this.rows()[index] ?? this.rows()[index - 1]);
    }
  }

  private emptyRow(): Row {
    return { id: this.nextId++, amount: '', unit: 'g', name: '' };
  }

  private focusAmount(row: Row): void {
    afterNextRender(() => this.host.querySelector<HTMLInputElement>(`#amount-${row.id}`)?.focus(), {
      injector: this.injector,
    });
  }
}
