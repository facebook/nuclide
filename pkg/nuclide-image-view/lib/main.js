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

import type {RemoteFile} from '../../nuclide-remote-connection';
import type {RemoteFileOpenerService} from '../../nuclide-remote-projects';

import disablePackage, {
  DisabledReason,
} from '../../commons-atom/disablePackage';
import createPackage from 'nuclide-commons-atom/createPackage';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ImageEditor from './ImageEditor';

class Activation {
  _disposables: IDisposable;

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable(
      atom.workspace.addOpener(openUri),
      // If you enable this package, we need to disable image-view.
      disablePackage('image-view', {reason: DisabledReason.REIMPLEMENTED}),
    );
  }

  consumeRemoteFileOpenerService(service: RemoteFileOpenerService) {
    service.register((file: RemoteFile) => {
      return openUri(file.getPath());
    });
  }

  deserializeImageEditor(state): ImageEditor {
    return new ImageEditor(state.filePath);
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);

function openUri(uri: string): ?ImageEditor {
  return nuclideUri.looksLikeImageUri(uri) ? new ImageEditor(uri) : null;
}
