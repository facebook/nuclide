/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import * as BuckService from '../../nuclide-buck-rpc';

export type BuildTarget = string;

export async function getRustBuildFile(
  buckRoot: string,
  buildTarget: BuildTarget,
): Promise<?string> {
  return BuckService.query(
    buckRoot,
    `buildfile(kind('^rust_.*', ${buildTarget}))`,
    [],
  ).then(buildfiles => buildfiles[0] || null);
}

export function getRustInputs(
  buckRoot: string,
  buildTarget: BuildTarget,
): Promise<Array<string>> {
  return BuckService.query(
    buckRoot,
    `filter('.*\\.rs$', inputs(kind('^rust_.*', ${buildTarget})))`,
    [],
  );
}

export async function getSaveAnalysisTargets(
  buckRoot: string,
  buildTarget: BuildTarget,
): Promise<Array<string>> {
  // Save-analysis build flavor is only supported by rust_{binary, library}
  // kinds (so exclude prebuilt_rust_library kind)
  const query: string = `kind('^rust_.*', deps(${buildTarget}))`;

  const deps = await BuckService.query(buckRoot, query, []);
  return deps.map(dep => dep + '#save-analysis');
}

// FIXME: Copied from nuclide-buck-rpc
// Buck query doesn't allow omitting // or adding # for flavors, this needs to be fixed in buck.
export function normalizeNameForBuckQuery(aliasOrTarget: string): BuildTarget {
  let canonicalName = aliasOrTarget;
  // Don't prepend // for aliases (aliases will not have colons or .)
  if (
    (canonicalName.indexOf(':') !== -1 || canonicalName.indexOf('.') !== -1) &&
    canonicalName.indexOf('//') === -1
  ) {
    canonicalName = '//' + canonicalName;
  }
  // Strip flavor string
  const flavorIndex = canonicalName.indexOf('#');
  if (flavorIndex !== -1) {
    canonicalName = canonicalName.substr(0, flavorIndex);
  }
  return canonicalName;
}
