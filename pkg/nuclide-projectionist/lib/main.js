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

import type {ProjectionistRules, Projection} from './types';

import micromatch from 'micromatch';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';
import {
  arrayFlatten,
  arrayUnique,
  arrayCompact,
} from 'nuclide-commons/collection';

export default class Projectionist {
  rules: ProjectionistRules;

  constructor(rules: ProjectionistRules) {
    this.rules = rules;
  }

  getAlternates(projectRelativePath: string): Array<string> {
    return mapProjections(
      this.rules,
      projectRelativePath,
      (projection, matches) => {
        const alternate = projection.alternate;
        if (alternate == null) {
          return [];
        }

        const alternates =
          typeof alternate === 'string' ? [alternate] : alternate;

        return alternates.map(alt =>
          replaceTargetsWithMatches(alt, matches, projectRelativePath),
        );
      },
    );
  }

  getType(projectRelativePath: string): ?string {
    return arrayCompact(
      mapProjections(this.rules, projectRelativePath, projection => [
        projection.type,
      ]),
    )[0];
  }
}

function mapProjections<T>(
  rules: ProjectionistRules,
  projectRelativePath: string,
  mapFn: (projection: Projection, matches: null | Array<string>) => Array<T>,
): Array<T> {
  const toFlatten = Object.keys(rules).map(pattern => {
    const value = rules[pattern];
    if (isProjection(value)) {
      const innerRules = ((value: any): ProjectionistRules);
      return mapProjections(innerRules, projectRelativePath, mapFn);
    } else {
      const projection = ((value: any): Projection);

      const matches = micromatch.capture(
        normalizePattern(pattern),
        projectRelativePath,
      );

      const matchesBaseName = micromatch.isMatch(projectRelativePath, pattern, {
        matchBase: true,
      });

      const shouldBeExcluded =
        projection.exclude != null &&
        matchesAny(projectRelativePath, projection.exclude);
      if (shouldBeExcluded) {
        return;
      }

      const doesMatch =
        matches != null ||
        // basename matches ('*.c' to glob any c file) are treated specially
        matchesBaseName ||
        // an exact prefix match is okay too
        projectRelativePath.startsWith(pattern);
      if (doesMatch) {
        return mapFn(projection, matches);
      }
    }
  });

  return arrayUnique(arrayFlatten(arrayCompact(toFlatten)));
}

const RULES_KEY_RE = /\*|\//;
function isProjection(maybeProjection: Object): boolean {
  return Object.keys(maybeProjection).some(key => key.match(RULES_KEY_RE));
}

const keywordReplacements = {
  '{}': match => match,
  '{basename}': match => basenameWithoutExtension(match),
  '{dirname}': match => match,
};

function replaceTargetsWithMatches(
  stringWithTargets: string,
  matches: null | Array<string>,
  projectRelativePath: string,
) {
  if (matches == null) {
    return path.join(
      path.dirname(projectRelativePath),
      stringWithTargets.replace('{}', basenameWithoutExtension),
    );
  }

  const targets = stringWithTargets.match(/({.*?})/g);
  if (targets == null) {
    return stringWithTargets;
  }

  let replaced = stringWithTargets;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (i === targets.length - 1 && targets.length < matches.length) {
      replaced = replaced.replace(
        target,
        keywordReplacements[target](path.join(...matches.slice(i))),
      );
    } else {
      replaced = replaced.replace(
        target,
        keywordReplacements[target](matches[i]),
      );
    }
  }
  return replaced;
}

// vim-projectionist seems to treat the last star as **/* rather than *
function normalizePattern(pattern: string) {
  const lastStarIndex = pattern.lastIndexOf('*');
  if (lastStarIndex === -1) {
    return pattern;
  }
  return (
    pattern.slice(0, lastStarIndex) + '**/*' + pattern.slice(lastStarIndex + 1)
  );
}

function basenameWithoutExtension(pathString) {
  return path.basename(pathString, path.extname(pathString));
}

function matchesAny(
  projectRelativePath: string,
  patterns: string | Array<string>,
): boolean {
  if (Array.isArray(patterns)) {
    return patterns.some(pattern =>
      micromatch.isMatch(projectRelativePath, normalizePattern(pattern)),
    );
  }

  return micromatch.isMatch(projectRelativePath, normalizePattern(patterns));
}
