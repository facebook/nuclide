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
import PathWithFileIcon from './PathWithFileIcon';

function PathWithFileIconExample(): React.Element<any> {
  return (
    <div>
      <Block>
        <p>
          Simply wrap paths in &lt;PathWithFileIcon /&gt; to get the appropriate icons:
        </p>
        <div>
          <PathWithFileIcon path="maybe/some/javascript.js" />
          <PathWithFileIcon path="how/about/php.php" />
          <PathWithFileIcon path="text.txt" />
          <PathWithFileIcon path="markdown.md" />
          <PathWithFileIcon path="emptiness" />
          <PathWithFileIcon path=".dotfile" />
          <PathWithFileIcon isFolder={true} path="how/about/a/folder/" />
        </div>
      </Block>
    </div>
  );
}

export const PathWithFileIconExamples = {
  sectionName: 'PathWithFileIcon',
  description: 'Renders a file icon for a given path iff the file-icons package is installed.',
  examples: [
    {
      title: 'File icon wrapper example',
      component: PathWithFileIconExample,
    },
  ],
};
