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

import addTooltip from 'nuclide-commons-ui/addTooltip';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import * as React from 'react';
import classnames from 'classnames';
import {track} from 'nuclide-analytics';
import {AnalyticsActions} from '../constants';

const MAX_ERROR_LINE_LENGTH = 80;
const MAX_NUMBER_ERROR_LINES = 10;
const UPDATED_DELAY = 1000;

type Props = {
  data: {
    value: string,
    isError?: boolean,
    canUpdate?: boolean,
    update?: (value: string) => Promise<void>,
  },
};

type EditingState = 'none' | 'editing' | 'syncing' | 'updated' | 'error';

type State = {
  value: string,
  editingState: EditingState,
  editingValue: ?string,
};

export class AppInfoValueCell extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      value: props.data.value,
      editingState: 'none',
      editingValue: null,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.state.editingState === 'none') {
      this.setState({value: nextProps.data.value});
    }
  }

  _updateValue(newValue: string): Promise<void> {
    const updateFunction =
      this.props.data.update || (value => Promise.resolve());

    this._setEditingState('syncing');
    return updateFunction(newValue)
      .catch(error => {
        this._setEditingState('error');
      })
      .then(() => {
        this._setEditingState('syncing', {value: newValue});
      })
      .then(() => {
        setTimeout(
          () => this._setEditingState('none', {editingValue: null}),
          UPDATED_DELAY,
        );
      });
  }

  _prepareErrorMessage(error: string): string {
    return error
      .split(/\n/g)
      .filter(line => line.length > 0)
      .map(line => line.slice(0, MAX_ERROR_LINE_LENGTH))
      .slice(0, MAX_NUMBER_ERROR_LINES)
      .join('<br>');
  }

  _renderError(error: string): React.Node {
    return (
      <span
        className="icon icon-alert"
        // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
        ref={addTooltip({
          title: this._prepareErrorMessage(error),
          delay: 0,
        })}
      />
    );
  }

  _getEditingStateIcon(editingState: EditingState): string {
    switch (editingState) {
      case 'none':
        return 'pencil';
      case 'syncing':
        return 'sync';
      case 'updated':
        return 'check';
      case 'error':
        return 'alert';
      default:
        return '';
    }
  }

  _setEditingState(editingState: EditingState, otherState?: $Supertype<State>) {
    const newState = {...otherState, editingState};
    track(AnalyticsActions.APPINFOVALUECELL_UI_EDITINGSTATECHANGE, newState);
    this.setState(newState);
  }

  _renderEditableValue(value: any): React.Node {
    const {editingState} = this.state;
    const editingValue =
      this.state.editingValue == null ? value : this.state.editingValue;

    if (editingState === 'editing') {
      return (
        <AtomInput
          tabIndex="-1"
          autofocus={true}
          size="sm"
          defaultValue={value}
          value={editingValue}
          onDidChange={newValue => this.setState({editingValue: newValue})}
          onBlur={() => this._updateValue(editingValue)}
          onConfirm={() => this._updateValue(editingValue)}
        />
      );
    } else {
      return (
        <div>
          {value}
          <span
            role="button"
            tabIndex="0"
            className={classnames(
              'icon',
              'nuclide-device-panel-app-info-button',
              'icon-' + this._getEditingStateIcon(this.state.editingState),
              {
                'nuclide-device-panel-app-info-button-edit':
                  this.state.editingState === 'none',
              },
            )}
            onClick={() => {
              if (this.state.editingState === 'none') {
                this._setEditingState('editing');
              }
            }}
          />
        </div>
      );
    }
  }

  render(): React.Node {
    const {canUpdate, isError} = this.props.data;
    const {value} = this.state;

    if (isError) {
      track(AnalyticsActions.APPINFOVALUECELL_UI_ERROR);
      return this._renderError(value);
    }

    if (this.state.editingState === 'none') {
      track(AnalyticsActions.APPINFOVALUECELL_UI_VALUE);
    }

    if (canUpdate) {
      return this._renderEditableValue(value);
    }

    return value;
  }
}
