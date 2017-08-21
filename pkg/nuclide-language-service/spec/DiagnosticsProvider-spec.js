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

import type {FileDiagnosticMessages} from 'atom-ide-ui';
import type {ConnectableObservable} from 'rxjs';
import type {LanguageService} from '../lib/LanguageService';

import {getLogger} from 'log4js';
import {Observable} from 'rxjs';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {
  FileDiagnosticsProvider,
  ObservableDiagnosticProvider,
} from '../lib/DiagnosticsProvider';

describe('FileDiagnosticsProvider', () => {
  let diagnosticsProvider: FileDiagnosticsProvider<
    LanguageService,
  > = (null: any);

  beforeEach(() => {
    class FakeProviderBase {
      dispose() {}
    }
    const busySignalProvider = {
      reportBusyWhile<T>(message, f: () => Promise<T>): Promise<T> {
        return f();
      },
    };
    diagnosticsProvider = new FileDiagnosticsProvider(
      'Hack',
      ['text.html.hack', 'text.html.php'],
      false,
      'hack.diagnostics',
      (null: any), // connectionToLanguageService
      busySignalProvider,
      (FakeProviderBase: any),
    );
  });

  describe('invalidateProjectPath', () => {
    it('should remove corresponding errors to certain hack language', () => {
      // Mock a diagnostic provider with 2 hack language roots, sharing common file real paths.
      const projectRootToFilePaths = new Map();
      const root1Paths = ['/hack/root1/file.js', '/hack/common/file.js'];
      const root2Paths = ['/hack/root2/file.js', '/hack/common/file.js'];
      projectRootToFilePaths.set('/hack/root1', new Set(root1Paths));
      projectRootToFilePaths.set('/hack/root2', new Set(root2Paths));
      diagnosticsProvider._projectRootToFilePaths = projectRootToFilePaths;
      // Mock the `publishMessageInvalidation` call to capture call arguments.
      const publishHandler = jasmine.createSpy('publish');
      (diagnosticsProvider._providerBase: any).publishMessageInvalidation = publishHandler;

      diagnosticsProvider.invalidateProjectPath('/hack/root1');
      expect(publishHandler.callCount).toBe(1);
      expect(publishHandler.argsForCall[0][0]).toEqual({
        scope: 'file',
        filePaths: root1Paths,
      });
      expect(diagnosticsProvider._projectRootToFilePaths.size).toBe(1);
      expect(
        diagnosticsProvider._projectRootToFilePaths.get('/hack/root2'),
      ).toEqual(new Set(root2Paths));
    });
  });
});

describe('ObservableDiagnosticsProvider', () => {
  let connectionCache;
  let diagnosticsProvider;

  const TEST_FILE = 'test.txt';
  const mockLanguageService: LanguageService = ({
    observeDiagnostics(): ConnectableObservable<Array<FileDiagnosticMessages>> {
      return Observable.of([{filePath: TEST_FILE, messages: []}]).publish();
    },
  }: any);

  beforeEach(() => {
    connectionCache = new ConnectionCache(
      () => Promise.resolve(mockLanguageService),
      /* lazy */ true,
    );
    diagnosticsProvider = new ObservableDiagnosticProvider(
      'Test',
      ['text.plain.null-grammar'],
      getLogger('DiagnosticsProvider-spec'),
      connectionCache,
    );
  });

  afterEach(() => {
    diagnosticsProvider.dispose();
  });

  it('starts a language server upon file open', () => {
    waitsForPromise(async () => {
      expect(connectionCache.getExistingForUri(TEST_FILE)).toBeNull();

      const updates = diagnosticsProvider.updates.take(1).toPromise();

      await atom.workspace.open(TEST_FILE);

      expect(await connectionCache.getExistingForUri(TEST_FILE)).toBe(
        mockLanguageService,
      );

      expect(await updates).toEqual({
        filePathToMessages: new Map([[TEST_FILE, []]]),
      });
    });
  });
});
