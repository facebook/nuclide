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
import {MultiSelectList} from '../../nuclide-ui/MultiSelectList';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type PropsType = {
  options: Array<{value: string, label: string}>,
  selectedConnection: string,
  connectionChanged: (newValue: ?string) => void,
  dialogCloser: () => void,
};

export class DebuggerLaunchAttachConnectionChooser
  extends React.Component<void, PropsType, void> {
  props: PropsType;
  _disposables: UniversalDisposable;

  constructor(props: PropsType) {
    super(props);

    this._disposables = new UniversalDisposable();
    this._disposables.add(
      atom.commands.add('atom-workspace', {
        'core:cancel': () => {
          this.props.dialogCloser();
        },
      }),
    );
  }

  render(): React.Element<any> {
    return (
      <div className="padded nuclide-debugger-launch-attach-container">
        <h1 className="nuclide-debugger-launch-attach-header">
          Change debugger connection:
        </h1>
        <MultiSelectList
          commandScope={atom.views.getView(atom.workspace)}
          value={[this.props.selectedConnection]}
          options={this.props.options}
          onChange={activeValues =>
            this.props.connectionChanged(
              activeValues.length > 0
                ? activeValues[activeValues.length - 1]
                : null,
            )}
        />
        <div className="nuclide-debugger-launch-attach-actions">
          <ButtonGroup>
            <Button
              onClick={() =>
                atom.commands.dispatch(
                  atom.views.getView(atom.workspace),
                  'core:cancel',
                )}>
              Cancel
            </Button>
          </ButtonGroup>
        </div>
      </div>
    );
  }
}
