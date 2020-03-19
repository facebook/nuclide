/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import * as React from 'react';

import {ResizeObservable} from './observable-dom';
import invariant from 'assert';

type Props = {
  onMeasurementsChanged: (
    measurements: DOMRectReadOnly,
    target: HTMLElement,
  ) => mixed,
  children?: React.Element<any>,
};

/** A container which invokes a callback function supplied in props whenever the
 * container's height and width measurements change. The callback is invoked once
 * when the MeasuredComponent has mounted.
 */
export class MeasuredComponent extends React.Component<Props> {
  // Listens to the container DOM node for mutations
  _resizeSubscription: rxjs$ISubscription;
  _domNode: ?HTMLElement;

  _updateDomNode = (node: ?HTMLElement): void => {
    if (node == null) {
      this._domNode = null;
      // _updateDomNode is called before component unmount, so don't need to unsubscribe()
      // in componentWillUnmount()
      this._resizeSubscription.unsubscribe();
      return;
    }
    this._resizeSubscription = new ResizeObservable(node).subscribe(entries => {
      invariant(entries.length === 1);
      this.props.onMeasurementsChanged(
        entries[0].contentRect,
        entries[0].target,
      );
    });
    this._domNode = node;
  };

  render(): React.Node {
    const {onMeasurementsChanged, ...passThroughProps} = this.props;
    return <div ref={this._updateDomNode} {...passThroughProps} />;
  }
}
