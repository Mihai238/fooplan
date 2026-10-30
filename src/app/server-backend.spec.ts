import { DATA_FAILED, deferred, FakeSupabase, sessionFor } from './auth/testing';
import { ServerBackend } from './server-backend';

describe('ServerBackend', () => {
  let fake: FakeSupabase;
  let backend: ServerBackend;

  beforeEach(() => {
    fake = new FakeSupabase();
    fake.load(sessionFor('ana@example.com'));
    backend = new ServerBackend(fake.client, 'user-1', () => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the value of the user's row with the key, null without one, saves a value as that row with updated_at now, and rejects both with the client's error (#45 2)", async () => {
    const plan = { people: 2, days: [] };
    fake.saveRow('fooplan.plan', plan);

    expect(await backend.read('fooplan.plan')).toEqual(plan);
    expect(await backend.read('fooplan.removed'), 'no row').toBeNull();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:34:56.000Z'));
    const recipes = [{ name: 'Quick Dal', servings: 4, ingredients: [] }];
    await backend.write('fooplan.recipes', recipes);
    expect(fake.row('fooplan.recipes')).toEqual({
      user_id: 'user-1',
      key: 'fooplan.recipes',
      value: recipes,
      updated_at: '2026-10-30T12:34:56.000Z',
    });
    expect(await backend.read('fooplan.recipes'), 'read back').toEqual(recipes);
    expect(
      fake.tables.every((table) => table === 'user_data'),
      fake.tables.join(),
    ).toBe(true);

    fake.readError = DATA_FAILED;
    fake.writeError = DATA_FAILED;
    await expect(backend.read('fooplan.plan')).rejects.toBe(DATA_FAILED);
    await expect(backend.write('fooplan.recipes', [])).rejects.toBe(DATA_FAILED);
  });

  describe('edge cases', () => {
    it("reads null for a key only another user has a row for, and leaves that user's row as it was on a write (#45 2a)", async () => {
      fake.saveRow('fooplan.plan', { people: 3 }, 'user-2');

      expect(await backend.read('fooplan.plan')).toBeNull();
      await backend.write('fooplan.plan', { people: 2 });
      expect(fake.row('fooplan.plan', 'user-2')?.value).toEqual({ people: 3 });
      expect(fake.row('fooplan.plan')?.value).toEqual({ people: 2 });
    });

    it('keeps one row per key, holding the last value written (#45 2b)', async () => {
      await backend.write('fooplan.removed', ['Niçoise salad']);
      await backend.write('fooplan.removed', ['Fish tacos']);

      expect(fake.rows.filter((row) => row.key === 'fooplan.removed')).toHaveLength(1);
      expect(await backend.read('fooplan.removed')).toEqual(['Fish tacos']);
    });

    it('saves the later of two writes of one key started together, also when the first is answered last, sending the second only once the first is answered (#45 2d)', async () => {
      const first = deferred<void>();
      const sent: unknown[] = [];
      fake.beforeWrite = (row) => {
        sent.push(row.value);
        return sent.length === 1 ? first.promise : Promise.resolve();
      };

      const writes = [
        backend.write('fooplan.plan', { people: 2 }),
        backend.write('fooplan.plan', { people: 3 }),
      ];
      await new Promise((resolve) => setTimeout(resolve));
      expect(sent, 'sent before the first is answered').toEqual([{ people: 2 }]);
      first.resolve();
      await Promise.all(writes);
      expect(fake.row('fooplan.plan')?.value).toEqual({ people: 3 });
    });

    it('sends the next write of a key after one the server refused, and writes of other keys at once (#45 2e)', async () => {
      const first = deferred<void>();
      const sent: string[] = [];
      fake.beforeWrite = (row) => {
        sent.push(`${row.key} ${JSON.stringify(row.value)}`);
        return sent.length === 1
          ? first.promise.then(() => Promise.reject(DATA_FAILED))
          : Promise.resolve();
      };

      const failed = backend.write('fooplan.plan', { people: 2 });
      const other = backend.write('fooplan.removed', []);
      const next = backend.write('fooplan.plan', { people: 3 });
      await other;
      expect(sent).toEqual(['fooplan.plan {"people":2}', 'fooplan.removed []']);
      first.resolve();
      await expect(failed).rejects.toBe(DATA_FAILED);
      await next;
      expect(fake.row('fooplan.plan')?.value).toEqual({ people: 3 });
    });

    it('sends only the newest of the writes of a key waiting for the one being sent, settling all of them with it (#45 2f)', async () => {
      const first = deferred<void>();
      const sent: unknown[] = [];
      fake.beforeWrite = (row) => {
        sent.push(row.value);
        return sent.length === 1 ? first.promise : Promise.resolve();
      };

      const writes = [2, 3, 4].map((people) => backend.write('fooplan.plan', { people }));
      first.resolve();
      await Promise.all(writes);
      expect(sent).toEqual([{ people: 2 }, { people: 4 }]);
      expect(fake.row('fooplan.plan')?.value).toEqual({ people: 4 });
    });

    it('rejects a write waiting for another without sending it once its user is no longer signed in (#45 2g)', async () => {
      let signedIn = true;
      const ending = new ServerBackend(fake.client, 'user-1', () => signedIn);
      const first = deferred<void>();
      const sent: unknown[] = [];
      fake.beforeWrite = (row) => {
        sent.push(row.value);
        return first.promise;
      };

      const sending = ending.write('fooplan.plan', { people: 2 });
      const waiting = ending.write('fooplan.plan', { people: 3 });
      signedIn = false;
      first.resolve();
      await sending;
      await expect(waiting).rejects.toThrow();
      expect(sent).toEqual([{ people: 2 }]);
      await expect(ending.write('fooplan.removed', []), 'a write after it').rejects.toThrow();
      expect(sent.length).toBe(1);
    });

    it('rejects a read and a write the server does not answer in time, and sends the next write of that key (#45 2h)', async () => {
      const quick = new ServerBackend(fake.client, 'user-1', () => true, 20);
      const never = new Promise<void>(() => undefined);
      fake.beforeRead = () => never;
      let writes = 0;
      fake.beforeWrite = () => (++writes === 1 ? never : Promise.resolve());

      await expect(quick.read('fooplan.plan')).rejects.toMatchObject({
        message: expect.stringContaining('AbortError'),
      });
      await expect(quick.write('fooplan.plan', { people: 2 })).rejects.toMatchObject({
        message: expect.stringContaining('AbortError'),
      });
      await quick.write('fooplan.plan', { people: 3 });
      expect(fake.row('fooplan.plan')?.value).toEqual({ people: 3 });
    });

    it('rejects a write the server refuses, such as one for another user (#45 2c)', async () => {
      const other = new ServerBackend(fake.client, 'user-2', () => true);

      await expect(other.write('fooplan.plan', { people: 2 })).rejects.toMatchObject({
        code: '42501',
      });
      expect(fake.row('fooplan.plan', 'user-2')).toBeUndefined();
    });
  });
});
