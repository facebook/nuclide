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
  ReactDOM,
} = require('react-for-atom');
const {StatusCodeNumber} = require('../../nuclide-hg-repository-base').hgConstants;
const classnames = require('classnames');
const filterName = require('../lib/FileTreeFilterHelper');
const {getDisplayTitle} = require('../lib/FileTreeHelpers');
const {isContextClick} = require('../lib/FileTreeHelpers');
const NuclideCheckbox = require('../../nuclide-ui-checkbox');

const {PropTypes} = React;

const getActions = FileTreeActions.getInstance;

// Additional indent for nested tree nodes
const INDENT_PER_LEVEL = 17;

class DirectoryEntryComponent extends React.Component {
  static propTypes = {
    indentLevel: PropTypes.number.isRequired,
    isCwd: PropTypes.bool.isRequired,
    isExpanded: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,
    isRoot: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    usePreviewTabs: PropTypes.bool.isRequired,
    nodeKey: PropTypes.string.isRequired,
    nodeName: PropTypes.string.isRequired,
    nodePath: PropTypes.string.isRequired,
    rootKey: PropTypes.string.isRequired,
    vcsStatusCode: PropTypes.number,
    checkedStatus: PropTypes.oneOf(['partial', 'checked', 'clear', '']).isRequired,
    soften: PropTypes.bool.isRequired,
  };

  constructor(props: Object) {
    super(props);
    (this: any)._onClick = this._onClick.bind(this);
    (this: any)._onMouseDown = this._onMouseDown.bind(this);
    (this: any)._checkboxOnChange = this._checkboxOnChange.bind(this);
    (this: any)._checkboxOnClick = this._checkboxOnClick.bind(this);
  }

  shouldComponentUpdate(nextProps: Object, nextState: void) {
    return PureRenderMixin.shouldComponentUpdate.call(this, nextProps, nextState);
  }

  render(): ReactElement {
    const outerClassName = classnames('directory entry list-nested-item', {
      'current-working-directory': this.props.isCwd,
      'collapsed': !this.props.isExpanded,
      'expanded': this.props.isExpanded,
      'project-root': this.props.isRoot,
      'selected': this.props.isSelected,
      'nuclide-file-tree-softened': this.props.soften,
    });
    const listItemClassName = classnames('header list-item', {
      'loading': this.props.isLoading,
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
        case 'partial':
          statusClass = 'status-modified';
          break;
        default:
          statusClass = '';
          break;
      }
    }

    const iconName = this.props.isCwd ? 'briefcase' : 'file-directory';

    let name = this.props.nodeName;
    if (!this.props.isRoot) {
      name = filterName(name, this.props.filter);
    }

    return (
      <li
        className={`${outerClassName} ${statusClass}`}
        style={{paddingLeft: this.props.indentLevel * INDENT_PER_LEVEL}}
        onClick={this._onClick}
        onMouseDown={this._onMouseDown}>
        <div className={listItemClassName} ref="arrowContainer">
          <span
            className={`icon name icon-${iconName}`}
            ref="pathContainer"
            data-name={this.props.nodeName}
            data-path={this.props.nodePath}>
            {this._renderCheckbox()}
            {name}
          </span>
          {this._renderConnectionTitle()}
        </div>
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
        indeterminate={this.props.checkedStatus === 'partial'}
        onChange={this._checkboxOnChange}
        onClick={this._checkboxOnClick}
      />
    );
  }

  _renderConnectionTitle(): ?React.Element {
    if (!this.props.isRoot) {
      return null;
    }
    const title = getDisplayTitle(this.props.nodeKey);
    if (!title) {
      return null;
    }

    return (
      <span className="nuclide-file-tree-connection-title highlight">
        {title}
      </span>
    );
  }

  _onClick(event: SyntheticMouseEvent) {
    const deep = event.altKey;
    if (
      ReactDOM.findDOMNode(this.refs['arrowContainer']).contains(event.target)
      && event.clientX < ReactDOM.findDOMNode(
        this.refs['pathContainer']).getBoundingClientRect().left
    ) {
      this._toggleNodeExpanded(deep);
      return;
    }

    const modifySelection = event.ctrlKey || event.metaKey;
    if (modifySelection) {
      getActions().toggleSelectNode(this.props.rootKey, this.props.nodeKey);
    } else {
      if (!this.props.isSelected) {
        getActions().selectSingleNode(this.props.rootKey, this.props.nodeKey);
      }
      if (this.props.isSelected || this.props.usePreviewTabs) {
        this._toggleNodeExpanded(deep);
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

  _toggleNodeExpanded(deep: boolean): void {
    if (this.props.isExpanded) {
      if (deep) {
        getActions().collapseNodeDeep(this.props.rootKey, this.props.nodeKey);
      } else {
        getActions().collapseNode(this.props.rootKey, this.props.nodeKey);
      }
    } else {
      if (deep) {
        getActions().expandNodeDeep(this.props.rootKey, this.props.nodeKey);
      } else {
        getActions().expandNode(this.props.rootKey, this.props.nodeKey);
      }
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

module.exports = DirectoryEntryComponent;
