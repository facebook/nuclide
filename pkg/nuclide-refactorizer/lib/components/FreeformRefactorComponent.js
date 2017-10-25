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

import type {FreeformRefactoringArgument} from '../..';
import type {Store, FreeformPhase} from '../types';

import * as React from 'react';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {Dropdown} from '../../../nuclide-ui/Dropdown';

import * as Actions from '../refactorActions';

type Props = {
  phase: FreeformPhase,
  store: Store,
};

type State = {
  args: Map<string, mixed>,
};

function getDefault(arg: FreeformRefactoringArgument): string | boolean {
  if (arg.default != null) {
    return arg.default;
  }

  switch (arg.type) {
    case 'string':
      return '';
    case 'boolean':
      return false;
    case 'enum':
      return arg.options[0].value;
  }

  throw new Error('unreachable');
}

export class FreeformRefactorComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const defaultArgs = new Map(
      props.phase.refactoring.arguments.map(arg => [arg.name, getDefault(arg)]),
    );
    this.state = {
      args: defaultArgs,
    };
  }

  render(): React.Node {
    return (
      <div>
        {this._getControls()}
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <Button
            className="nuclide-refactorizer-execute-button"
            buttonType={ButtonTypes.PRIMARY}
            onClick={this._execute}>
            Execute
          </Button>
        </div>
      </div>
    );
  }

  _getControls() {
    return this.props.phase.refactoring.arguments
      .map((arg, index) => {
        switch (arg.type) {
          case 'string':
            return [
              <div key="label" className="nuclide-refactorizer-freeform-label">
                {arg.description}
              </div>,
              <AtomInput
                key="input"
                autofocus={index === 0}
                startSelected={index === 0}
                className="nuclide-refactorizer-freeform-editor"
                value={String(this.state.args.get(arg.name))}
                onDidChange={text => this._updateArg(arg.name, text)}
                onConfirm={this._execute}
              />,
            ];
          case 'boolean':
            return (
              <Checkbox
                label={arg.description}
                checked={Boolean(this.state.args.get(arg.name))}
                onChange={checked => this._updateArg(arg.name, checked)}
              />
            );
          case 'enum':
            return [
              <div key="label" className="nuclide-refactorizer-freeform-label">
                {arg.description}
              </div>,
              <Dropdown
                key="dropdown"
                value={this.state.args.get(arg.name) || arg.options[0]}
                options={arg.options.map(val => ({
                  value: val.value,
                  label: val.description,
                }))}
                onChange={value => this._updateArg(arg.name, value)}
              />,
            ];
        }
      })
      .map((elem, index) => {
        return (
          <div key={index} className="nuclide-refactorizer-freeform-group">
            {elem}
          </div>
        );
      });
  }

  _updateArg(name: string, value: mixed) {
    // A bit hacky, but immutability isn't a requirement here.
    this.state.args.set(name, value);
    this.forceUpdate();
  }

  _execute = () => {
    const {editor, originalPoint, refactoring} = this.props.phase;
    this.props.store.dispatch(
      Actions.execute(this.props.phase.provider, {
        kind: 'freeform',
        editor,
        originalPoint,
        id: refactoring.id,
        range: refactoring.range,
        arguments: this.state.args,
      }),
    );
  };
}
