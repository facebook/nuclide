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

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import type {IDebugService, IProcess} from '../types';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import * as React from 'react';
import {TreeList} from 'nuclide-commons-ui/Tree';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {fastDebounce} from 'nuclide-commons/observable';
import ProcessTreeNode from './ProcessTreeNode';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {AddTargetButton} from './DebuggerAddTargetButton';

type Props = {
  service: IDebugService,
};

type State = {
  processList: Array<IProcess>,
  filter: ?string,
  showPausedThreadsOnly: boolean,
};

const SHOW_PAUSED_ONLY_KEY = 'debugger-show-paused-threads-only';

export default class DebuggerProcessComponent extends React.PureComponent<
  Props,
  State,
> {
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);

    this._disposables = new UniversalDisposable();
    this.state = {
      processList: this.props.service.getModel().getProcesses(),
      filter: null,
      showPausedThreadsOnly: Boolean(featureConfig.get(SHOW_PAUSED_ONLY_KEY)),
    };
  }

  componentDidMount(): void {
    const {service} = this.props;
    const model = service.getModel();
    this._disposables.add(
      observableFromSubscribeFunction(model.onDidChangeProcesses.bind(model))
        .let(fastDebounce(150))
        .subscribe(() => {
          this.setState({
            processList: model.getProcesses(),
          });
        }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  render(): React.Node {
    const {processList, filter} = this.state;
    const {service} = this.props;
    let filterRegEx = null;
    try {
      if (filter != null) {
        filterRegEx = new RegExp(filter, 'ig');
      }
    } catch (_) {}
    const processElements = processList.map((process, processIndex) => {
      const {adapterType, processName} = process.configuration;
      return process == null ? (
        'No processes are currently being debugged'
      ) : (
        <ProcessTreeNode
          title={processName != null ? processName : adapterType}
          filter={filter}
          filterRegEx={filterRegEx}
          showPausedThreadsOnly={this.state.showPausedThreadsOnly}
          key={process.getId()}
          childItems={process.getAllThreads()}
          process={process}
          service={service}
        />
      );
    });

    return (
      <div>
        <div className="debugger-thread-filter-row">
          <AtomInput
            className="debugger-thread-filter-box"
            placeholderText="Filter threads..."
            value={this.state.filter || ''}
            size="sm"
            onDidChange={text => {
              this.setState({
                filter: text,
              });
            }}
            autofocus={false}
          />
          <ButtonGroup className="inline-block">
            <Button
              icon={'playback-pause'}
              size={ButtonSizes.SMALL}
              selected={this.state.showPausedThreadsOnly}
              onClick={() => {
                featureConfig.set(
                  SHOW_PAUSED_ONLY_KEY,
                  !this.state.showPausedThreadsOnly,
                );
                this.setState(prevState => ({
                  showPausedThreadsOnly: !prevState.showPausedThreadsOnly,
                }));
              }}
              tooltip={{title: 'Show only paused threads'}}
            />
            <Button
              icon={'x'}
              disabled={
                !this.state.showPausedThreadsOnly &&
                (this.state.filter === '' || this.state.filter == null)
              }
              size={ButtonSizes.SMALL}
              onClick={() => {
                featureConfig.set(SHOW_PAUSED_ONLY_KEY, false);
                this.setState({
                  showPausedThreadsOnly: false,
                  filter: '',
                });
              }}
              tooltip={{title: 'Clear thread filters'}}
            />
          </ButtonGroup>
          {AddTargetButton('debugger-stepping-buttongroup')}
        </div>
        <TreeList showArrows={true}>{processElements}</TreeList>
      </div>
    );
  }
}
