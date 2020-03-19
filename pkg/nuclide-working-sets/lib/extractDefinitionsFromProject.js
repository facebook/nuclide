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

import type {WorkingSetDefinition} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import nuclideUri from 'nuclide-commons/nuclideUri';

export default function extractDefinitionsFromProject(
  spec: ?atom$ProjectSpecification,
): Array<WorkingSetDefinition> {
  if (spec == null) {
    return [];
  }
  // $FlowFixMe: Add this to the type after it's settled.
  const raw = spec.workingSets;
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(rawDef => validateProjectWorkingSetDefinition(rawDef, spec.originPath))
    .filter(Boolean);
}

function validateProjectWorkingSetDefinition(
  raw: ?mixed,
  originPath: NuclideUri,
): ?WorkingSetDefinition {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const {name, initiallyActive, paths} = raw;
  if (
    name == null ||
    typeof name !== 'string' ||
    paths == null ||
    !Array.isArray(paths)
  ) {
    return null;
  }

  const dirname = nuclideUri.dirname(originPath);
  return {
    name,
    active: initiallyActive === true,
    sourceType: 'project',
    // Currently, working set URIs are represented as absolute paths. This was a workaround to support
    // an internal FB feature, but it's a little hacky and may change in the future.
    uris: paths
      .map(
        path =>
          typeof path !== 'string'
            ? null
            : nuclideUri.getPath(nuclideUri.resolve(dirname, path)),
      )
      .filter(Boolean),
  };
}
