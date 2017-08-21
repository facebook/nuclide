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

type Target = {path: NuclideUri, name: string};

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {HyperclickSuggestion} from 'atom-ide-ui';
import type {Point} from 'atom';

import {getBuckProjectRoot} from '../../nuclide-buck-base';
import {getBuildFileName} from './buildFiles';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import nuclideUri from 'nuclide-commons/nuclideUri';
import escapeStringRegExp from 'escape-string-regexp';

/**
 * Takes target regex match and file path where given target is found as
 * arguments.
 * Returns target as object with path and name properties.
 * For example, input match
 * ['//Apps/MyApp:MyTarget', '//Apps/MyApp', 'MyTarget'] would be parsed to
 * {path: //Apps/MyApp/BUCK, name: MyTarget} and ':MyTarget' would be
 * parsed to {path: filePath, name: MyTarget}.
 * Returns null if target cannot be parsed from given arguments.
 */
export async function parseTarget(
  match: Array<?string> | Array<string>,
  filePath: ?NuclideUri,
  buckRoot: string,
): Promise<?Target> {
  // flowlint-next-line sketchy-null-string:off
  if (!match || !filePath) {
    return null;
  }

  let path;
  const fullTarget = match[1];
  // flowlint-next-line sketchy-null-string:off
  if (fullTarget) {
    // Strip off the leading slashes from the fully-qualified build target.
    const basePath = fullTarget.substring('//'.length);

    const buildFileName = await getBuildFileName(buckRoot);
    path = nuclideUri.join(buckRoot, basePath, buildFileName);
  } else {
    // filePath is already an absolute path.
    path = filePath;
  }
  const name = match[2];
  // flowlint-next-line sketchy-null-string:off
  if (!name) {
    return null;
  }
  return {path, name};
}

/**
 * Takes a target as an argument.
 * Returns a Promise that resolves to a target location.
 * If the exact position the target in the file cannot be determined
 * position property of the target location will be set to null.
 * If `target.path` file cannot be found or read, Promise resolves to null.
 */
export async function findTargetLocation(target: Target): Promise<any> {
  let data;
  try {
    const fs = getFileSystemServiceByNuclideUri(target.path);
    data = (await fs.readFile(target.path)).toString('utf8');
  } catch (e) {
    return null;
  }

  // We split the file content into lines and look for the line that looks
  // like "name = '#{target.name}'" ignoring whitespaces and trailling
  // comma.
  const lines = data.split('\n');
  const regex = new RegExp(
    '^\\s*' + // beginning of the line
    'name\\s*=\\s*' + // name =
    '[\'"]' + // opening quotation mark
    escapeStringRegExp(target.name) + // target name
    '[\'"]' + // closing quotation mark
      ',?$', // optional trailling comma
  );

  let lineIndex = 0;
  lines.forEach((line, i) => {
    if (regex.test(line)) {
      lineIndex = i;
    }
  });

  return {path: target.path, line: lineIndex, column: 0};
}

const VALID_BUILD_FILE_NAMES = new Set(['BUCK', 'BUCK.autodeps', 'TARGETS']);

export async function getSuggestion(
  textEditor: TextEditor,
  position: Point,
): Promise<?HyperclickSuggestion> {
  const absolutePath: ?NuclideUri = textEditor.getPath();
  if (absolutePath == null) {
    return null;
  }

  const baseName = nuclideUri.basename(absolutePath);
  if (!VALID_BUILD_FILE_NAMES.has(baseName)) {
    return null;
  }

  const buckRoot = await getBuckProjectRoot(absolutePath);
  // flowlint-next-line sketchy-null-string:off
  if (!buckRoot) {
    return null;
  }

  const results = await Promise.all([
    findBuildTarget(textEditor, position, absolutePath, buckRoot),
    findRelativeFilePath(
      textEditor,
      position,
      nuclideUri.dirname(absolutePath),
    ),
  ]);
  const hyperclickMatch = results.find(x => x != null);

  if (hyperclickMatch != null) {
    const match = hyperclickMatch;
    return {
      range: match.range,
      callback() {
        goToLocation(match.path, match.line, match.column);
      },
    };
  } else {
    return null;
  }
}

type HyperclickMatch = {
  path: string,
  line: number,
  column: number,
  range: atom$Range,
};

const TARGET_REGEX = /(\/(?:\/[\w.-]*)*){0,1}:([\w.-]+)/;

/**
 * @return HyperclickMatch if (textEditor, position) identifies a build target.
 */
async function findBuildTarget(
  textEditor: atom$TextEditor,
  position: atom$Point,
  absolutePath: string,
  buckRoot: string,
): Promise<?HyperclickMatch> {
  const wordMatchAndRange = wordAtPosition(textEditor, position, TARGET_REGEX);
  if (wordMatchAndRange == null) {
    return null;
  }
  const {wordMatch, range} = wordMatchAndRange;

  const target = await parseTarget(wordMatch, absolutePath, buckRoot);
  if (target == null) {
    return null;
  }

  const location = await findTargetLocation(target);
  if (location != null) {
    return {...location, range};
  } else {
    return null;
  }
}

const RELATIVE_FILE_PATH_REGEX = /(['"])(.*)(['"])/;

/**
 * @return HyperclickMatch if (textEditor, position) identifies a file path that resolves to a file
 *   under the specified directory.
 */
async function findRelativeFilePath(
  textEditor: atom$TextEditor,
  position: atom$Point,
  directory: NuclideUri,
): Promise<?HyperclickMatch> {
  const wordMatchAndRange = wordAtPosition(
    textEditor,
    position,
    RELATIVE_FILE_PATH_REGEX,
  );
  if (!wordMatchAndRange) {
    return null;
  }
  const {wordMatch, range} = wordMatchAndRange;

  // Make sure that the quotes match up.
  if (wordMatch[1] !== wordMatch[3]) {
    return null;
  }

  const potentialPath = nuclideUri.join(directory, wordMatch[2]);
  let stat;
  try {
    const fs = getFileSystemServiceByNuclideUri(potentialPath);
    stat = await fs.stat(potentialPath);
  } catch (e) {
    return null;
  }

  if (stat.isFile()) {
    return {
      path: potentialPath,
      line: 0,
      column: 0,
      range,
    };
  } else {
    return null;
  }
}
