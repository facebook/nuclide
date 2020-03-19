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

import * as React from 'react';
import {Observable, Subject} from 'rxjs';
import nullthrows from 'nullthrows';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type Props = {
  children?: React.Node,
};

type State = {
  height: ?number,
  isDragging: boolean,
  lastMouseDown: number,
};

export class DragResizeContainer extends React.Component<Props, State> {
  _disposables: UniversalDisposable;
  _resizeStarts: Subject<SyntheticMouseEvent<>>;
  _node: ?HTMLDivElement;

  constructor(props: Props) {
    super(props);
    this._resizeStarts = new Subject();
    this.state = {
      height: null,
      isDragging: false,
      lastMouseDown: 0,
    };
  }

  componentDidMount(): void {
    const el = nullthrows(this._node);

    this._disposables = new UniversalDisposable(
      this._resizeStarts
        .switchMap(startEvent => {
          // Only fire on primary mouse button
          if (startEvent.button !== 0) {
            return Observable.empty();
          }

          // Abort everything if double click
          const now = Date.now();
          if (now - this.state.lastMouseDown < 500) {
            this.setState({
              height: null,
              isDragging: false,
              lastMouseDown: now,
            });
            return Observable.empty();
          }

          this.setState({isDragging: true, lastMouseDown: now});
          const startY = startEvent.pageY;
          const startHeight = el.getBoundingClientRect().height;
          return Observable.fromEvent(document, 'mousemove')
            .takeUntil(Observable.fromEvent(document, 'mouseup'))
            .map(event => {
              const change = event.pageY - startY;
              return startHeight + change;
            })
            .do({
              complete: () => this.setState({isDragging: false}),
            });
        })
        .subscribe(height => this.setState({height})),
      atom.commands.add(el, 'resize-container:reset-height', () =>
        this.setState({height: null}),
      ),
      atom.contextMenu.add({
        '.nuclide-ui-drag-resize-container': [
          {
            label: 'Reset Height',
            command: 'resize-container:reset-height',
          },
        ],
      }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  render(): React.Node {
    const {height, isDragging} = this.state;
    const style = {};
    if (height == null) {
      style.maxHeight = '20vh';
    } else {
      style.height = height;
    }

    return (
      <div
        className="nuclide-ui-drag-resize-container"
        style={style}
        ref={node => (this._node = node)}>
        {this.props.children}
        <div
          className="nuclide-ui-drag-resize-container-handle"
          onMouseDown={event => this._resizeStarts.next(event)}>
          <div className="nuclide-ui-drag-resize-container-handle-line" />
          {isDragging ? (
            <div className="nuclide-ui-drag-resize-container-handle-overlay" />
          ) : null}
        </div>
      </div>
    );
  }
}
