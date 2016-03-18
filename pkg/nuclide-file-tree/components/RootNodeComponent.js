'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

const DirectoryEntryComponent = require('./DirectoryEntryComponent');
const FileEntryComponent = require('./FileEntryComponent');
const FileTreeNode = require('../lib/FileTreeNode');
const {
  React,
  ReactDOM,
} = require('react-for-atom');
const {track} = require('../../nuclide-analytics');

const {PropTypes} = React;
const {performance} = global;

class RootNodeComponent extends React.Component {
  static propTypes = {
    rootNode: PropTypes.object.isRequired,
    rootKey: PropTypes.string.isRequired,
  };

  render(): ReactElement {
    const renderStart = performance.now();
    const children = this._renderNode(this.props.rootNode, 0);
    const rootNodeComponent = (
      <ol className="list-tree has-collapsable-children">
        {children}
      </ol>
    );

    track('filetree-root-node-component-render', {
      'filetree-root-node-component-render-duration': (performance.now() - renderStart).toString(),
      'filetree-root-node-component-rendered-child-count': children.length.toString(),
    });

    return rootNodeComponent;
  }

  _renderNode(node: FileTreeNode, indentLevel: number): Array<ReactElement> {
    let elements = [node.isContainer ?
      <DirectoryEntryComponent
        filter={this.props.filter}
        indentLevel={indentLevel}
        isCwd={node.isCwd()}
        isExpanded={node.isExpanded()}
        isLoading={node.isLoading()}
        isRoot={indentLevel === 0}
        isSelected={node.isSelected()}
        usePreviewTabs={node.usePreviewTabs()}
        vcsStatusCode={node.getVcsStatusCode()}
        key={node.hashKey}
        nodeKey={node.nodeKey}
        nodeName={node.nodeName}
        nodePath={node.nodePath}
        ref={node.nodeKey}
        rootKey={node.rootKey}
        checkedStatus={node.getCheckedStatus()}
        soften={node.shouldBeSoftened()}
      /> :
      <FileEntryComponent
        filter={this.props.filter}
        indentLevel={indentLevel}
        isSelected={node.isSelected()}
        usePreviewTabs={node.usePreviewTabs()}
        vcsStatusCode={node.getVcsStatusCode()}
        key={node.hashKey}
        nodeKey={node.nodeKey}
        nodeName={node.nodeName}
        nodePath={node.nodePath}
        ref={node.nodeKey}
        rootKey={node.rootKey}
        checkedStatus={node.getCheckedStatus()}
        soften={node.shouldBeSoftened()}
      />,
    ];
    if (node.isExpanded()) {
      node.getChildNodes().forEach(childNode => {
        elements = elements.concat(this._renderNode(childNode, indentLevel + 1));
      });
    }
    return elements;
  }

  scrollNodeIntoViewIfNeeded(nodeKey: string): void {
    const node = this.refs[nodeKey];
    if (node) {
      ReactDOM.findDOMNode(node).scrollIntoViewIfNeeded();
    }
  }
}

module.exports = RootNodeComponent;
