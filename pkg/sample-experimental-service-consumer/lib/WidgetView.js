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

import {Subject, ReplaySubject, Observable} from 'rxjs';

type State = {count: number};

export default class WidgetView {
  componentId = 'sample-experimental-service-consumer.WidgetComponent';
  _updates: Subject<State> = new Subject();
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _disposed = new ReplaySubject(1);
  state: State = {count: 0};

  get updates(): Observable<State> {
    return this._updates.takeUntil(this._disposed);
  }

  setState(state: State): void {
    this.state = {...this.state, ...state};
    this._updates.next(this.render());
  }

  render(): State {
    return this.state;
  }

  handleAction(action: Object) {
    // TODO: Type action
    switch (action.type) {
      case 'increment':
        // TODO: (wbinnssmith) T30771435 this setState depends on current state
        // and should use an updater function rather than an object
        // eslint-disable-next-line react/no-access-state-in-setstate
        this.setState({count: this.state.count + 1});
        break;
      case 'decrement':
        // TODO: (wbinnssmith) T30771435 this setState depends on current state
        // and should use an updater function rather than an object
        // eslint-disable-next-line react/no-access-state-in-setstate
        this.setState({count: this.state.count - 1});
        break;
      default:
        throw new Error(`Invalid action type: ${action.type}`);
    }
  }

  dispose(): void {
    this._disposed.next();
  }
}
