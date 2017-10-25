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

import type {Reference, ReferenceGroup} from '../types';

import * as React from 'react';
import classnames from 'classnames';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {CodeSnippet} from 'nuclide-commons-ui/CodeSnippet';

type Props = {
  uri: string,
  grammar: atom$Grammar,
  previewText: Array<string>,
  refGroups: Array<ReferenceGroup>,
  basePath: string,
  clickCallback: () => void,
  isSelected: boolean,
};

type State = {
  isExpanded: boolean,
};

export default class FileReferencesView extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isExpanded: true,
    };
    (this: any)._onFileClick = this._onFileClick.bind(this);
    (this: any)._onFileNameClick = this._onFileNameClick.bind(this);
  }

  _onRefClick(evt: SyntheticEvent<>, ref: Reference) {
    goToLocation(this.props.uri, {
      line: ref.range.start.row,
      column: ref.range.start.column,
    });
    evt.stopPropagation();
  }

  _onFileClick() {
    this.props.clickCallback();
    this.setState({
      isExpanded: !this.state.isExpanded,
    });
  }

  _onFileNameClick(evt: SyntheticEvent<>, line?: number) {
    goToLocation(this.props.uri, {line});
    evt.stopPropagation();
  }

  render(): React.Node {
    const groups = this.props.refGroups.map((group: ReferenceGroup, i) => {
      const firstRef = group.references[0];
      const lastRef = group.references[group.references.length - 1];

      let caller;
      // flowlint-next-line sketchy-null-string:off
      if (firstRef.name && firstRef.name === lastRef.name) {
        caller = (
          <span>
            {' '}
            in <code>{firstRef.name}</code>
          </span>
        );
      }
      const startRange = firstRef.range.start;
      const endRange = lastRef.range.end;
      return (
        <li key={group.startLine} className="find-references-ref">
          <div
            className="find-references-ref-name"
            onClick={evt => this._onRefClick(evt, firstRef)}>
            {'Line '}
            {startRange.row + 1}
            :
            {startRange.column + 1} - {endRange.row + 1}
            :
            {endRange.column + 1}
            {caller}
          </div>
          <CodeSnippet
            grammar={this.props.grammar}
            text={this.props.previewText[i]}
            highlights={group.references.map(ref => ref.range)}
            startLine={group.startLine}
            endLine={group.endLine}
            onClick={evt => this._onRefClick(evt, firstRef)}
            onLineClick={this._onFileNameClick}
          />
        </li>
      );
    });
    const outerClassName = classnames('find-references-file list-nested-item', {
      collapsed: !this.state.isExpanded,
      expanded: this.state.isExpanded,
      selected: this.props.isSelected,
    });

    return (
      <li className={`${outerClassName}`}>
        <div
          className="find-references-filename list-item"
          onClick={this._onFileClick}>
          <span className="icon-file-text icon" />
          <a onClick={this._onFileNameClick}>
            {nuclideUri.relative(this.props.basePath, this.props.uri)}
          </a>
          <span className="find-references-ref-count badge badge-small">
            {groups.length}
          </span>
        </div>
        <ul className="find-references-refs list-tree">{groups}</ul>
      </li>
    );
  }
}
