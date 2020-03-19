/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import Model from '../Model';

describe('Model', () => {
  it('setStates state when setState is called', () => {
    const model = new Model({count: 0, other: true});
    model.setState({count: 5});
    expect(model.state.count).toBe(5);
  });

  it('only changes the provided values when setState is called', () => {
    const model = new Model({count: 0, other: true});
    model.setState({count: 5});
    expect(model.state.other).toBe(true);
  });

  it('can be converted to an observable', async () => {
    const model = new Model({count: 0, other: true});
    const states = model
      .toObservable()
      .take(2)
      .toArray()
      .toPromise();
    model.setState({count: 5});
    expect(await states).toEqual([
      {count: 0, other: true},
      {count: 5, other: true},
    ]);
  });
});
