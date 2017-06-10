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

import type {BusySignalService} from '../../nuclide-busy-signal';
import type {LinterProvider} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import * as ArcanistDiagnosticsProvider from './ArcanistDiagnosticsProvider';

class Activation {
  _disposables: UniversalDisposable;
  _busySignalService: ?BusySignalService;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeBusySignal(service: BusySignalService): IDisposable {
    this._disposables.add(service);
    this._busySignalService = service;
    return new UniversalDisposable(() => {
      this._disposables.remove(service);
      this._busySignalService = null;
    });
  }

  provideLinter(): LinterProvider {
    return {
      name: 'Arc',
      grammarScopes: ['*'],
      scope: 'file',
      lint: editor => {
        const path = editor.getPath();
        if (path == null) {
          return null;
        }
        if (this._busySignalService == null) {
          return ArcanistDiagnosticsProvider.lint(editor);
        }
        return this._busySignalService.reportBusyWhile(
          `Waiting for arc lint results for \`${editor.getTitle()}\``,
          () => ArcanistDiagnosticsProvider.lint(editor),
          {onlyForFile: path},
        );
      },
    };
  }
}

createPackage(module.exports, Activation);
