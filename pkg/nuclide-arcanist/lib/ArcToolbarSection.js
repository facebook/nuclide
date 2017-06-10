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

import type {Option} from '../../nuclide-ui/Dropdown';

import React from 'react';
import {ArcToolbarModel} from './ArcToolbarModel';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Dropdown} from '../../nuclide-ui/Dropdown';
import invariant from 'assert';

type Props = {
  model: ArcToolbarModel,
};

export default class ArcToolbarSection extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
    (this: any)._arcBuild = this._arcBuild.bind(this);
    (this: any)._handleBuildTargetChange = this._handleBuildTargetChange.bind(
      this,
    );
    (this: any)._reloadBuildTargets = this._reloadBuildTargets.bind(this);
  }

  componentDidMount(): void {
    this.props.model.viewActivated();
  }

  componentWillUnmount(): void {
    this.props.model.viewDeactivated();
  }

  getOptions(): Array<Option> {
    const {model} = this.props;
    invariant(model.isArcSupported());
    const error = model.getBuildTargetsError();
    if (error != null) {
      return [
        {value: null, disabled: true, label: 'Error loading build steps!'},
      ];
    }
    const targets = model.getBuildTargets();
    if (targets == null) {
      return [{value: null, disabled: true, label: 'Loading build steps...'}];
    }
    return targets.map(target => ({value: target, label: target}));
  }

  _renderReloadTargetsButton(): ?React.Element<any> {
    const error = this.props.model.getBuildTargetsError();
    if (error == null) {
      return null;
    }
    return (
      <Button
        icon="sync"
        size={ButtonSizes.SMALL}
        onClick={this._reloadBuildTargets}
        tooltip={{
          title: 'Reload build steps',
          delay: {show: 500, hide: 0},
          placement: 'bottom',
        }}
      />
    );
  }

  render(): ?React.Element<any> {
    const {model} = this.props;
    if (!model.isArcSupported()) {
      return null;
    }
    return (
      <div className="inline-block">
        <ButtonGroup>
          <Dropdown
            className="nuclide-arcanist-toolbar-targets-dropdown"
            size="sm"
            value={model.getActiveBuildTarget()}
            options={this.getOptions()}
            onChange={this._handleBuildTargetChange}
          />
          {this._renderReloadTargetsButton()}
        </ButtonGroup>
      </div>
    );
  }

  _reloadBuildTargets(): void {
    this.props.model.updateBuildTargets();
  }

  _handleBuildTargetChange(value: string): void {
    this.props.model.setActiveBuildTarget(value);
  }

  _arcBuild(): void {
    this.props.model.arcBuild();
  }
}
