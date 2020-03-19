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

import ImageEditorView from './ImageEditorView';
import LocalFileCopy from './LocalFileCopy';
import {File} from 'atom';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ReplaySubject, Subject} from 'rxjs';

export default class ImageEditor {
  _disposed: ReplaySubject<void> = new ReplaySubject(1);
  _didTerminatePendingState: Subject<void> = new Subject();
  file: File | LocalFileCopy;
  _view: ?ImageEditorView;

  constructor(filePath: string) {
    this.file = nuclideUri.isRemote(filePath)
      ? new LocalFileCopy(filePath)
      : new File(filePath);
    observableFromSubscribeFunction(cb => this.file.onDidDelete(cb))
      .takeUntil(this._disposed)
      .subscribe(() => {
        const pane = atom.workspace.paneForURI(filePath);
        try {
          pane.destroyItem(pane.itemForURI(filePath));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            `Could not destroy pane after external file was deleted: ${e}`,
          );
        }
        this.destroy();
      });
  }

  isModified() {
    return false;
  }

  copy() {
    return new ImageEditor(this.getPath());
  }

  getElement() {
    if (this._view == null) {
      this._view = new ImageEditorView(this);
    }
    return this._view.getElement();
  }

  serialize() {
    // We use the same name as Atom's deserializer since we're replacing it.
    return {filePath: this.getPath(), deserializer: 'ImageEditor'};
  }

  terminatePendingState() {
    if (
      this.isEqual(
        atom.workspace
          .getCenter()
          .getActivePane()
          .getPendingItem(),
      )
    ) {
      this._didTerminatePendingState.next();
    }
  }

  whenReady(callback: () => mixed): IDisposable {
    if (this.file instanceof LocalFileCopy) {
      return this.file.whenReady(callback);
    }
    callback();
    return new UniversalDisposable();
  }

  onDidTerminatePendingState(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._didTerminatePendingState.takeUntil(this._disposed).subscribe(() => {
        callback();
      }),
    );
  }

  // Register a callback for when the image file changes
  onDidChange(callback: () => void): IDisposable {
    return new UniversalDisposable(
      observableFromSubscribeFunction(cb => this.file.onDidChange(cb))
        .takeUntil(this._disposed)
        .subscribe(() => {
          callback();
        }),
    );
  }

  // Register a callback for whne the image's title changes
  onDidChangeTitle(callback: (title: string) => mixed): IDisposable {
    return new UniversalDisposable(
      observableFromSubscribeFunction(cb => this.file.onDidRename(cb))
        .takeUntil(this._disposed)
        .map(() => this.getTitle())
        .subscribe(title => {
          callback(title);
        }),
    );
  }

  destroy(): void {
    this._disposed.next();
    if (this._view != null) {
      this._view.destroy();
    }
  }

  getAllowedLocations(): Array<string> {
    return ['center'];
  }

  // Retrieves the filename of the open file.
  //
  // This is `'untitled'` if the file is new and not saved to the disk.
  getTitle(): string {
    const filePath = this.getPath();
    if (filePath) {
      return nuclideUri.basename(filePath);
    } else {
      return 'untitled';
    }
  }

  // Retrieves the absolute path to the image.
  getPath(): string {
    return this.file.getPath();
  }

  getLocalPath(): ?string {
    return typeof this.file.getLocalPath === 'function'
      ? this.file.getLocalPath()
      : this.file.getPath();
  }

  // Retrieves the URI of the image.
  getURI(): NuclideUri {
    return this.getPath();
  }

  // Retrieves the encoded URI of the image.
  getEncodedURI(): ?string {
    // IMPORTANT: This shouldn't be called before `whenReady()`! If it is, you could get `null`.
    const path = this.getLocalPath();
    return path == null
      ? null
      : `file://${encodeURI(path.replace(/\\/g, '/'))
          .replace(/#/g, '%23')
          .replace(/\?/g, '%3F')}`;
  }

  // Compares two {ImageEditor}s to determine equality.
  //
  // Equality is based on the condition that the two URIs are the same.
  isEqual(other: any): boolean {
    return other instanceof ImageEditor && this.getURI() === other.getURI();
  }

  // Essential: Invoke the given callback when the editor is destroyed.
  onDidDestroy(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._disposed.subscribe(() => {
        callback();
      }),
    );
  }
}
