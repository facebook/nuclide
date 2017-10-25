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

import nuclideUri from 'nuclide-commons/nuclideUri';
import fs from 'fs';
import globals from 'globals';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const ALL_ENVS = Object.keys(globals);

type ConfigFromFlow = {
  moduleDirs: Array<NuclideUri>,
  hasteSettings: HasteSettings,
};

/**
 * Haste settings are surprisingly complicated.
 * - isHaste enables haste modules. All files with a @providesModule docblock may be imported
 *   via their module name, without using the full path.
 * - When useNameReducers is enabled, we'll attempt to resolve whitelisted files *without*
 *   @providesModule purely using their name, excluding files in the blacklist.
 */
export type HasteSettings = {
  isHaste: boolean,
  useNameReducers: boolean,
  nameReducers: Array<{regexp: RegExp, replacement: string}>,
  nameReducerWhitelist: Array<RegExp>,
  nameReducerBlacklist: Array<RegExp>,
};

export function getEslintEnvs(root: NuclideUri): Array<string> {
  const eslintFile = nuclideUri.join(root, '.eslintrc');
  const packageJsonFile = nuclideUri.join(root, 'package.json');
  return (
    eslintToEnvs(eslintFile) || packageJsonToEnvs(packageJsonFile) || ALL_ENVS
  );
}

export function getConfigFromFlow(root: NuclideUri): ConfigFromFlow {
  let moduleDirs = [];
  let hasteSettings = {
    isHaste: false,
    useNameReducers: false,
    nameReducers: [],
    nameReducerWhitelist: [],
    nameReducerBlacklist: [],
  };
  try {
    const flowFile = nuclideUri.join(root, '.flowconfig');
    const flowConfigContents = fs.readFileSync(flowFile, 'utf8');
    moduleDirs = flowConfigToResolveDirnames(flowFile, flowConfigContents);
    hasteSettings = flowConfigToHasteSettings(root, flowConfigContents);
  } catch (error) {}
  return {
    moduleDirs,
    hasteSettings,
  };
}

function flowConfigToResolveDirnames(
  flowFile: string,
  flowFileContents: string,
): Array<string> {
  const resolveDirs = flowFileContents.match(
    /module.system.node.resolve_dirname=([^\s]+)/g,
  );
  return resolveDirs
    ? resolveDirs.map(dirString =>
        nuclideUri.join(nuclideUri.dirname(flowFile), dirString.split('=')[1]),
      )
    : [];
}

function flowConfigToHasteSettings(
  root: NuclideUri,
  flowFileContents: string,
): HasteSettings {
  const isHaste = Boolean(flowFileContents.match(/module.system=haste/));
  const useNameReducers = Boolean(
    flowFileContents.match(/module.system.haste.use_name_reducers=true/),
  );
  function getPatterns(dirs: Array<string>) {
    return dirs
      .map(dirString => dirString.split('=')[1])
      .map(line => new RegExp(line.replace('<PROJECT_ROOT>', root)));
  }
  let nameReducers = [];
  let nameReducerWhitelist = [];
  let nameReducerBlacklist = [];
  if (useNameReducers) {
    const nameReducerMatches =
      flowFileContents.match(/module.system.haste.name_reducers=(.+)$/gm) || [];
    nameReducers = nameReducerMatches.map(line => {
      const value = line.substr(line.indexOf('=') + 1);
      // Default reducer (example):
      // '^.*/\([a-zA-Z0-9$_.-]+\.js\(\.flow\)?\)$' -> '\1'
      const [regexString, replacementString] = value
        .split('->')
        .map(x => x.trim());
      const regexp = new RegExp(
        // OCaml regexes escape parentheses.
        regexString
          .substr(1, regexString.length - 2)
          .replace(/\\([()])/g, '$1'),
      );
      // OCaml uses \1, \2 while JS uses $1, $2...
      const replacement = replacementString
        .substr(1, replacementString.length - 2)
        .replace(/\\[0-9]/g, '$$1');
      return {regexp, replacement};
    });
    nameReducerWhitelist = getPatterns(
      flowFileContents.match(/module.system.haste.paths.whitelist=([^\s]+)/g) ||
        [],
    );
    nameReducerBlacklist = getPatterns(
      flowFileContents.match(/module.system.haste.paths.blacklist=([^\s]+)/g) ||
        [],
    );
  }
  return {
    isHaste,
    useNameReducers,
    nameReducers,
    nameReducerWhitelist,
    nameReducerBlacklist,
  };
}

function eslintToEnvs(eslintFile: string): ?Array<string> {
  if (fs.existsSync(eslintFile)) {
    const json = JSON.parse(fs.readFileSync(eslintFile, 'utf8'));
    if (json.env) {
      return Object.keys(json.env).filter(env => json.env[env]);
    }
  }
  return null;
}

function packageJsonToEnvs(packageJsonFile: string): ?Array<string> {
  if (fs.existsSync(packageJsonFile)) {
    const json = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    if (json.eslintConfig && json.eslintConfig.env) {
      return Object.keys(json.eslintConfig.env).filter(
        env => json.eslintConfig.env[env],
      );
    }
  }
  return null;
}
