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

import React from 'react';

import type {DOMMeasurements} from '../commons-atom/observe-element-dimensions';

import {observeElementDimensions} from '../commons-atom/observe-element-dimensions';

type Props = {
  onMeasurementsChanged: (measurements: DOMMeasurements) => void,
  children?: React.Element<any>,
};

/** A container which invokes a callback function supplied in props whenever the
 * container's height and width measurements change. The callback is invoked once
 * when the MeasuredComponent has mounted.
 */
export class MeasuredComponent extends React.Component {
  props: Props;
  // Listens to the container DOM node for mutations
  _mutationObserverSubscription: rxjs$ISubscription;
  _domNode: ?HTMLElement;

  _updateDomNode = (node: ?HTMLElement): void => {
    if (node == null) {
      this._domNode = null;
      // _updateDomNode is called before component unmount, so don't need to unsubscribe()
      // in componentWillUnmount()
      this._mutationObserverSubscription.unsubscribe();
      return;
    }
    this._mutationObserverSubscription = observeElementDimensions(
      node,
    ).subscribe(this.props.onMeasurementsChanged);
    this._domNode = node;
  };

  render(): React.Element<any> {
    return (
      <div ref={this._updateDomNode}>
        {this.props.children}
      </div>
    );
  }
}
