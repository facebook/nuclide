'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

const FileTreeActions = require('../lib/FileTreeActions');
const {
  PureRenderMixin,
  React,
} = require('react-for-atom');
const {StatusCodeNumber} = require('../../nuclide-hg-repository-base').hgConstants;

const classnames = require('classnames');
const {fileTypeClass} = require('../../nuclide-atom-helpers');
const {isContextClick} = require('../lib/FileTreeHelpers');
const filterName = require('../lib/FileTreeFilterHelper');
const NuclideCheckbox = require('../../nuclide-ui-checkbox');
const semver = require('semver');

const {PropTypes} = React;

const getActions = FileTreeActions.getInstance;

// Additional indent for nested tree nodes
const INDENT_PER_LEVEL = 17;

class FileEntryComponent extends React.Component {
  static propTypes = {
    indentLevel: PropTypes.number.isRequired,
    isSelected: PropTypes.bool.isRequired,
    usePreviewTabs: PropTypes.bool.isRequired,
    nodeKey: PropTypes.string.isRequired,
    nodeName: PropTypes.string.isRequired,
    nodePath: PropTypes.string.isRequired,
    rootKey: PropTypes.string.isRequired,
    vcsStatusCode: PropTypes.number,
    checkedStatus: PropTypes.oneOf(['checked', 'clear', '']).isRequired,
    soften: PropTypes.bool.isRequired,
  };

  constructor(props: Object) {
    super(props);
    (this: any)._onClick = this._onClick.bind(this);
    (this: any)._checkboxOnChange = this._checkboxOnChange.bind(this);
    (this: any)._checkboxOnClick = this._checkboxOnClick.bind(this);
    (this: any)._onMouseDown = this._onMouseDown.bind(this);
    (this: any)._onDoubleClick = this._onDoubleClick.bind(this);
  }

  shouldComponentUpdate(nextProps: Object, nextState: void) {
    return PureRenderMixin.shouldComponentUpdate.call(this, nextProps, nextState);
  }

  render(): ReactElement {
    const outerClassName = classnames('entry file list-item', {
      'selected': this.props.isSelected,
      'nuclide-file-tree-softened': this.props.soften,
    });

    let statusClass;
    if (this.props.checkedStatus === '') {
      const {vcsStatusCode} = this.props;
      if (vcsStatusCode === StatusCodeNumber.MODIFIED) {
        statusClass = 'status-modified';
      } else if (vcsStatusCode === StatusCodeNumber.ADDED) {
        statusClass = 'status-added';
      } else {
        statusClass = '';
      }
    } else {
      switch (this.props.checkedStatus) {
        case 'checked':
          statusClass = 'status-added';
          break;
        default:
          statusClass = '';
          break;
      }
    }

    const filter = this.props.filter;
    const name = filterName(this.props.nodeName, filter);

    return (
      <li
        className={`${outerClassName} ${statusClass}`}
        style={{paddingLeft: this.props.indentLevel * INDENT_PER_LEVEL}}
        onClick={this._onClick}
        onMouseDown={this._onMouseDown}
        onDoubleClick={this._onDoubleClick}>
        <span
          className={`icon name ${fileTypeClass(this.props.nodeName)}`}
          data-name={this.props.nodeName}
          data-path={this.props.nodePath}>
          {this._renderCheckbox()}
          <span
            data-name={this.props.nodeName}
            data-path={this.props.nodePath}>
            {name}
          </span>
        </span>
      </li>
    );
  }

  _renderCheckbox(): ?React.Element {
    if (this.props.checkedStatus === '') {
      return;
    }

    return (
      <NuclideCheckbox
        checked={this.props.checkedStatus === 'checked'}
        onChange={this._checkboxOnChange}
        onClick={this._checkboxOnClick}
      />
    );
  }

  _onClick(event: SyntheticMouseEvent) {
    const modifySelection = event.ctrlKey || event.metaKey;
    if (modifySelection) {
      getActions().toggleSelectNode(this.props.rootKey, this.props.nodeKey);
    } else {
      if (!this.props.isSelected) {
        getActions().selectSingleNode(this.props.rootKey, this.props.nodeKey);
      }
      if (this.props.usePreviewTabs) {
        getActions().confirmNode(this.props.rootKey, this.props.nodeKey, /* pending */ true);
      }
    }
  }

  _onMouseDown(event: SyntheticMouseEvent) {
    // Select node on right-click (in order for context menu to behave correctly).
    if (isContextClick(event)) {
      if (!this.props.isSelected) {
        getActions().selectSingleNode(this.props.rootKey, this.props.nodeKey);
      }
    }
  }

  _onDoubleClick(): void {
    if (this.props.usePreviewTabs) {
      // This will no longer be needed once Nuclide will not officially support Atoms < 1.6.0
      if (semver.lt(atom.getVersion(), '1.6.0-beta')) {
        getActions().keepPreviewTab();
      }
    } else {
      getActions().confirmNode(this.props.rootKey, this.props.nodeKey);
    }
  }

  _checkboxOnChange(isChecked: boolean): void {
    if (isChecked) {
      getActions().checkNode(this.props.rootKey, this.props.nodeKey);
    } else {
      getActions().uncheckNode(this.props.rootKey, this.props.nodeKey);
    }
  }

  _checkboxOnClick(event: Event): void {
    event.stopPropagation();
  }
}

module.exports = FileEntryComponent;
