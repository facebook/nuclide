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

import ModuleMap from './ModuleMap';
import commonAliases from '../constants/commonAliases';
import builtIns from '../constants/builtIns';
import builtInTypes from '../constants/builtInTypes';

const DefaultModuleMap = new ModuleMap({
  paths: [],
  pathsToRelativize: [],
  aliases: commonAliases,
  aliasesToRelativize: new Map(),
  builtIns,
  builtInTypes,
});

export default DefaultModuleMap;
