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

import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {Portal} from '../../../nuclide-ui/Portal';
import React from 'react';

type Props = {
  checked: boolean,
  editor: atom$TextEditor,
  lineNumber: number,
  onToggleLine: () => mixed,
};

const GUTTER_NAME = 'nuclide-patch-editor-checkbox-gutter';

export class GutterCheckbox extends React.Component {
  props: Props;
  _gutter: atom$Gutter;
  _marker: atom$Marker;
  _node: HTMLElement;

  constructor(props: Props) {
    super(props);

    this._node = document.createElement('div');

    let gutter = props.editor.gutterWithName(GUTTER_NAME);
    if (gutter == null) {
      gutter = props.editor.addGutter({name: GUTTER_NAME});
    }
    this._gutter = gutter;

    this._marker = props.editor.markBufferPosition([props.lineNumber, 0], {
      invalidate: 'never',
    });

    gutter.decorateMarker(this._marker, {type: 'gutter', item: this._node});
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return nextProps.checked !== this.props.checked;
  }

  componentWillUnmount(): void {
    this._marker.destroy();
  }

  render(): React.Element<any> {
    return (
      <Portal container={this._node}>
        <Checkbox
          checked={this.props.checked}
          className="nuclide-patch-editor-line-checkbox"
          onChange={this.props.onToggleLine}
        />
      </Portal>
    );
  }
}
