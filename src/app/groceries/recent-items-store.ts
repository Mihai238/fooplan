import { Injectable, signal } from '@angular/core';
import { readStored, writeStored } from '../storage';
import { forget, parseRecentItems, remember } from './recent-items';

const STORAGE_KEY = 'fooplan.recentItems';

@Injectable({ providedIn: 'root' })
export class RecentItemsStore {
  private readonly state = signal<readonly string[]>(parseRecentItems(readStored(STORAGE_KEY)));
  readonly items = this.state.asReadonly();

  remember(text: string): void {
    this.update(remember(this.items(), text));
  }

  forget(text: string): void {
    this.update(forget(this.items(), text));
  }

  private update(items: readonly string[]): void {
    if (items !== this.items()) {
      this.state.set(items);
      writeStored(STORAGE_KEY, items);
    }
  }
}
