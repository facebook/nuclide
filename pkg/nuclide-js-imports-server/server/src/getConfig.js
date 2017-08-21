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

export type HasteSettings = {
  isHaste: boolean,
  blacklistedDirs: Array<NuclideUri>,
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
    blacklistedDirs: [],
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
  const resolveDirs = flowFileContents.match(
    /module.system.haste.paths.blacklist=([^\s]+)/g,
  );
  return {
    isHaste,
    blacklistedDirs:
      isHaste && resolveDirs
        ? resolveDirs
            .map(dirString => dirString.split('=')[1])
            .map(line => line.replace('<PROJECT_ROOT>', root))
        : [],
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
