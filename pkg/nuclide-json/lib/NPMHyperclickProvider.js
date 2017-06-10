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

import type {HyperclickProvider, HyperclickSuggestion} from 'atom-ide-ui';

import semver from 'semver';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {shell} from 'electron';

import {parseJSON, babelLocToRange} from './parsing';

const DEPENDENCY_PROPERTIES = new Set([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
]);

export function getNPMHyperclickProvider(): HyperclickProvider {
  return npmHyperclickProvider;
}

const npmHyperclickProvider = {
  priority: 1,
  providerName: 'npm-package-json',
  getSuggestionForWord,
  // Capture just text in quotes
  wordRegExp: /"[^"]*"/g,
};

function getSuggestionForWord(
  textEditor: atom$TextEditor,
  text: string,
  range: atom$Range,
): Promise<?HyperclickSuggestion> {
  if (text === '' || !isPackageJson(textEditor)) {
    return Promise.resolve(null);
  }

  const packageUrl = getPackageUrlForRange(textEditor.getText(), text, range);

  if (packageUrl == null) {
    return Promise.resolve(null);
  }

  const suggestion: HyperclickSuggestion = {
    range,
    callback: () => {
      shell.openExternal(packageUrl);
    },
  };
  return Promise.resolve(suggestion);
}

// Exported for testing. We could derive the token from the json text and the range, but since
// hyperclick provides it we may as well use it.
export function getPackageUrlForRange(
  json: string,
  token: string,
  range: atom$Range,
): ?string {
  const version = getDependencyVersion(json, range);
  if (version == null) {
    return null;
  }

  // Strip off the quotes
  const packageName = token.substring(1, token.length - 1);

  return getPackageUrl(packageName, version);
}

function isPackageJson(textEditor: atom$TextEditor): boolean {
  const scopeName = textEditor.getGrammar().scopeName;
  const filePath = textEditor.getPath();
  return (
    scopeName === 'source.json' &&
    filePath != null &&
    nuclideUri.basename(filePath) === 'package.json'
  );
}

function getPackageUrl(packageName: string, version: string): ?string {
  if (semver.valid(version)) {
    return `https://www.npmjs.com/package/${packageName}/`;
  }

  // - optionally prefixed with 'github:' (but don't capture that)
  // - all captured together:
  //   - username: alphanumeric characters, plus underscores and dashes
  //   - slash
  //   - repo name: same as username
  // - optionally followed by a revision:
  //   - starts with a hash (not captured)
  //   - then alphanumeric characters, underscores, dashes, periods (captured)
  const githubRegex = /^(?:github:)?([\w-]+\/[\w-]+)(?:#([\w-.]+))?$/;
  const githubMatch = version.match(githubRegex);
  if (githubMatch != null) {
    const commit = githubMatch[2];
    const commitSuffix = commit == null ? '' : `/tree/${commit}`;
    return `https://github.com/${githubMatch[1]}${commitSuffix}`;
  }

  return null;
}

// Return the version string, if it exists
function getDependencyVersion(json: string, range: atom$Range): ?string {
  const ast = parseJSON(json);
  if (ast == null) {
    // parse error
    return null;
  }
  const pathToNode = getPathToNodeForRange(ast, range);

  if (
    pathToNode != null &&
    pathToNode.length === 2 &&
    DEPENDENCY_PROPERTIES.has(pathToNode[0].key.value) &&
    isValidVersion(pathToNode[1].value)
  ) {
    const valueNode = pathToNode[1].value;
    if (isValidVersion(valueNode)) {
      return valueNode.value;
    } else {
      return null;
    }
  }
  return null;
}

function isValidVersion(valueASTNode: Object): boolean {
  return valueASTNode.type === 'StringLiteral';
}

// return an array of property AST nodes
function getPathToNodeForRange(
  objectExpression: Object,
  range: atom$Range,
): ?Array<Object> {
  const properties = objectExpression.properties;
  if (properties == null) {
    return null;
  }
  for (const property of properties) {
    const propertyRange = babelLocToRange(property.loc);
    if (propertyRange.containsRange(range)) {
      const keyRange = babelLocToRange(property.key.loc);
      if (keyRange.isEqual(range)) {
        return [property];
      }
      const subPath = getPathToNodeForRange(property.value, range);
      if (subPath == null) {
        return null;
      }
      subPath.unshift(property);
      return subPath;
    }
  }
  return null;
}
