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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Result} from 'nuclide-commons-atom/ActiveEditorRegistry';
import type {ObservableDiagnosticProvider} from 'atom-ide-ui';
import type {DiagnosticMessage, DiagnosticProviderUpdate} from 'atom-ide-ui';

import type {CoverageProvider} from './types';
import type {CoverageResult, UncoveredRegion} from './rpc-types';

import invariant from 'assert';
import {Observable} from 'rxjs';

import {toggle, compact} from 'nuclide-commons/observable';

export function diagnosticProviderForResultStream(
  results: Observable<Result<CoverageProvider, ?CoverageResult>>,
  isEnabledStream: Observable<boolean>,
): ObservableDiagnosticProvider {
  const toggledResults = results.let(toggle(isEnabledStream));

  return {
    updates: compact(toggledResults.map(diagnosticsForResult)),
    invalidations: Observable.merge(
      // Invalidate diagnostics when display is disabled
      isEnabledStream.filter(enabled => !enabled),
      toggledResults.filter(result => {
        switch (result.kind) {
          case 'not-text-editor':
          case 'no-provider':
          case 'provider-error':
          case 'pane-change':
            return true;
          case 'result':
            return result.result == null;
          default:
            return false;
        }
      }),
    ).mapTo({scope: 'all'}),
  };
}

/**
 * Preconditions:
 *   result.editor.getPath() != null
 *
 * This is reasonable because we only query providers when there is a path available for the current
 * text editor.
 */
function diagnosticsForResult(
  result: Result<CoverageProvider, ?CoverageResult>,
): ?DiagnosticProviderUpdate {
  if (result.kind !== 'result') {
    return null;
  }
  const value = result.result;
  if (value == null) {
    return null;
  }

  const editorPath = result.editor.getPath();
  invariant(editorPath != null);

  const providerName = result.provider.displayName;

  const diagnostics = value.uncoveredRegions.map(region =>
    uncoveredRangeToDiagnostic(region, editorPath, providerName),
  );

  return new Map([[editorPath, diagnostics]]);
}

function uncoveredRangeToDiagnostic(
  region: UncoveredRegion,
  path: NuclideUri,
  providerName: string,
): DiagnosticMessage {
  const text =
    region.message != null ? region.message : `Not covered by ${providerName}`;
  return {
    providerName: 'Type Coverage',
    type: 'Warning',
    filePath: path,
    range: region.range,
    text,
  };
}
