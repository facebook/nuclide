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

import * as React from 'react';
import {Block} from './Block';
import PathWithFileIcon, {DecorationIcons} from './PathWithFileIcon';

function ListItem(props: {children?: mixed}): React.Element<any> {
  return (
    // $FlowFixMe(>=0.53.0) Flow suppress
    <div className="list-item">{props.children}</div>
  );
}

function BasicExample(): React.Element<any> {
  return (
    <div>
      <Block>
        <p>
          Simply wrap paths in &lt;PathWithFileIcon /&gt; to get the appropriate
          icons:
        </p>
        <div>
          <ListItem>
            <PathWithFileIcon path="maybe/some/javascript.js" />
          </ListItem>
          <ListItem>
            <PathWithFileIcon path="how/about/php.php" />
          </ListItem>
          <ListItem>
            <PathWithFileIcon path="text.txt" />
          </ListItem>
          <ListItem>
            <PathWithFileIcon path="markdown.md" />
          </ListItem>
          <ListItem>
            <PathWithFileIcon path="emptiness" />
          </ListItem>
          <ListItem>
            <PathWithFileIcon path=".dotfile" />
          </ListItem>
          <ListItem>
            <PathWithFileIcon isFolder={true} path="how/about/a/folder/" />
          </ListItem>
        </div>
      </Block>
    </div>
  );
}

function DecorationIconExample(): React.Node {
  return (
    <div>
      <Block>
        <p>
          PathWithFileIcon export a DecorationIcons object containing custom
          decorations. You can optionally pass one of those decorations to
          decorate the file icon with e.g. a small AtomIcon:
        </p>
        <div>
          <ListItem>
            <PathWithFileIcon
              decorationIcon={DecorationIcons.Warning}
              path="fileA.js"
            />
          </ListItem>
          <ListItem>
            <PathWithFileIcon
              decorationIcon={DecorationIcons.Error}
              path="fileB.js"
            />
          </ListItem>
          <ListItem>
            <PathWithFileIcon
              decorationIcon={DecorationIcons.Warning}
              isFolder={true}
              path="folderA"
            />
          </ListItem>
          <ListItem>
            <PathWithFileIcon
              decorationIcon={DecorationIcons.Error}
              isFolder={true}
              path="folderB"
            />
          </ListItem>
        </div>
      </Block>
    </div>
  );
}

export const PathWithFileIconExamples = {
  sectionName: 'PathWithFileIcon',
  description:
    'Renders a file icon for a given path iff the file-icons package is installed.',
  examples: [
    {
      title: 'File icon wrapper example',
      component: BasicExample,
    },
    {
      title: 'decorationIcon',
      component: DecorationIconExample,
    },
  ],
};
