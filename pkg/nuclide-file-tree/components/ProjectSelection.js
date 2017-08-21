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
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {FileTreeStore} from '../lib/FileTreeStore';
import TruncatedButton from 'nuclide-commons-ui/TruncatedButton';

type Props = {};

type State = {
  extraContent: ?Array<React.Element<any>>,
};

export class ProjectSelection extends React.Component {
  _store: FileTreeStore;
  _disposables: UniversalDisposable;
  state: State;

  constructor(props: Props) {
    super(props);
    this._store = FileTreeStore.getInstance();
    this._disposables = new UniversalDisposable();
    this.state = {
      extraContent: this.calculateExtraContent(),
    };
  }

  componentDidMount(): void {
    this._processExternalUpdate();

    this._disposables.add(
      this._store.subscribe(this._processExternalUpdate.bind(this)),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _processExternalUpdate(): void {
    if (this._disposables.disposed) {
      // If an emitted event results in the disposal of a subscription to that
      // same emitted event, the disposal will not take effect until the next
      // emission. This is because event-kit handler arrays are immutable.
      //
      // Since this method subscribes to store updates, and store updates can
      // also cause this component to become unmounted, there is a possiblity
      // that the subscription disposal in `componentWillUnmount` may not
      // prevent this method from running on an unmounted instance. So, we
      // manually check the component's mounted state.
      return;
    }
    this.setState({
      extraContent: this.calculateExtraContent(),
    });
  }

  calculateExtraContent() {
    const list = this._store.getExtraProjectSelectionContent();
    if (list.isEmpty()) {
      return null;
    }
    return list.toJS();
  }

  render(): React.Element<any> {
    return (
      <div className="padded">
        <TruncatedButton
          onClick={() => this.runCommand('application:add-project-folder')}
          icon="device-desktop"
          label="Add Project Folder"
        />
        <TruncatedButton
          onClick={() => this.runCommand('nuclide-remote-projects:connect')}
          icon="cloud-upload"
          label="Add Remote Project Folder"
        />
        {this.state.extraContent}
      </div>
    );
  }

  runCommand(command: string): void {
    atom.commands.dispatch(atom.views.getView(atom.workspace), command);
  }
}
