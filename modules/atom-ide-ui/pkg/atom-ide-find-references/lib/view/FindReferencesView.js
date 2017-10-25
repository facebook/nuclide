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

import type {FileReferences} from '../types';

import * as React from 'react';
import FileReferencesView from './FileReferencesView';
import FindReferencesModel from '../FindReferencesModel';
import {pluralize} from 'nuclide-commons/string';

// Number of files to show on every page.
const PAGE_SIZE = 10;
// Start loading more once the user scrolls within this many pixels of the bottom.
const SCROLL_LOAD_THRESHOLD = 250;

type Props = {
  model: FindReferencesModel,
};

type State = {
  loading: boolean,
  fetched: number,
  selected: number,
  references: Array<FileReferences>,
};

export default class FindReferencesView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      fetched: 0,
      selected: -1,
      references: [],
    };

    (this: any)._fetchMore = this._fetchMore.bind(this);
    (this: any)._onScroll = this._onScroll.bind(this);
    (this: any)._childClick = this._childClick.bind(this);
  }

  componentDidMount() {
    this._fetchMore(PAGE_SIZE);
  }

  async _fetchMore(count: number): Promise<void> {
    const next = await this.props.model.getFileReferences(
      this.state.fetched,
      PAGE_SIZE,
    );
    this.setState({
      loading: false,
      fetched: this.state.fetched + PAGE_SIZE,
      references: this.state.references.concat(next),
    });
  }

  _onScroll(evt: Event) {
    const root = this.refs.root;
    if (this.state.loading || root.clientHeight >= root.scrollHeight) {
      return;
    }
    const scrollBottom = root.scrollTop + root.clientHeight;
    if (root.scrollHeight - scrollBottom <= SCROLL_LOAD_THRESHOLD) {
      this.setState({loading: true});
      this._fetchMore(PAGE_SIZE);
    }
  }

  _childClick(i: number) {
    this.setState({selected: this.state.selected === i ? -1 : i});
  }

  render(): React.Node {
    const children = this.state.references.map((fileRefs, i) => (
      <FileReferencesView
        key={i}
        isSelected={this.state.selected === i}
        {...fileRefs}
        basePath={this.props.model.getBasePath()}
        clickCallback={() => this._childClick(i)}
      />
    ));

    const refCount = this.props.model.getReferenceCount();
    const fileCount = this.props.model.getFileCount();
    if (this.state.fetched < fileCount) {
      children.push(
        <div
          key="loading"
          className="find-references-loading loading-spinner-medium"
        />,
      );
    }

    return (
      <div className="find-references">
        <div className="find-references-count panel-heading">
          {refCount} {pluralize('reference', refCount)} found in {fileCount}{' '}
          {pluralize('file', fileCount)} for{' '}
          <span className="highlight-info">
            {this.props.model.getSymbolName()}
          </span>
        </div>
        <ul
          className="find-references-files list-tree has-collapsable-children"
          onScroll={this._onScroll}
          ref="root"
          tabIndex="0">
          {children}
        </ul>
      </div>
    );
  }
}
