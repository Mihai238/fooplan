import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { SessionBackend } from './session-backend';
import { StorageBackend } from './storage';

describe('appConfig', () => {
  it("gives the stores the session's backend (#45 3d)", () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });

    expect(TestBed.inject(StorageBackend)).toBe(TestBed.inject(SessionBackend));
  });
});
