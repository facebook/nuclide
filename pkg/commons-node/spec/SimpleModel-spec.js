/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import {SimpleModel} from '../SimpleModel';
import {Observable} from 'rxjs';

type State = {
  count: number,
  other: boolean,
};

class TestModel extends SimpleModel {
  state: State;
  constructor() {
    super();
    this.state = {
      count: 0,
      other: true,
    };
  }
}

describe('SimpleModel', () => {
  it('updates state when setState is called', () => {
    const model = new TestModel();
    model.setState({count: 5});
    expect(model.state.count).toBe(5);
  });

  it('only changes the provided values when setState is called', () => {
    const model = new TestModel();
    model.setState({count: 5});
    expect(model.state.other).toBe(true);
  });

  it('can be converted to an observable', () => {
    waitsForPromise(async () => {
      const model = new TestModel();
      // $FlowFixMe: Teach Flow about Symbol.observable
      const states = Observable.from(model).take(2).toArray().toPromise();
      model.setState({count: 5});
      expect(await states).toEqual([
        {count: 0, other: true},
        {count: 5, other: true},
      ]);
    });
  });
});
