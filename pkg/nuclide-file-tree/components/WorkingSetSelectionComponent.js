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

import type {
  WorkingSetDefinition,
  WorkingSetsStore,
} from '../../nuclide-working-sets/lib/types';

import classnames from 'classnames';
import * as React from 'react';
import ReactDOM from 'react-dom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {HR} from 'nuclide-commons-ui/HR';

type Props = {
  workingSetsStore: WorkingSetsStore,
  onClose: () => void,
  onEditWorkingSet: (name: string, uris: Array<string>) => void,
};

type State = {
  selectionIndex: number,
  applicableDefinitions: Array<WorkingSetDefinition>,
  notApplicableDefinitions: Array<WorkingSetDefinition>,
};

export class WorkingSetSelectionComponent extends React.Component<
  Props,
  State,
> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);

    const workingSetsStore = props.workingSetsStore;

    this.state = {
      selectionIndex: 0,
      applicableDefinitions: workingSetsStore.getApplicableDefinitions(),
      notApplicableDefinitions: workingSetsStore.getNotApplicableDefinitions(),
    };

    this._disposables = new UniversalDisposable(
      workingSetsStore.subscribeToDefinitions(definitions => {
        this.setState({
          applicableDefinitions: definitions.applicable,
          notApplicableDefinitions: definitions.notApplicable,
        });
        if (
          definitions.applicable.length + definitions.notApplicable.length ===
          0
        ) {
          this.props.onClose();
        }
      }),
    );
  }

  componentDidMount(): void {
    const node = ReactDOM.findDOMNode(this);
    // $FlowFixMe
    node.focus();
    this._disposables.add(
      atom.commands.add(
        // $FlowFixMe
        node,
        {
          'core:move-up': () => this._moveSelectionIndex(-1),
          'core:move-down': () => this._moveSelectionIndex(1),
          'core:confirm': () => {
            const def = this.state.applicableDefinitions[
              this.state.selectionIndex
            ];
            this._toggleWorkingSet(def.name, def.active);
          },
          'core:cancel': this.props.onClose,
        },
      ),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentWillUpdate(nextProps: Props, nextState: State): void {
    const applicableLength = nextState.applicableDefinitions.length;

    if (applicableLength > 0) {
      if (nextState.selectionIndex >= applicableLength) {
        this.setState({selectionIndex: applicableLength - 1});
      } else if (nextState.selectionIndex < 0) {
        this.setState({selectionIndex: 0});
      }
    }
  }

  componentDidUpdate(): void {
    const node = ReactDOM.findDOMNode(this);
    // $FlowFixMe
    node.focus();
  }

  render(): React.Node {
    const applicableDefinitions = this.state.applicableDefinitions.map(
      (def, index) => {
        return (
          <ApplicableDefinitionLine
            key={def.name}
            def={def}
            index={index}
            selected={index === this.state.selectionIndex}
            toggleWorkingSet={this._toggleWorkingSet}
            onSelect={this._setSelectionIndex}
            onDeleteWorkingSet={this._deleteWorkingSet}
            onEditWorkingSet={this.props.onEditWorkingSet}
          />
        );
      },
    );

    let notApplicableSection;
    if (this.state.notApplicableDefinitions.length > 0) {
      const notApplicableDefinitions = this.state.notApplicableDefinitions.map(
        def => {
          return (
            <NonApplicableDefinitionLine
              key={def.name}
              def={def}
              onDeleteWorkingSet={this._deleteWorkingSet}
            />
          );
        },
      );

      notApplicableSection = (
        <div>
          <HR />
          <span>
            The working sets below are not applicable to your current project
            folders
          </span>
          <ol className="list-group">{notApplicableDefinitions}</ol>
        </div>
      );
    }

    return (
      <div className="select-list" tabIndex="0" onBlur={this._checkFocus}>
        <ol className="list-group mark-active" style={{'max-height': '80vh'}}>
          {applicableDefinitions}
        </ol>
        {notApplicableSection}
      </div>
    );
  }

  _moveSelectionIndex(step: number): void {
    this.setState({selectionIndex: this.state.selectionIndex + step});
  }

  _setSelectionIndex = (selectionIndex: number): void => {
    this.setState({selectionIndex});
  };

  _checkFocus = (event: SyntheticFocusEvent<>): void => {
    const node = ReactDOM.findDOMNode(this);
    // If the next active element (`event.relatedTarget`) is not a descendant of this modal, close
    // the modal.  In the case of a canceled _deleteWorkingSet, relatedTarget is null
    // and we don't want to close the modal
    // $FlowFixMe
    if (event.relatedTarget != null && !node.contains(event.relatedTarget)) {
      this.props.onClose();
    }
  };

  _toggleWorkingSet = (name: string, active: boolean) => {
    if (active) {
      this.props.workingSetsStore.deactivate(name);
    } else {
      this.props.workingSetsStore.activate(name);
    }
  };

  _deleteWorkingSet = (name: string): void => {
    const result = atom.confirm({
      message: `Please confirm: delete working set '${name}'?`,
      buttons: ['Delete', 'Cancel'],
    });
    if (result === 0) {
      this.props.workingSetsStore.deleteWorkingSet(name);
    }
  };
}

type ApplicableDefinitionLineProps = {
  def: WorkingSetDefinition,
  index: number,
  selected: boolean,
  toggleWorkingSet: (name: string, active: boolean) => void,
  onSelect: (index: number) => void,
  onDeleteWorkingSet: (name: string) => void,
  onEditWorkingSet: (name: string, uris: Array<string>) => void,
};

class ApplicableDefinitionLine extends React.Component<
  ApplicableDefinitionLineProps,
> {
  render(): React.Node {
    const classes = {
      active: this.props.def.active,
      selected: this.props.selected,
      clearfix: true,
    };

    return (
      <li
        className={classnames(classes)}
        onMouseOver={() => this.props.onSelect(this.props.index)}
        onClick={this._lineOnClick}>
        <ButtonGroup className="pull-right">
          <Button
            icon="trashcan"
            onClick={this._deleteButtonOnClick}
            tabIndex="-1"
            title="Delete this working set"
          />
          <Button
            icon="pencil"
            onClick={this._editButtonOnClick}
            tabIndex="-1"
            title="Edit this working set"
          />
        </ButtonGroup>
        <span>{this.props.def.name}</span>
      </li>
    );
  }

  _lineOnClick = (event: MouseEvent): void => {
    this.props.toggleWorkingSet(this.props.def.name, this.props.def.active);
  };

  _deleteButtonOnClick = (event: MouseEvent): void => {
    this.props.onDeleteWorkingSet(this.props.def.name);
    event.stopPropagation();
  };

  _editButtonOnClick = (event: MouseEvent): void => {
    this.props.onEditWorkingSet(this.props.def.name, this.props.def.uris);
    event.stopPropagation();
  };
}

type NonApplicableDefinitionLineProps = {
  def: WorkingSetDefinition,
  onDeleteWorkingSet: (name: string) => void,
};

class NonApplicableDefinitionLine extends React.Component<
  NonApplicableDefinitionLineProps,
> {
  constructor(props: NonApplicableDefinitionLineProps) {
    super(props);

    (this: any)._deleteButtonOnClick = this._deleteButtonOnClick.bind(this);
  }

  render(): React.Node {
    return (
      <li className="clearfix">
        <Button
          className="pull-right"
          icon="trashcan"
          onClick={this._deleteButtonOnClick}
          tabIndex="-1"
          title="Delete this working set"
        />
        <span className="text-subtle">{this.props.def.name}</span>
      </li>
    );
  }

  _deleteButtonOnClick = (event: MouseEvent): void => {
    this.props.onDeleteWorkingSet(this.props.def.name);
    event.stopPropagation();
  };
}
