/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import ReactDOM from 'react-dom';
import * as React from 'react';

type BlockDecorationProps = {
  range: atom$Range,
  editor: atom$TextEditor,
  children: React.Node,
};

export default class BlockDecoration extends React.Component<
  BlockDecorationProps,
> {
  _marker: atom$Marker;
  _item: HTMLElement;
  constructor(props: BlockDecorationProps) {
    super(props);
    this._item = document.createElement('div');
  }

  componentDidMount() {
    this._createMarker();
  }

  componentWillUnmount() {
    this._marker.destroy();
  }

  componentDidUpdate(prevProps: BlockDecorationProps) {
    if (prevProps.editor !== this.props.editor) {
      this._createMarker();
    } else if (!prevProps.range.isEqual(this.props.range)) {
      this._marker.setBufferRange(this.props.range);
    }
  }

  _createMarker() {
    if (this._marker) {
      this._marker.destroy();
    }
    const {range, editor} = this.props;
    this._marker = editor.markBufferRange(range);

    editor.decorateMarker(this._marker, {
      type: 'block',
      position: 'after',
      item: this._item,
    });
  }

  render() {
    return ReactDOM.createPortal(this.props.children, this._item);
  }
}
