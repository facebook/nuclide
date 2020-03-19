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
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {Observable} from 'rxjs';
import {track} from 'nuclide-commons/analytics';

const MAGIC_DATA_TRANSFER_KEY = 'nuclide-draggable-file';

export default class DraggableFile extends React.Component<{
  uri: NuclideUri,
  trackingSource: string,
  draggable?: boolean,
}> {
  _disposables: UniversalDisposable;

  componentDidMount() {
    const el = ReactDOM.findDOMNode(this);

    this._disposables = new UniversalDisposable(
      // Because this element can be inside of an Atom panel (which adds its own drag and drop
      // handlers) we need to sidestep React's event delegation.
      Observable.fromEvent(el, 'dragstart').subscribe(this._onDragStart),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  _onDragStart = (e: DragEvent) => {
    const {dataTransfer} = e;
    if (dataTransfer != null) {
      dataTransfer.effectAllowed = 'move';
      dataTransfer.setData('initialPath', this.props.uri);
      // For security reasons, dragEnter events can't see the values of
      // `dataTransfer`, just the keys. So, we use a unique key to enable other
      // components to infer if a drag event contains a draggable file.
      dataTransfer.setData(MAGIC_DATA_TRANSFER_KEY, '');

      // Allow draggable files to be dragged into the tab bar.
      dataTransfer.setData('text/plain', this.props.uri);
      dataTransfer.setData('atom-event', 'true');
      dataTransfer.setData('allow-all-locations', 'true');
      track('draggable-file:drag-start', {
        source: this.props.trackingSource,
        uri: this.props.uri,
      });
    }
  };

  render() {
    const {uri, trackingSource, draggable = true, ...restProps} = this.props;
    // https://discuss.atom.io/t/drag-drop/21262/14
    const tabIndex = -1;
    return <div draggable={draggable} tabIndex={tabIndex} {...restProps} />;
  }
}

export function dragEventCameFromDraggableFile(event: DragEvent) {
  const {dataTransfer} = event;
  if (dataTransfer == null) {
    return false;
  }
  return dataTransfer.types.includes(MAGIC_DATA_TRANSFER_KEY);
}
