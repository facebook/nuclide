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

import type {Store} from '../lib/types';

import * as React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {WorkingSetSelectionComponent} from './WorkingSetSelectionComponent';
import {WorkingSetNameAndSaveComponent} from './WorkingSetNameAndSaveComponent';
import * as Selectors from '../lib/redux/Selectors';
import * as Actions from '../lib/redux/Actions';
import {WorkingSet} from '../../nuclide-working-sets-common';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {ButtonGroup, ButtonGroupSizes} from 'nuclide-commons-ui/ButtonGroup';

import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';

type Props = {
  workingSetsStore: WorkingSetsStore,
  store: Store,
};

type State = {
  selectionIsActive: boolean,
  definitionsAreEmpty: boolean,
  isUpdatingExistingWorkingSet: boolean,
  updatedWorkingSetName: string,
};

export class FileTreeToolbarComponent extends React.Component<Props, State> {
  _disposables: UniversalDisposable;
  _inProcessOfClosingSelection: boolean;
  _prevName: string;
  _closeWorkingSetsSelector: ?() => void;

  constructor(props: Object) {
    super(props);

    this.state = {
      selectionIsActive: false,
      definitionsAreEmpty: props.workingSetsStore.getDefinitions().length === 0,
      isUpdatingExistingWorkingSet: false,
      updatedWorkingSetName: '',
    };

    this._inProcessOfClosingSelection = false;

    this._disposables = new UniversalDisposable(
      props.workingSetsStore.subscribeToDefinitions(definitions => {
        const empty =
          definitions.applicable.length + definitions.notApplicable.length ===
          0;
        this.setState({definitionsAreEmpty: empty});
      }),
    );
  }

  componentDidMount(): void {
    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        // This command is exposed in the nuclide-working-sets menu config.
        // eslint-disable-next-line nuclide-internal/atom-apis
        'working-sets:select-active',
        this._toggleWorkingSetsSelector,
      ),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (!prevState.selectionIsActive && this.state.selectionIsActive) {
      this._closeWorkingSetsSelector = this._renderWorkingSetSelectionPanel();
    } else if (prevState.selectionIsActive && !this.state.selectionIsActive) {
      invariant(this._closeWorkingSetsSelector);
      this._closeWorkingSetsSelector();
    }
  }

  render(): React.Node {
    const workingSetsStore = Selectors.getWorkingSetsStore(
      this.props.store.getState(),
    );
    let shouldShowButtonLabel;
    if (workingSetsStore != null) {
      shouldShowButtonLabel = workingSetsStore.getDefinitions().length === 0;
    }
    const workingSet = Selectors.getWorkingSet(this.props.store.getState());
    const editedWorkingSetIsEmpty = Selectors.isEditedWorkingSetEmpty(
      this.props.store.getState(),
    );
    const isEditingWorkingSet = Selectors.getIsEditingWorkingSet(
      this.props.store.getState(),
    );

    let selectWorkingSetButton;
    if (!this.state.definitionsAreEmpty && !isEditingWorkingSet) {
      selectWorkingSetButton = (
        <SelectWorkingSetButton
          onClick={this._toggleWorkingSetsSelector}
          onFocus={this._checkIfClosingSelector}
          isWorkingSetEmpty={workingSet.isEmpty()}
        />
      );
    }

    let workingSetNameAndSave;
    if (isEditingWorkingSet && !editedWorkingSetIsEmpty) {
      workingSetNameAndSave = (
        <WorkingSetNameAndSaveComponent
          isEditing={this.state.isUpdatingExistingWorkingSet}
          initialName={this.state.updatedWorkingSetName}
          onUpdate={this._updateWorkingSet}
          onSave={this._saveWorkingSet}
          onCancel={this._toggleWorkingSetEditMode}
        />
      );
    }

    return (
      <div
        className={classnames({
          'nuclide-file-tree-toolbar': true,
          'nuclide-file-tree-toolbar-fader':
            workingSet.isEmpty() &&
            !this.state.selectionIsActive &&
            !Selectors.getIsEditingWorkingSet(this.props.store.getState()),
        })}>
        <ButtonGroup className="pull-right" size={ButtonGroupSizes.SMALL}>
          {selectWorkingSetButton}
          {/* $FlowFixMe(>=0.53.0) Flow suppress */}
          <DefineWorkingSetButton
            isActive={isEditingWorkingSet}
            isWorkingSetEmpty={workingSet.isEmpty()}
            shouldShowLabel={shouldShowButtonLabel}
            onClick={this._toggleWorkingSetEditMode}
          />
        </ButtonGroup>
        <div className="clearfix" />
        {workingSetNameAndSave}
      </div>
    );
  }

  _toggleWorkingSetsSelector = (): void => {
    if (this._inProcessOfClosingSelection) {
      this._inProcessOfClosingSelection = false;
      return;
    }

    if (this.state.definitionsAreEmpty && !this.state.selectionIsActive) {
      return;
    }

    // TODO: (wbinnssmith) T30771435 this setState depends on current state
    // and should use an updater function rather than an object
    // eslint-disable-next-line react/no-access-state-in-setstate
    this.setState({selectionIsActive: !this.state.selectionIsActive});
  };

  _renderWorkingSetSelectionPanel(): () => void {
    const reactDiv = document.createElement('div');
    const panel = atom.workspace.addModalPanel({item: reactDiv});

    let closed = false;
    const onClose = () => {
      if (closed) {
        return;
      }
      closed = true;

      ReactDOM.unmountComponentAtNode(reactDiv);
      panel.destroy();
      this.setState({selectionIsActive: false});
    };

    ReactDOM.render(
      <WorkingSetSelectionComponent
        workingSetsStore={this.props.workingSetsStore}
        onClose={onClose}
        onEditWorkingSet={this._editWorkingSet}
      />,
      reactDiv,
    );

    return onClose;
  }

  _toggleWorkingSetEditMode = (): void => {
    if (Selectors.getIsEditingWorkingSet(this.props.store.getState())) {
      this._finishEditingWorkingSet();
    } else {
      this._startEditingWorkingSet(new WorkingSet());
    }
  };

  _saveWorkingSet = (name: string): void => {
    const workingSetsStore = Selectors.getWorkingSetsStore(
      this.props.store.getState(),
    );
    invariant(workingSetsStore);

    const editedWorkingSet = Selectors.getEditedWorkingSet(
      this.props.store.getState(),
    );
    this._finishEditingWorkingSet();
    workingSetsStore.saveWorkingSet(name, editedWorkingSet);
    workingSetsStore.activate(name);
  };

  _updateWorkingSet = (prevName: string, name: string): void => {
    const workingSetsStore = Selectors.getWorkingSetsStore(
      this.props.store.getState(),
    );
    invariant(workingSetsStore);
    const editedWorkingSet = Selectors.getEditedWorkingSet(
      this.props.store.getState(),
    );
    this._finishEditingWorkingSet();

    workingSetsStore.update(prevName, name, editedWorkingSet);
  };

  _checkIfClosingSelector = (): void => {
    if (this.state.selectionIsActive) {
      this._inProcessOfClosingSelection = true;
    }
  };

  _editWorkingSet = (name: string, uris: Array<string>): void => {
    this._prevName = name;
    this.setState({
      isUpdatingExistingWorkingSet: true,
      updatedWorkingSetName: name,
      selectionIsActive: false,
    });
    this._startEditingWorkingSet(new WorkingSet(uris));
  };

  _startEditingWorkingSet(workingSet: WorkingSet): void {
    this.props.store.dispatch(Actions.startEditingWorkingSet(workingSet));
  }

  _finishEditingWorkingSet(): void {
    this.setState({
      isUpdatingExistingWorkingSet: false,
      updatedWorkingSetName: '',
    });
    this.props.store.dispatch(Actions.finishEditingWorkingSet());
  }
}

class SelectWorkingSetButton extends React.Component<{
  isWorkingSetEmpty: boolean,
  onClick: () => void,
  onFocus: () => void,
}> {
  render(): React.Node {
    const {isWorkingSetEmpty, onClick, onFocus} = this.props;
    return (
      <Button
        icon="pencil"
        onClick={onClick}
        onFocus={onFocus}
        selected={!isWorkingSetEmpty}
        size={ButtonSizes.SMALL}
        tooltip={{
          title: 'Select Working Sets',
          delay: 300,
          placement: 'top',
          keyBindingCommand: 'working-sets:select-active',
        }}>
        Working Sets...
      </Button>
    );
  }
}

class DefineWorkingSetButton extends React.Component<{
  isActive: boolean,
  isWorkingSetEmpty: boolean,
  shouldShowLabel: boolean,
  onClick: () => void,
}> {
  render(): React.Node {
    const {isActive, isWorkingSetEmpty, shouldShowLabel, onClick} = this.props;
    return (
      <Button
        icon={isActive ? undefined : 'plus'}
        size={ButtonSizes.SMALL}
        tooltip={{
          title: isActive ? 'Cancel' : 'Define a Working Set',
          delay: 300,
          placement: 'top',
        }}
        onClick={onClick}>
        {isActive
          ? 'Cancel selection'
          : isWorkingSetEmpty && shouldShowLabel
            ? 'Working Set...'
            : null}
      </Button>
    );
  }
}
