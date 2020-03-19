/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import waitsFor, {waitsForAsync} from '../waits_for';

it('waits', async () => {
  let condition = false;
  Promise.resolve().then(() => (condition = true));
  await waitsFor(() => condition);
});

it("can't wait anymore", async () => {
  await expect(
    waitsFor(() => false, undefined, 1),
  ).rejects.toThrowErrorMatchingSnapshot();
});

it('gives a message', async () => {
  await expect(
    waitsFor(() => false, 'lol', 1),
  ).rejects.toThrowErrorMatchingSnapshot();
});

it('waits an async predicate', async () => {
  const fn = jest
    .fn()
    .mockImplementationOnce(
      () => new Promise(res => setTimeout(() => res(false))),
    )
    .mockImplementationOnce(
      () => new Promise(res => setTimeout(() => res(true))),
    )
    .mockImplementationOnce(
      () => new Promise(res => setTimeout(() => res(false))),
    );

  await waitsFor(() => fn());
  expect(fn).toHaveBeenCalledTimes(2);
});

it('returns a value', async () => {
  let someVar;
  setTimeout(() => (someVar = 'hello'), 200);
  const value: string = await waitsFor(() => someVar);
  expect(value).toBe('hello');
});

it('returns value from a promise', async () => {
  let someVar;
  setTimeout(() => (someVar = 'hello'), 200);
  const value: string = await waitsForAsync(() => Promise.resolve(someVar));
  expect(value).toBe('hello');
});

test('stack trace points to the callsite, not the implementation', async () => {
  const fail = () => waitsFor(() => false, 'yea', 1);
  expect.assertions(1);
  try {
    await fail();
  } catch (e) {
    expect(e.stack).not.toMatch(/waits_for\.js/);
  }
});
