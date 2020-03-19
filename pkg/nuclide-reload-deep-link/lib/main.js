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

import type {
  DeepLinkService,
  DeepLinkParams,
} from '../../nuclide-deep-link/lib/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export class Activation {
  _disposables: UniversalDisposable = new UniversalDisposable();

  consumeDeepLinkService(service: DeepLinkService): IDisposable {
    const disposable = service.subscribeToPath(
      'reload',
      (params: DeepLinkParams): void => {
        const reload = () =>
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'window:reload',
          );
        if (atom.project.getPaths().length === 0) {
          reload();
        } else {
          const appName =
            typeof params.app === 'string' ? params.app : 'Another application';
          atom.notifications.addInfo(`${appName} asked Atom to reload.`, {
            detail:
              typeof params.reason === 'string' ? params.reason : undefined,
            dismissable: true,
            buttons: [
              {
                text: 'Reload',
                className: 'icon icon-zap',
                onDidClick: reload,
              },
            ],
          });
        }
      },
    );
    this._disposables.add(disposable);
    return disposable;
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
