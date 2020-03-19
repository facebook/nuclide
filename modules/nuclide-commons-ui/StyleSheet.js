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

type Props = {
  sourcePath: string,
  priority: number,
  css: string,
};

export default class StyleSheet extends React.PureComponent<Props> {
  _styleSheet: IDisposable;

  componentWillUnmount(): void {
    if (this._styleSheet != null) {
      this._styleSheet.dispose();
    }
  }

  componentDidMount(): void {
    this._updateStyleSheet();
  }

  componentDidUpdate(): void {
    this._updateStyleSheet();
  }

  render(): React.Node {
    return null;
  }

  _updateStyleSheet(): void {
    if (this._styleSheet != null) {
      this._styleSheet.dispose();
    }

    this._styleSheet = atom.styles.addStyleSheet(this.props.css, {
      sourcePath: this.props.sourcePath,
      priority: this.props.priority,
    });
  }
}
