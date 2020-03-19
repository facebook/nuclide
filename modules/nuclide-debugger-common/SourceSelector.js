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

import type {SuggestedProjectPath} from 'atom-ide-debugger-java/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import idx from 'idx';
import {Dropdown} from 'nuclide-commons-ui/Dropdown';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {observeProjectPathsAllFromSourcePathsService} from './utils';

type Props = {|
  +onSelect: (selectedSource: ?NuclideUri) => void,
  +deserialize: () => ?string,
|};

type State = {
  selectableSources: Array<SuggestedProjectPath>,
  selectedSource: ?SuggestedProjectPath,
};

export class SourceSelector extends React.Component<Props, State> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._disposables = new UniversalDisposable();
    this.state = {selectableSources: [], selectedSource: null};
  }

  _getNewlySelectedSource(
    selectedSource: ?SuggestedProjectPath,
    projectPaths: Array<SuggestedProjectPath>,
    deserializedProjectPath: ?string,
  ): ?SuggestedProjectPath {
    let newSelectedSource = null;
    if (selectedSource != null) {
      newSelectedSource = projectPaths.includes(selectedSource)
        ? selectedSource
        : null;
    }
    if (newSelectedSource == null && projectPaths.length > 0) {
      const matches = projectPaths.filter(
        projectPath => projectPath.projectPath === deserializedProjectPath,
      );
      newSelectedSource = matches.length > 0 ? matches[0] : projectPaths[0];
    }
    return newSelectedSource;
  }

  componentDidMount() {
    this._disposables.add(
      observeProjectPathsAllFromSourcePathsService(
        (projectPaths: Array<SuggestedProjectPath>) => {
          const newSelectedSource = this._getNewlySelectedSource(
            // TODO: (wbinnssmith) T30771435 this setState depends on current state
            // and should use an updater function rather than an object
            // eslint-disable-next-line react/no-access-state-in-setstate
            this.state.selectedSource,
            projectPaths,
            this.props.deserialize(),
          );
          this.setState({
            selectableSources: projectPaths,
            selectedSource: newSelectedSource,
          });
        },
      ),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  _getLabelFromSource(source: SuggestedProjectPath) {
    const {projectPath, hostLabel} = source;
    const basename = nuclideUri.basename(projectPath);
    return hostLabel + ' - ' + basename;
  }

  _sourceToOption = (source: SuggestedProjectPath) => {
    const label = this._getLabelFromSource(source);
    return {
      value: source,
      label,
      selectedLabel: label,
    };
  };

  setState(partialState: Object, callback?: () => mixed): void {
    const fullState: State = {
      ...this.state,
      ...partialState,
    };
    super.setState(fullState, () => {
      this.props.onSelect(idx(fullState, _ => _.selectedSource.projectPath));
      callback && callback();
    });
  }

  render(): React.Node {
    const {selectableSources, selectedSource} = this.state;
    const options = selectableSources.map(this._sourceToOption);
    if (options.length === 0) {
      return (
        <div>
          No Projects Found. Please add a project to your file tree so the
          debugger can find sources.
        </div>
      );
    }
    const potentiallyWrongSourceLabel =
      selectedSource != null && !selectedSource.suggested ? (
        <label>
          Nuclide is not sure that you have selected a project which contains
          sources the debugger can use. Please double check that your selected
          source is correct.
        </label>
      ) : null;
    return (
      <div>
        <Dropdown
          options={options}
          onChange={option => this.setState({selectedSource: option})}
          placeholder={'Select a source'}
          value={selectedSource}
        />
        {potentiallyWrongSourceLabel}
      </div>
    );
  }
}
