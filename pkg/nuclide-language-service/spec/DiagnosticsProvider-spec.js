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

import typeof * as DiagnosticsProviderFile from '../lib/DiagnosticsProvider';
import type {FileDiagnosticsProvider} from '../lib/DiagnosticsProvider';
import type {LanguageService} from '../lib/LanguageService';

import {clearRequireCache, uncachedRequire} from '../../nuclide-test-helpers';

describe('DiagnosticsProvider', () => {
  let diagnosticsProvider: FileDiagnosticsProvider<
    LanguageService,
  > = (null: any);

  beforeEach(() => {
    class FakeProviderBase {
      dispose() {}
    }
    const file: DiagnosticsProviderFile = (uncachedRequire(
      require,
      '../lib/DiagnosticsProvider',
    ): any);
    const busySignalProvider = {
      reportBusyWhile<T>(message, f: () => Promise<T>): Promise<T> {
        return f();
      },
    };
    diagnosticsProvider = new file.FileDiagnosticsProvider(
      'Hack',
      ['text.html.hack', 'text.html.php'],
      false,
      'hack.diagnostics',
      (null: any), // connectionToLanguageService
      busySignalProvider,
      (FakeProviderBase: any),
    );
  });

  afterEach(() => {
    clearRequireCache(require, '../lib/DiagnosticsProvider');
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
