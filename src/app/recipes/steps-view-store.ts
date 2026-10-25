import { Injectable, signal } from '@angular/core';
import { readStoredText, writeStoredText } from '../storage';

export type StepsView = 'steps' | 'all';

const STORAGE_KEY = 'fooplan.stepsView';

@Injectable({ providedIn: 'root' })
export class StepsViewStore {
  private readonly state = signal<StepsView>(readView());
  readonly view = this.state.asReadonly();

  set(view: StepsView): void {
    this.state.set(view);
    writeStoredText(STORAGE_KEY, view);
  }
}

function readView(): StepsView {
  return readStoredText(STORAGE_KEY) === 'all' ? 'all' : 'steps';
}
