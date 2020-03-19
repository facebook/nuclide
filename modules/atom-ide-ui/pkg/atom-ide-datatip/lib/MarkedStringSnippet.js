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

import {TextBuffer} from 'atom';
import * as React from 'react';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';

// Complex types can end up being super long. Truncate them.
const MAX_LENGTH = 100;

type Props = {
  value: string,
  grammar: atom$Grammar,
};

type State = {
  isExpanded: boolean,
};

export default class MarkedStringSnippet extends React.Component<Props, State> {
  state = {
    isExpanded: false,
  };

  render(): React.Node {
    const {grammar, value} = this.props;
    const shouldTruncate = value.length > MAX_LENGTH && !this.state.isExpanded;
    const buffer = new TextBuffer(
      shouldTruncate ? value.substr(0, MAX_LENGTH) + '...' : value,
    );
    return (
      <div
        className="datatip-marked-text-editor-container"
        onClick={(e: SyntheticEvent<>) => {
          // TODO: (wbinnssmith) T30771435 this setState depends on current state
          // and should use an updater function rather than an object
          // eslint-disable-next-line react/no-access-state-in-setstate
          this.setState({isExpanded: !this.state.isExpanded});
          e.stopPropagation();
        }}>
        <AtomTextEditor
          className="datatip-marked-text-editor"
          gutterHidden={true}
          readOnly={true}
          syncTextContents={false}
          autoGrow={true}
          grammar={grammar}
          textBuffer={buffer}
        />
      </div>
    );
  }
}
