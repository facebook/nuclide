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

import type {ObservableDiagnosticProvider} from 'atom-ide-ui';
import type {
  DiagnosticProviderUpdate,
  InvalidationMessage,
  FileDiagnosticMessage,
} from 'atom-ide-ui';
import type {Result} from 'nuclide-commons-atom/ActiveEditorRegistry';

import type {CoverageProvider} from '../lib/types';
import type {CoverageResult} from '../lib/rpc-types';

import invariant from 'assert';
import {Range} from 'atom';
import {Subject} from 'rxjs';

import {diagnosticProviderForResultStream} from '../lib/coverageDiagnostics';

describe('diagnosticProviderForResultStream', () => {
  let inputResults: Subject<
    Result<CoverageProvider, ?CoverageResult>,
  > = (null: any);
  let isEnabledStream: Subject<boolean> = (null: any);

  let diagnosticProvider: ObservableDiagnosticProvider = (null: any);

  let updates: Array<Array<FileDiagnosticMessage>> = (null: any);
  let invalidations: Array<InvalidationMessage> = (null: any);

  let editor: atom$TextEditor = (null: any);

  let provider: CoverageProvider = (null: any);
  let sampleResult: CoverageResult = (null: any);

  beforeEach(() => {
    updates = [];
    invalidations = [];
    inputResults = new Subject();
    isEnabledStream = new Subject();
    diagnosticProvider = diagnosticProviderForResultStream(
      inputResults,
      isEnabledStream,
    );

    // For now it's easy enough to stub out the editor but in the future it may be worthwhile to use
    // an action TextEditor object. We would need an actual fixture to open, though, since we rely
    // on the path being non-null (so `atom.workspace.open()` would not be sufficient).
    editor = ({
      getPath() {
        return 'foo';
      },
    }: any);

    provider = {
      getCoverage() {
        return Promise.resolve(null);
      },
      priority: 1,
      grammarScopes: [],
      displayName: 'Foo',
    };

    sampleResult = {
      percentage: 90,
      uncoveredRegions: [
        {
          range: new Range([1, 2], [3, 4]),
        },
        {
          range: new Range([2, 3], [4, 5]),
          message: 'Custom message!!1!1!',
        },
      ],
    };

    diagnosticProvider.updates.subscribe((update: DiagnosticProviderUpdate) => {
      // We go through all this just to extract the array of file messages for the current file.
      const filePathToMessages = update.filePathToMessages;
      invariant(filePathToMessages != null);
      invariant(filePathToMessages.size === 1);
      const firstValue = filePathToMessages.values().next();
      invariant(firstValue.value != null);
      const fileMessages: Array<FileDiagnosticMessage> = firstValue.value;
      updates.push(fileMessages);
    });
    diagnosticProvider.invalidations.subscribe(invalidation =>
      invalidations.push(invalidation),
    );
  });

  describe('diagnostic updates', () => {
    it('should emit an update with a diagnostic message for each uncovered region', () => {
      isEnabledStream.next(true);
      inputResults.next({
        kind: 'result',
        result: sampleResult,
        editor,
        provider,
      });
      expect(updates.length).toBe(1);
      expect(updates[0]).toEqual([
        {
          scope: 'file',
          providerName: 'Type Coverage',
          type: 'Warning',
          filePath: 'foo',
          range: sampleResult.uncoveredRegions[0].range,
          text: 'Not covered by Foo',
        },
        {
          scope: 'file',
          providerName: 'Type Coverage',
          type: 'Warning',
          filePath: 'foo',
          range: sampleResult.uncoveredRegions[1].range,
          text: 'Custom message!!1!1!',
        },
      ]);
      expect(invalidations.length).toBe(0);
    });

    it('should not emit an update before it has been switched on', () => {
      inputResults.next({
        kind: 'result',
        result: sampleResult,
        editor,
        provider,
      });
      expect(updates.length).toBe(0);
    });

    it('should not emit an update after it has been switched off', () => {
      isEnabledStream.next(true);
      isEnabledStream.next(false);
      inputResults.next({
        kind: 'result',
        result: sampleResult,
        editor,
        provider,
      });
      expect(updates.length).toBe(0);
    });
  });

  describe('diagnostic invalidations', () => {
    const invalidateAll = {scope: 'all'};

    it('should emit an invalidation when toggled off', () => {
      isEnabledStream.next(true);
      expect(invalidations).toEqual([]);
      isEnabledStream.next(false);
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation when no text editor has focus', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'not-text-editor'});
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation when there is no provider for the current editor', () => {
      isEnabledStream.next(true);
      // Cheat the type system a bit -- if necessary we can fill in all the fields in the future
      inputResults.next(({kind: 'no-provider'}: any));
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation when the provider throws an error', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'provider-error', provider});
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should emit an invalidation on a pane change', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'pane-change', editor});
      expect(invalidations).toEqual([invalidateAll]);
    });

    it('should not emit an invalidation on edit or save', () => {
      isEnabledStream.next(true);
      inputResults.next({kind: 'edit', editor});
      inputResults.next({kind: 'save', editor});
      expect(invalidations).toEqual([]);
    });
  });
});
