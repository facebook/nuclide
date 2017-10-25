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

import type {TextBuffer} from 'atom';

import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import * as React from 'react';

type Props = {
  textBuffer: TextBuffer,
};

export default class Console extends React.Component<Props> {
  render() {
    return (
      <AtomTextEditor
        gutterHidden={true}
        path=".ansi"
        readOnly={true}
        textBuffer={this.props.textBuffer}
      />
    );
  }
}
