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
import singleton from '../singleton';

describe('singleton', () => {
  let count = 0;
  const field = 'singleton-test-field';

  function get() {
    return singleton.get(field, () => {
      return count++;
    });
  }

  function clear() {
    singleton.clear(field);
  }

  function reset() {
    return singleton.reset(field, () => {
      return count++;
    });
  }

  it('get', () => {
    const id1 = get();
    const id2 = get();
    expect(id1).toEqual(id2);
  });

  it('clear', () => {
    const id1 = get();

    clear();

    const id2 = get();
    expect(id2 !== id1).toBe(true);
  });

  it('reset', () => {
    const id1 = get();

    const id2 = reset();
    expect(id2).not.toEqual(id1);

    const id3 = get();
    expect(id3).toEqual(id2);
  });
});
