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

import type ModuleMap from '../common/state/ModuleMap';
import type {SourceOptions} from '../common/options/SourceOptions';
import type {TransformKey} from '../common/types/transforms';
import builtIns from './constants/builtIns';
import builtInTypes from './constants/builtInTypes';
import commonAliases from './constants/commonAliases';
import ModuleMapClass from './state/ModuleMap';

// Nuclide package settings used to calculate the module map,
// the blacklist, and control the plugin behavior.
export type Settings = {
  aliases: Array<[string, string]>,
  alwaysAddMissingNames: Array<string>,
  builtIns: Array<string>,
  builtInTypes: Array<string>,
  jsxNonReactNames: Array<string>,
  jsxSuffix: boolean,
  nuclideFixHeader: boolean,
  requiresTransferComments: boolean,
  requiresRemoveUnusedRequires: boolean,
  requiresAddMissingRequires: boolean,
  requiresRemoveUnusedTypes: boolean,
  requiresAddMissingTypes: boolean,
  requiresFormatRequires: boolean,
};

export function getDefaultSettings(): Settings {
  return {
    aliases: [['Immutable', 'immutable'], ['fbt', 'fbt']],
    alwaysAddMissingNames: [],
    builtIns: [],
    builtInTypes: [],
    jsxNonReactNames: ['fbt'],
    jsxSuffix: true,
    nuclideFixHeader: true,
    requiresTransferComments: true,
    requiresRemoveUnusedRequires: true,
    requiresAddMissingRequires: true,
    requiresRemoveUnusedTypes: true,
    requiresAddMissingTypes: true,
    requiresFormatRequires: true,
  };
}

function createModuleMap(options) {
  return new ModuleMapClass(options);
}

// We need this in array formats.
const defaultAliases = Array.from(commonAliases);
const defaultBuiltIns = Array.from(builtIns);
const defaultBuiltInTypes = Array.from(builtInTypes);

/**
 * Calculates the current options according to the Nuclide configuration object.
 * This may get expensive in the future as the module map becomes smarter.
 */
export function calculateOptions(settings: Settings): SourceOptions {
  return {
    blacklist: calculateBlacklist(settings),
    dontAddMissing: true,
    moduleMap: calculateModuleMap(settings),
    jsxSuffix: settings.jsxSuffix,
    jsxNonReactNames: new Set(settings.jsxNonReactNames),
  };
}

/**
 * Calculates a module map from the settings.
 */
function calculateModuleMap(settings: Settings): ModuleMap {
  // Construct the aliases.
  const aliases = new Map(settings.aliases);
  for (const entry of defaultAliases) {
    const [key, value] = entry;
    if (!aliases.has(key)) {
      aliases.set(key, value);
    }
  }

  // Construct the built ins.
  const localBuiltIns = new Set(defaultBuiltIns);
  for (const builtIn of settings.builtIns) {
    localBuiltIns.add(builtIn);
  }

  // Construct built in types.
  const localBuiltInTypes = new Set(defaultBuiltInTypes);
  for (const builtInType of settings.builtInTypes) {
    localBuiltInTypes.add(builtInType);
  }

  // And then calculate the module map.
  return createModuleMap({
    paths: [],
    pathsToRelativize: [],
    aliases,
    aliasesToRelativize: new Map(),
    builtIns: localBuiltIns,
    builtInTypes: localBuiltInTypes,
  });
}

/**
 * Calculates the blacklist from the settings.
 */
function calculateBlacklist(settings: Settings): Set<TransformKey> {
  const blacklist = new Set();
  if (!settings.nuclideFixHeader) {
    blacklist.add('nuclide.fixHeader');
  }
  if (!settings.requiresTransferComments) {
    blacklist.add('requires.transferComments');
  }
  if (!settings.requiresRemoveUnusedRequires) {
    blacklist.add('requires.removeUnusedRequires');
  }
  if (!settings.requiresAddMissingRequires) {
    blacklist.add('requires.addMissingRequires');
  }
  if (!settings.requiresRemoveUnusedTypes) {
    blacklist.add('requires.removeUnusedTypes');
  }
  if (!settings.requiresAddMissingTypes) {
    blacklist.add('requires.addMissingTypes');
  }
  if (!settings.requiresFormatRequires) {
    blacklist.add('requires.formatRequires');
  }
  return blacklist;
}
