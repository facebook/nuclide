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

import React from 'react';
import nuclideUri from 'nuclide-commons/nuclideUri';
import PathWithFileIcon from '../../nuclide-ui/PathWithFileIcon';
import groupMatchIndexes from 'nuclide-commons/groupMatchIndexes';

type Key = number | string;

function renderSubsequence(seq: string, props: Object): ?React.Element<any> {
  return seq.length === 0
    ? null
    : <span {...props}>
        {seq}
      </span>;
}

function renderUnmatchedSubsequence(
  seq: string,
  key: Key,
): ?React.Element<any> {
  return renderSubsequence(seq, {key});
}

function renderMatchedSubsequence(seq: string, key: Key): ?React.Element<any> {
  return renderSubsequence(seq, {
    key,
    className: 'quick-open-file-search-match',
  });
}

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
      matchIndexes = matchIndexes.map(i => i - (dirName.length - 1));
    }

    const pathComponents = groupMatchIndexes(
      filePath,
      matchIndexes,
      renderMatchedSubsequence,
      renderUnmatchedSubsequence,
    );
    return (
      <PathWithFileIcon path={nuclideUri.basename(filePath)}>
        {pathComponents}
      </PathWithFileIcon>
    );
  }
}
