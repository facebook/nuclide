'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
var {CompositeDisposable} = require('atom');

var loadController: () => Promise<FileTreeController>;
var fileTreeController: ?FileTreeController = null;
var subscriptions: ?CompositeDisposable = null;


module.exports = {
  activate(state: ?FileTreeControllerState): void {

    // disable atom's default tree view
    if (atom.config.get('core.disabledPackages').length === 0) {
      atom.config.pushAtKeyPath('core.disabledPackages', 'tree-view');
    } else if (atom.config.get('core.disabledPackages').indexOf('tree-view') === -1) {
      atom.config.pushAtKeyPath('core.disabledPackages', 'tree-view');
    }

    // Show the file tree by default.
    state = state || {};
    state.panel = state.panel || {isVisible: true};

    /**
     * Lazily load the FileTreeController, to minimize startup time.
     */
    loadController = async () => {
      if (!fileTreeController) {
        var FileTreeController = require('./FileTreeController');
        fileTreeController = new FileTreeController(state);
      }
      return fileTreeController;
    };

    subscriptions = new CompositeDisposable();
    subscriptions.add(atom.commands.add(
        'atom-workspace',
        {
          'nuclide-file-tree:toggle': async () => (await loadController()).toggle(),
          'nuclide-file-tree:show': async () => (await loadController()).setVisible(true),
          'nuclide-file-tree:reveal-active-file': async () => (await loadController()).revealActiveFile(),
        }));

    if (state.panel.isVisible) {
      loadController();
    }
  },

  getController(): () => Promise<FileTreeController> {
    return loadController;
  },

  deactivate(): void {
    if (subscriptions) {
      subscriptions.dispose();
      subscriptions = null;
    }
    if (fileTreeController) {
      fileTreeController.destroy();
      fileTreeController = null;
    }
  },

  serialize(): ?FileTreeControllerState {
    if (fileTreeController) {
      return fileTreeController.serialize();
    }
  }
};
