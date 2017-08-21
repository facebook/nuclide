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

import React from 'react';
import {Block} from 'nuclide-commons-ui/Block';
import {Icon} from 'nuclide-commons-ui/Icon';
import {TreeList, TreeItem, NestedTreeItem} from './Tree';

const BasicTreeExample = (): React.Element<any> =>
  <div>
    Trees
    <Block>
      <TreeList>
        <TreeItem>TreeItem 1</TreeItem>
        <TreeItem>TreeItem 2</TreeItem>
        <NestedTreeItem title={<span>NestedTreeItem 1</span>} selected={true}>
          <TreeItem>TreeItem 3</TreeItem>
          <TreeItem>TreeItem 4</TreeItem>
        </NestedTreeItem>
        <NestedTreeItem
          title={<span>NestedTreeItem 2</span>}
          collapsed={true}
        />
      </TreeList>
    </Block>
  </div>;

const AtomStyleguideTreeExample = (): React.Element<any> =>
  <Block>
    <TreeList showArrows={true}>
      <NestedTreeItem title={<Icon icon="file-directory">A Directory</Icon>}>
        <NestedTreeItem
          collapsed={false}
          title={<Icon icon="file-directory">Nested Directory</Icon>}>
          <TreeItem>
            <Icon icon="file-text">File one</Icon>
          </TreeItem>
        </NestedTreeItem>
        <NestedTreeItem
          collapsed={true}
          title={<Icon icon="file-directory">Collapsed Nested Directory</Icon>}>
          <TreeItem>
            <Icon icon="file-text">File one</Icon>
          </TreeItem>
        </NestedTreeItem>
        <TreeItem>
          <Icon icon="file-text">File one</Icon>
        </TreeItem>
        <TreeItem selected={true}>
          <Icon icon="file-text">File three .selected!</Icon>
        </TreeItem>
      </NestedTreeItem>
      <TreeItem>
        <Icon icon="file-text">.icon-file-text</Icon>
      </TreeItem>
      <TreeItem>
        <Icon icon="file-symlink-file">.icon-file-symlink-file</Icon>
      </TreeItem>
    </TreeList>
  </Block>;

export const TreeExamples = {
  sectionName: 'Trees',
  description: 'Expandable, hierarchical lists.',
  examples: [
    {
      title: 'Basic Tree',
      component: BasicTreeExample,
    },
    {
      title: 'Reproducing the Atom style guide example:',
      component: AtomStyleguideTreeExample,
    },
  ],
};
