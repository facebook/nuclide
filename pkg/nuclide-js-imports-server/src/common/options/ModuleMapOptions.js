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

import type {AbsolutePath} from '../types/common';

export type ModuleMapOptions = {
  /**
   * These are paths to files that can be imported. Identifiers will be
   * generated based on the file's name. When required the import will NOT be
   * relativized.
   */
  paths: Array<AbsolutePath>,

  /**
   * These are paths to files that can be imported. Identifiers will be
   * generated based on the file's name. When required the import WILL be
   * relativized.
   */
  pathsToRelativize: Array<AbsolutePath>,

  /**
   * This is a map from identifier to literal that can be imported. For example
   * if a key is "assign" and its value is "object-assign"; then using "assign"
   * in code will result in this require being generated:
   *
   *   var assign = require('object-assign');
   *
   * The exact value will be used as the literal to require. It will not be
   * altered in any way.
   */
  aliases: Map<string, string>,

  /**
   * This is a map from identifier to path that can be imported. For example if
   * a key is "assign" and its value is "/path/to/src/object/my-assign.js"; then
   * using "assign" in a source file at the location "/path/to/src/main.js" will
   * result in this require being generated:
   *
   *   var assign = require('./object/my-assign.js');
   *
   * Notice how the exact value is not used. It is relativized based on the path
   * of the source code. This means the values in this map must be absolute
   * paths.
   */
  aliasesToRelativize: Map<string, AbsolutePath>,

  /**
   * This is the set of built in modules that do not need to be required.
   *
   * Note: This only applies to requires. Type imports will still be generated
   * for these modules unless they are also provided in 'builtInTypes'.
   */
  builtIns: Set<string>,

  /**
   * This is the set of built in types that do not need to be imported.
   *
   * Note: This only applies to type imports. Requires will still be generated
   * for these modules unless they are also provided in 'builtIns'.
   */
  builtInTypes: Set<string>,

  // TODO: useImportSyntax/useRequireSyntax: boolean,
  // TODO: exports: Map<string, Set<string>>,
  // TODO: exportsToRelativize: Map<AbsolutePath, Set<string>>,

  // TODO: option to configure which react to use
};
