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
import * as globalsModule from 'globals';
import {getLogger} from 'log4js';
import vm from 'vm';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const ALL_ENVS = Object.keys(globalsModule);

export type ConfigFromFlow = $ReadOnly<{|
  moduleDirs: Array<NuclideUri>,
  hasteSettings: HasteSettings,
|}>;

/**
 * Haste settings are surprisingly complicated.
 * - isHaste enables haste modules. All files with a @providesModule docblock may be imported
 *   via their module name, without using the full path.
 * - When useNameReducers is enabled, we'll attempt to resolve whitelisted files *without*
 *   @providesModule purely using their name, excluding files in the blacklist.
 */
export type HasteSettings = $ReadOnly<{|
  isHaste: boolean,
  useNameReducers: boolean,
  nameReducers: Array<{regexp: RegExp, replacement: string}>,
  nameReducerWhitelist: Array<RegExp>,
  nameReducerBlacklist: Array<RegExp>,
|}>;

export function serializeConfig(config: ConfigFromFlow): string {
  const {moduleDirs, hasteSettings: settings} = config;
  // RegExps aren't normally stringifyable.
  return JSON.stringify({
    moduleDirs,
    hasteSettings: {
      isHaste: settings.isHaste,
      useNameReducers: settings.useNameReducers,
      nameReducers: settings.nameReducers.map(reducer => ({
        regexp: reducer.regexp.toString(),
        replacement: reducer.replacement,
      })),
      nameReducerBlacklist: settings.nameReducerBlacklist.map(String),
      nameReducerWhitelist: settings.nameReducerWhitelist.map(String),
    },
  });
}

export function getEslintGlobals(root: NuclideUri): Array<string> {
  return (
    parseEslintrc(nuclideUri.join(root, '.eslintrc')) ||
    parseEslintrcJs(nuclideUri.join(root, '.eslintrc.js')) ||
    packageJsonEslintConfig(nuclideUri.join(root, 'package.json')) ||
    Array.from(getGlobalsForEnvs(ALL_ENVS))
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
    moduleDirs = flowConfigToResolveDirnames(
      flowFile,
      flowConfigContents,
    ).concat(getYarnWorkspaces(root));
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
    : [nuclideUri.join(nuclideUri.dirname(flowFile), 'node_modules')];
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

function parseEslintrc(eslintFile: string): ?Array<string> {
  try {
    const json = JSON.parse(fs.readFileSync(eslintFile, 'utf8'));
    return parseEslintConfig(json);
  } catch (err) {}
  return null;
}

function parseEslintrcJs(eslintFile: string): ?Array<string> {
  try {
    const js = fs.readFileSync(eslintFile, 'utf8');
    // Hopefully .eslintrc.js doesn't require very much.
    const sandbox: any = {module: {}, require};
    const context = vm.createContext(sandbox);
    vm.runInContext(js, context);
    if (sandbox.module.exports) {
      return parseEslintConfig(sandbox.module.exports);
    } else if (sandbox.exports) {
      return parseEslintConfig(sandbox.exports);
    }
  } catch (err) {}
  return null;
}

function packageJsonEslintConfig(packageJsonFile: string): ?Array<string> {
  try {
    const json = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    if (json.eslintConfig) {
      return parseEslintConfig(json.eslintConfig);
    }
  } catch (err) {}
  return null;
}

function parseEslintConfig(config: Object): Array<string> {
  let globals = new Set();
  if (config.globals && typeof config.globals === 'object') {
    globals = new Set(Object.keys(config.globals));
  }
  let envs = ALL_ENVS;
  if (config.env && typeof config.env === 'object') {
    envs = Object.keys(config.env).filter(key => config.env[key]);
  }
  getGlobalsForEnvs(envs).forEach(x => globals.add(x));
  return Array.from(globals);
}

function getGlobalsForEnvs(envs: Array<string>): Set<string> {
  const globals = new Set();
  envs.forEach(env => {
    if (globalsModule[env]) {
      Object.keys(globalsModule[env]).forEach(x => globals.add(x));
    }
  });
  return globals;
}

function getYarnWorkspaces(root: string): Array<string> {
  try {
    const packageJsonFile = nuclideUri.join(root, 'package.json');
    const json = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    if (Array.isArray(json.workspaces)) {
      return Array.from(
        new Set(
          json.workspaces
            .map(workspace => {
              // Yarn workspaces can be a glob pattern (folder/*) or specific paths.
              // Either way, getting the dirname should work for most cases.
              if (typeof workspace === 'string') {
                try {
                  return nuclideUri.resolve(
                    root,
                    nuclideUri.dirname(workspace),
                  );
                } catch (err) {
                  getLogger('js-imports-server').error(
                    `Could not parse Yarn workspace: ${workspace}`,
                    err,
                  );
                  return null;
                }
              }
            })
            .filter(Boolean),
        ),
      );
    }
  } catch (err) {}
  return [];
}
