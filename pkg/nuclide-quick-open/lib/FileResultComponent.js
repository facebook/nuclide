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

import type {FileResult} from './types';

import * as React from 'react';
import matchIndexesToRanges from 'nuclide-commons/matchIndexesToRanges';
import nuclideUri from 'nuclide-commons/nuclideUri';
import HighlightedText from 'nuclide-commons-ui/HighlightedText';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';

export default class FileResultComponent {
  static getComponentForItem(
    item: FileResult,
    serviceName: string,
    dirName: string,
  ): React.Element<any> {
    // Trim the `dirName` off the `filePath` since that's shown by the group
    let filePath = item.path;
    let matchIndexes = item.matchIndexes || [];
    if (filePath.startsWith(dirName)) {
      filePath = '.' + filePath.slice(dirName.length);
      matchIndexes = matchIndexes
        .map(i => i - (dirName.length - 1))
        .filter(i => i >= 0);
    }

    return (
      <PathWithFileIcon path={nuclideUri.basename(filePath)}>
        <HighlightedText
          highlightedRanges={matchIndexesToRanges(matchIndexes)}
          text={filePath}
        />
      </PathWithFileIcon>
    );
  }
}
