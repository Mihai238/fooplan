import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { isComplete, leftoversOf, MAX_DAYS, MealKind, MIN_DAYS } from '../plan';
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
  protected readonly minDays = MIN_DAYS;
  protected readonly maxDays = MAX_DAYS;
  protected readonly meals: readonly { kind: MealKind; label: string }[] = [
    { kind: 'lunch', label: 'Lunch' },
    { kind: 'dinner', label: 'Dinner' },
  ];

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

  protected newPlan(): void {
    if (window.confirm('Discard this plan and start a new one?')) {
      this.store.newPlan();
    }
  }

  // A rejected value leaves the plan signal unchanged, so the binding alone wouldn't reset the field
  private resetRejected(input: HTMLInputElement, value: number): void {
    input.value = String(value);
  }
}
