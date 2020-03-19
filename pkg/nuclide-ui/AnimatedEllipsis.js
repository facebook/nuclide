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

import * as React from 'react';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {};
type State = {n: number};

const DOT_ANIMATION_INTERVAL = 500; /* ms */
export default class AnimatedEllipsis extends React.Component<Props, State> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {
      n: 0,
    };
  }

  componentDidMount(): void {
    this._disposables.add(
      Observable.interval(DOT_ANIMATION_INTERVAL).subscribe(_ =>
        // TODO: (wbinnssmith) T30771435 this setState depends on current state
        // and should use an updater function rather than an object
        // eslint-disable-next-line react/no-access-state-in-setstate
        this.setState({n: this.state.n + 1}),
      ),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  render(): React.Node {
    const ellipsis = new Array(this.state.n % 4).fill('.').join('');
    return <span className="nuclide-ui-animated-ellipsis">{ellipsis}</span>;
  }
}
