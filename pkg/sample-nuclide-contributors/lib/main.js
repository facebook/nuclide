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

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import Module from 'module';
import path from 'path'; // eslint-disable-line nuclide-internal/prefer-nuclide-uri

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable(
      /**
       * Open any file in the "Run Package Specs" window.
       */
      atom.commands.add(
        'atom-workspace',
        'nuclide-contributors:run-current-spec',
        () => {
          const activePaneItem = atom.workspace.getActivePaneItem();
          if (activePaneItem == null) {
            atom.notifications.addError('No active editor!');
            return;
          }
          const activePath = activePaneItem.getPath();
          const ipcRenderer = require('electron').ipcRenderer; // Atom 1.7+
          invariant(ipcRenderer != null);
          ipcRenderer.send('run-package-specs', activePath);
        },
      ),
      /**
       * Force saving Atom state (for debugging).
       */
      atom.commands.add(
        'atom-workspace',
        'nuclide-contributors:save-atom-state',
        async () => {
          let state;
          try {
            // $FlowIgnore
            await atom.saveState();
            state = await atom.loadState();
          } catch (err) {
            console.log(err); // eslint-disable-line no-console
            atom.notifications.addError(`Failed to save state: ${err.message}`);
            return;
          }

          console.log(state); // eslint-disable-line no-console
          atom.notifications.addInfo('State saved!');
        },
      ),
      /**
       * Allows running `require('nuclide-commons/promise');`.
       * Useful for debugging from the devtools console.
       */
      atom.commands.add(
        'atom-workspace',
        'nuclide-contributors:add-nuclide-modules-to-global-paths',
        () => {
          const nuclidePack = atom.packages.getLoadedPackage('nuclide');
          if (!nuclidePack) {
            atom.notifications.addError('Nuclide is not loaded.');
            return;
          }
          [
            path.join(nuclidePack.path, 'node_modules'),
            path.join(nuclidePack.path, 'pkg'),
          ].filter(nuclidePath => {
            // $FlowIgnore
            const {globalPaths} = Module;
            if (globalPaths.indexOf(nuclidePath) === -1) {
              globalPaths.push(nuclidePath);
              // eslint-disable-next-line no-console
              console.log('Added "%s" to Module.globalPaths', nuclidePath);
            }
          });
        },
      ),
      () => {
        delete global.nuclide_contributors_tryReloadingPackage;
      },
    );

    global.nuclide_contributors_tryReloadingPackage = name => {
      const pack = atom.packages.getLoadedPackage(name);
      if (pack == null) {
        atom.notifications.addWarning(`${name} package is not loaded`);
        return;
      }

      atom.packages.deactivatePackage(name);
      atom.packages.unloadPackage(name);

      // remove cache
      Object.keys(require.cache)
        .filter(p => p.indexOf(pack.path + path.sep) === 0)
        .forEach(p => {
          delete require.cache[p];
        });

      // For Atom 1.17+
      if (global.snapshotResult && global.snapshotResult.customRequire) {
        Object.keys(global.snapshotResult.customRequire.cache)
          .filter(p => p.indexOf(pack.path + path.sep) !== -1)
          .forEach(p => {
            delete global.snapshotResult.customRequire.cache[p];
          });
      }

      const pkg = atom.packages.loadPackage(pack.path);
      invariant(pkg != null);
      pkg.activateResources();
      pkg.activateNow();
    };
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
