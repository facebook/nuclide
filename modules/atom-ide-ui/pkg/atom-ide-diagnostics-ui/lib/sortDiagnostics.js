/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {Row} from 'nuclide-commons-ui/Table';
import type {
  DiagnosticMessageKind,
  DiagnosticMessageType,
} from '../../atom-ide-diagnostics/lib/types';
import type {DisplayDiagnostic} from './types';

import invariant from 'assert';

type DiagnosticsComparison = (
  a: Row<DisplayDiagnostic>,
  b: Row<DisplayDiagnostic>,
) => number;

/*
 * Sorts the diagnostics according to given column and sort direction
 */
export default function sortDiagnostics(
  diagnostics: Array<Row<DisplayDiagnostic>>,
  sortedColumnName: $Keys<DisplayDiagnostic>,
  sortDescending: boolean,
): Array<Row<DisplayDiagnostic>> {
  const compare = SORT_FUNCTIONS[sortedColumnName];
  invariant(compare != null);
  // Don't sort in place.
  const sorted = diagnostics.slice().sort(compare);
  // We can't just reverse the sign of the comparison function because that would maintain the
  // ordering of "equal" items with respect to eachother.
  return sortDescending ? sorted.reverse() : sorted;
}

const SORT_FUNCTIONS = {
  classification: compose(
    compareClassification,
    compareSource,
    comparePath,
    compareDescription,
  ),
  providerName: compose(
    compareSource,
    compareClassification,
    compareDescription,
    comparePath,
  ),
  description: compose(
    compareDescription,
    compareSource,
    compareClassification,
    comparePath,
  ),
  dir: compose(
    comparePath,
    compareSource,
    compareClassification,
    compareDescription,
  ),
  location: compose(
    compareBasename,
    comparePath,
    compareClassification,
    compareSource,
    compareDescription,
  ),
  line: compose(
    compareBasename,
    comparePath,
    compareClassification,
    compareSource,
    compareDescription,
  ),
};

/**
 * Compose comparison functions so that, when one identifies the items as equal, the subsequent
 * functions are used to resolve the abiguity.
 */
function compose(
  ...comparisons: Array<DiagnosticsComparison>
): DiagnosticsComparison {
  return (a, b) => {
    for (const compare of comparisons) {
      const val = compare(a, b);
      if (val !== 0) {
        return val;
      }
    }
    return 0;
  };
}

function compareClassification(
  a: Row<DisplayDiagnostic>,
  b: Row<DisplayDiagnostic>,
): number {
  return (
    compareClassificationKind(
      a.data.classification.kind,
      b.data.classification.kind,
    ) ||
    compareClassificationSeverity(
      a.data.classification.severity,
      b.data.classification.severity,
    )
  );
}

const KIND_ORDER = ['review', 'lint'];

function compareClassificationKind(
  a: ?DiagnosticMessageKind,
  b: ?DiagnosticMessageKind,
): number {
  const aKind = a || 'lint';
  const bKind = b || 'lint';
  return KIND_ORDER.indexOf(aKind) - KIND_ORDER.indexOf(bKind);
}

const SEVERITY_ORDER = ['Info', 'Warning', 'Error'];

function compareClassificationSeverity(
  a: DiagnosticMessageType,
  b: DiagnosticMessageType,
): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

function compareSource(
  a: Row<DisplayDiagnostic>,
  b: Row<DisplayDiagnostic>,
): number {
  return compareStrings(a.data.providerName, b.data.providerName);
}

function compareDescription(
  a: Row<DisplayDiagnostic>,
  b: Row<DisplayDiagnostic>,
): number {
  return compareStrings(a.data.description.text, b.data.description.text);
}

function comparePath(
  a: Row<DisplayDiagnostic>,
  b: Row<DisplayDiagnostic>,
): number {
  const aLocation = a.data.location;
  const bLocation = b.data.location;
  if (aLocation == null && bLocation == null) {
    return 0;
  }
  if (aLocation == null) {
    return -1;
  }
  if (bLocation == null) {
    return 1;
  }
  const pathComparison = compareStrings(aLocation.fullPath, bLocation.fullPath);
  if (pathComparison !== 0) {
    return pathComparison;
  }
  const aLine =
    aLocation.locationInFile == null ? 0 : aLocation.locationInFile.line;
  const bLine =
    bLocation.locationInFile == null ? 0 : bLocation.locationInFile.line;
  return compareNumbers(aLine, bLine);
}

function compareBasename(
  a: Row<DisplayDiagnostic>,
  b: Row<DisplayDiagnostic>,
): number {
  const aLocationInFile = a.data.location && a.data.location.locationInFile;
  const bLocationInFile = b.data.location && b.data.location.locationInFile;
  if (aLocationInFile == null && bLocationInFile == null) {
    return 0;
  }
  if (aLocationInFile == null) {
    return -1;
  }
  if (bLocationInFile == null) {
    return 1;
  }
  return (
    compareStrings(aLocationInFile.basename, bLocationInFile.basename) ||
    compareNumbers(aLocationInFile.line, bLocationInFile.line)
  );
}

function compareStrings(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}
