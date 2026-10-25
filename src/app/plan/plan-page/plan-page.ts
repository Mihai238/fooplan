import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import {
  DEFAULT_DAYS,
  filledMeals,
  isComplete,
  leftoversOf,
  MAX_DAYS,
  MealKind,
  MIN_DAYS,
} from '../plan';
import { PlanStore } from '../plan-store';

@Component({
  imports: [DatePipe],
  selector: 'app-plan-page',
  styleUrl: './plan-page.css',
  templateUrl: './plan-page.html',
})
export class PlanPage {
  protected readonly store = inject(PlanStore);
  protected readonly plan = this.store.plan;
  protected readonly complete = computed(() => isComplete(this.plan()));
  protected readonly filled = computed(() => filledMeals(this.plan()));
  protected readonly defaultDays = DEFAULT_DAYS;
  protected readonly minDays = MIN_DAYS;
  protected readonly maxDays = MAX_DAYS;
  protected readonly meals: readonly { kind: MealKind; label: string }[] = [
    { kind: 'lunch', label: 'Lunch' },
    { kind: 'dinner', label: 'Dinner' },
  ];
  private pressedOnBackdrop = false;

  protected changeDays(input: HTMLInputElement): void {
    this.store.setDays(Number(input.value));
    this.resetRejected(input, this.plan().days.length);
  }

  protected changePeople(input: HTMLInputElement): void {
    this.store.setPeople(Number(input.value));
    this.resetRejected(input, this.plan().people);
  }

  protected leftovers(kind: MealKind, day: number): string | null {
    return kind === 'lunch' ? leftoversOf(this.plan(), day) : null;
  }

  protected newPlan(dialog: HTMLDialogElement): void {
    if (this.filled() > 0 || this.plan().accepted) {
      // A leftover press from the last time would otherwise let a click without a press of its own
      // (element.click(), some assistive technology) close the dialog right after reopening
      this.pressedOnBackdrop = false;
      dialog.showModal();
    } else {
      this.store.newPlan();
    }
  }

  protected startNewPlan(dialog: HTMLDialogElement): void {
    this.store.newPlan();
    dialog.close();
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

  // A rejected value leaves the plan signal unchanged, so the binding alone wouldn't reset the field
  private resetRejected(input: HTMLInputElement, value: number): void {
    input.value = String(value);
  }
}
