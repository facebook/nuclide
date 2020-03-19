/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

/**
 * Utility to make it easier to register a file extension with a grammar,
 * overwriting existing registrations or adding duplicates. The
 * "core.customFileTypes" config was added in Atom v1.0.8.
 * https://github.com/atom/atom/releases/tag/v1.0.8
 *
 * Note on periods: Using the extension "cats" will match the files "file.cats"
 *   and "cats". The extension ".cats" will match a file named ".cats".
 *
 * @param scopeName for the grammar, such as "source.js" or "source.python"
 * @param extension when a file is opened that ends with this extension, its
 *   grammar will be updated to match that of the specified scopeName, if
 *   the grammar is available.
 * @return whether the extension was registered or not.
 */
export default function registerGrammar(
  scopeName: string,
  extensions: Array<string>,
): boolean {
  let customFileTypes = atom.config.get('core.customFileTypes');
  if (customFileTypes == null || typeof customFileTypes !== 'object') {
    customFileTypes = {};
  }

  let customFileType = customFileTypes[scopeName];
  if (!Array.isArray(customFileType)) {
    customFileTypes[scopeName] = customFileType = [];
  }

  let didChange = false;
  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];
    if (!customFileType.includes(extension)) {
      customFileType.push(extension);
      didChange = true;
    }
  }

  if (didChange) {
    atom.config.set('core.customFileTypes', customFileTypes);
    return true;
  }

  return false;
}
