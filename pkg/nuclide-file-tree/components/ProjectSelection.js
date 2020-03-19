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

import type Immutable from 'immutable';
import type {AppState} from '../lib/types';

import * as React from 'react';
import {connect} from 'react-redux';
import * as Selectors from '../lib/redux/Selectors';
import TruncatedButton from 'nuclide-commons-ui/TruncatedButton';

type Props = {|
  remeasureHeight: () => mixed,
  extraContent: Immutable.List<React.Element<any>>,
|};

class ProjectSelection extends React.PureComponent<Props> {
  componentDidUpdate(): void {
    this.props.remeasureHeight();
  }

  render(): React.Node {
    // The only time we re-render is when this prop changes, so no need to memoize this. If this
    // component had a bunch of other props, the story might be different.
    const renderedExtraContent = this.props.extraContent.isEmpty()
      ? null
      : this.props.extraContent.toArray();

    return (
      <div className="padded">
        <TruncatedButton
          onClick={() => this.runCommand('application:add-project-folder')}
          icon="device-desktop"
          label="Add Local Folder"
        />
        <TruncatedButton
          onClick={() => this.runCommand('nuclide-remote-projects:connect')}
          icon="cloud-upload"
          label="Add Remote Folder"
        />
        {renderedExtraContent}
      </div>
    );
  }

  runCommand(command: string): void {
    atom.commands.dispatch(atom.views.getView(atom.workspace), command);
  }
}

const mapStateToProps = (state: AppState): $Shape<Props> => ({
  extraContent: Selectors.getExtraProjectSelectionContent(state),
});

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export default connect(
  mapStateToProps,
  () => ({}),
)(ProjectSelection);
