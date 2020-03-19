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

import type {
  AbsolutePath,
  Identifier,
  Literal,
  RelativePath,
} from '../types/common';

import StringUtils from './StringUtils';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';

function getIdentifiersFromPath(filePath: AbsolutePath): Set<Identifier> {
  const ids = new Set();

  const baseName = path.basename(filePath);

  // Get rid of extensions like, '.js', '.jsx', '.react.js', etc.
  const noExtensions = baseName.split('.')[0];

  // These are not valid tokens in an identifier so we have to remove them.
  const splits = noExtensions.split(/[^\w]/);

  // Just a standard identifier.
  ids.add(splits.join(''));

  // Then a camel case identifier (or possibly title case based on file name).
  const camelCaseSplits = [splits[0]];
  for (let i = 1; i < splits.length; i++) {
    camelCaseSplits.push(StringUtils.capitalize(splits[i]));
  }
  ids.add(camelCaseSplits.join(''));

  return ids;
}

function getLiteralFromPath(filePath: AbsolutePath): Literal {
  const baseName = path.basename(filePath);
  return removeFileType(baseName);
}

function relativizeForRequire(
  sourcePath: AbsolutePath,
  destPath: AbsolutePath,
): RelativePath {
  const relativePath = path.relative(path.dirname(sourcePath), destPath);
  const noFileType = removeFileType(relativePath);
  return !noFileType.startsWith('.') ? '.' + path.sep + noFileType : noFileType;
}

function removeFileType(str: string): string {
  const splits = str.split('.');
  if (splits.length <= 1) {
    return str;
  } else {
    return splits.slice(0, -1).join('.');
  }
}

const ModuleMapUtils = {
  getIdentifiersFromPath,
  getLiteralFromPath,
  relativizeForRequire,
};

export default ModuleMapUtils;
