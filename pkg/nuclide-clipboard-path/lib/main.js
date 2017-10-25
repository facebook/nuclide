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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getAtomProjectRelativePath} from 'nuclide-commons-atom/projects';
import {trackTiming} from '../../nuclide-analytics';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

function copyAbsolutePath(): void {
  trackOperation('copyAbsolutePath', () => {
    const uri = getCurrentNuclideUri();
    // flowlint-next-line sketchy-null-string:off
    if (!uri) {
      return;
    }
    copyToClipboard('Copied absolute path', nuclideUri.getPath(uri));
  });
}

function copyProjectRelativePath(): void {
  trackOperation('copyProjectRelativePath', () => {
    const uri = getCurrentNuclideUri();
    // flowlint-next-line sketchy-null-string:off
    if (!uri) {
      return;
    }

    const projectRelativePath = getAtomProjectRelativePath(uri);
    // flowlint-next-line sketchy-null-string:off
    if (projectRelativePath) {
      copyToClipboard('Copied project relative path', projectRelativePath);
    } else {
      copyToClipboard(
        'Path not contained in any open project.\nCopied absolute path',
        nuclideUri.getPath(uri),
      );
    }
  });
}

function copyRepositoryRelativePath(): void {
  trackOperation('copyRepositoryRelativePath', async () => {
    const uri = getCurrentNuclideUri();
    // flowlint-next-line sketchy-null-string:off
    if (!uri) {
      return;
    }

    // First source control relative.
    const repoRelativePath = getRepositoryRelativePath(uri);
    // flowlint-next-line sketchy-null-string:off
    if (repoRelativePath) {
      copyToClipboard('Copied repository relative path', repoRelativePath);
      return;
    }

    // Next try arcanist relative.
    const arcRelativePath = await getArcanistRelativePath(uri);
    // flowlint-next-line sketchy-null-string:off
    if (arcRelativePath) {
      copyToClipboard('Copied arc project relative path', arcRelativePath);
      return;
    }

    // Lastly, project and absolute.
    const projectRelativePath = getAtomProjectRelativePath(uri);
    // flowlint-next-line sketchy-null-string:off
    if (projectRelativePath) {
      copyToClipboard('Copied project relative path', projectRelativePath);
    } else {
      copyToClipboard(
        'Path not contained in any repository.\nCopied absolute path',
        nuclideUri.getPath(uri),
      );
    }
  });
}

function getRepositoryRelativePath(path: NuclideUri): ?string {
  // TODO(peterhal): repositoryForPath is the same as projectRelativePath
  // only less robust. We'll need a version of findHgRepository which is
  // aware of remote paths.
  return null;
}

async function getArcanistRelativePath(path: NuclideUri): Promise<?string> {
  try {
    const {
      getArcanistServiceByNuclideUri,
      // $FlowFB
    } = require('../../commons-atom/fb-remote-connection');
    const arcService = getArcanistServiceByNuclideUri(path);
    return await arcService.getProjectRelativePath(path);
  } catch (err) {
    return null;
  }
}

function copyToClipboard(messagePrefix: string, value: string): void {
  atom.clipboard.write(value);
  notify(`${messagePrefix}: \`\`\`${value}\`\`\``);
}

function getCurrentNuclideUri(): ?NuclideUri {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) {
    notify('Nothing copied. No active text editor.');
    return null;
  }

  const path = editor.getPath();
  // flowlint-next-line sketchy-null-string:off
  if (!path) {
    notify('Nothing copied. Current text editor is unnamed.');
    return null;
  }

  return path;
}

function trackOperation(eventName: string, operation: () => mixed): void {
  trackTiming('nuclide-clipboard-path:' + eventName, operation);
}

function notify(message: string): void {
  atom.notifications.addInfo(message);
}

class Activation {
  _subscriptions: UniversalDisposable;

  constructor(state: ?Object) {
    this._subscriptions = new UniversalDisposable();
    this._subscriptions.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-clipboard-path:copy-absolute-path',
        copyAbsolutePath,
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-clipboard-path:copy-repository-relative-path',
        copyRepositoryRelativePath,
      ),
    );
    this._subscriptions.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-clipboard-path:copy-project-relative-path',
        copyProjectRelativePath,
      ),
    );
  }

  dispose() {
    this._subscriptions.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?mixed): void {
  if (!activation) {
    activation = new Activation();
  }
}

export function deactivate(): void {
  if (activation) {
    activation.dispose();
    activation = null;
  }
}
