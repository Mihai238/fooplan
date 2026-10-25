import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PlanStore } from '../../plan/plan-store';
import {
  checkRecipe,
  IngredientDraft,
  MAX_INGREDIENTS,
  RecipeProblems,
  RowProblems,
} from '../own-recipe';
import { Ingredient, Unit, UNITS } from '../recipe';
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
  // Only the edit route has a slug. The router reuses this form for another slug, and that route's
  // guard lets in only an own recipe's
  protected readonly editing = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const slug = params.get('slug');
        return slug === null ? undefined : { slug, recipe: this.recipes.bySlug(slug)! };
      }),
    ),
    { requireSync: true },
  );
  // The edited recipe's name in RecipeStore, which a save changes, also when its navigation fails
  // and the form stays
  private readonly savedName = linkedSignal(() => this.editing()?.recipe.name);
  protected readonly name = linkedSignal(() => this.editing()?.recipe.name ?? '');
  protected readonly servings = linkedSignal(() => String(this.editing()?.recipe.servings ?? 2));
  protected readonly rows = linkedSignal<readonly Row[]>(
    () =>
      this.editing()?.recipe.ingredients.map((ingredient) => this.rowOf(ingredient)) ?? [
        this.emptyRow(),
      ],
  );
  // Set only on "Save recipe" or "Save changes", so the messages stay as they are while the user
  // types
  protected readonly problems = linkedSignal({
    source: this.editing,
    computation: (): ShownProblems => ({ rows: new Map() }),
  });

  // Without preventDefault the browser would submit the form and reload the page
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    // A submit while the navigation to the saved recipe is under way would find an added recipe's
    // name taken, or save an edited one again and start a second navigation. After a failed
    // navigation the form stays, and a submit gets the usual checks again
    if (this.saved) {
      return;
    }
    const rows = this.rows();
    const savedName = this.savedName();
    const check = checkRecipe(
      {
        name: this.name(),
        servings: this.servings(),
        ingredients: rows.map(({ id, ...draft }) => draft),
      },
      this.recipes.all().filter((recipe) => recipe.name !== savedName),
    );
    if ('recipe' in check) {
      if (savedName !== undefined) {
        // Taken only here: creating the store can draw and save a plan, which adding a recipe
        // doesn't. And before the rename, as creating it loads the plan and the removed recipes,
        // dropping a name RecipeStore no longer has and rejecting a plan that holds one
        const store = this.injector.get(PlanStore);
        this.recipes.replace(savedName, check.recipe);
        store.renameRecipe(savedName, check.recipe.name);
        this.savedName.set(check.recipe.name);
      } else {
        this.recipes.add(check.recipe);
      }
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

  private rowOf({ amount, unit, name }: Ingredient): Row {
    return { id: this.nextId++, amount: String(amount), unit, name };
  }

  private focusAmount(row: Row): void {
    afterNextRender(() => this.host.querySelector<HTMLInputElement>(`#amount-${row.id}`)?.focus(), {
      injector: this.injector,
    });
  }
}
