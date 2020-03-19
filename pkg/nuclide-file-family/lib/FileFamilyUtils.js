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

import type {FileGraph} from './types';

import {arrayUnique} from 'nuclide-commons/collection';

export function getAlternatesFromGraph(graph: FileGraph, activeUri: string) {
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  return arrayUnique(
    graph.relations
      .filter(
        r =>
          r.from === activeUri &&
          (r.labels.has('test') || r.labels.has('alternate')),
      )
      .sort((rA, rB) => {
        // Have existing files come before non-existing files.
        const a = graph.files.get(rA.to);
        const b = graph.files.get(rB.to);
        if (a == null || b == null) {
          return 0;
        }
        return !a.exists && b.exists ? 1 : a.exists && !b.exists ? -1 : 0;
      })
      .map(relation => relation.to),
  );
}
