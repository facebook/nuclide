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

import {TextBuffer} from 'atom';
import {AtomTextEditor} from 'nuclide-commons-ui/AtomTextEditor';
import {Message, MessageTypes} from 'nuclide-commons-ui/Message';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as React from 'react';

type Props = {
  contents: string,
  uri: string,
};

export default class RemoteTextEditorPlaceholderComponent extends React.PureComponent<
  Props,
> {
  render(): React.Node {
    const {hostname} = nuclideUri.parseRemoteUri(this.props.uri);
    return (
      <div className="nuclide-remote-text-editor-placeholder">
        <Message
          className="nuclide-remote-text-editor-placeholder-header"
          type={MessageTypes.info}>
          <strong>This is a read-only preview.</strong>
          <br />
          Please reconnect to the remote host {hostname} to edit or save this
          file.
        </Message>
        <AtomTextEditor
          readOnly={true}
          textBuffer={
            new TextBuffer({
              filePath: this.props.uri,
              text: this.props.contents,
            })
          }
        />
      </div>
    );
  }
}
