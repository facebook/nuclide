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
import type {
  FileOpenEvent,
  FileCloseEvent,
  FileEditEvent,
  FileSaveEvent,
  FileEvent,
  FileVersion,
  LocalFileEvent,
} from './rpc-types';

import TextBuffer from 'simple-text-buffer';
import invariant from 'assert';
import {BehaviorSubject, Subject, Observable} from 'rxjs';
import {FileVersionNotifier} from './FileVersionNotifier';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {FileEventKind} from './constants';

/**
 * NB: although it is possible to change the language ID after the file has
 * already been opened, the file cache will not update to reflect that.
 */
export class FileCache {
  _buffers: Map<
    NuclideUri,
    {buffer: simpleTextBuffer$TextBuffer, languageId: string},
  >;

  _requests: FileVersionNotifier;
  _fileEvents: Subject<LocalFileEvent>;
  // Care! update() is the only way you're allowed to update _buffers or _requests
  // or to fire a _fileEvents.next() event. That's to ensure that the three things
  // stay in sync.
  _directoryEvents: BehaviorSubject<Set<NuclideUri>>;
  _resources: UniversalDisposable;

  constructor() {
    this._buffers = new Map();
    this._fileEvents = new Subject();
    this._directoryEvents = new BehaviorSubject(new Set());
    this._requests = new FileVersionNotifier();

    this._resources = new UniversalDisposable();
    this._resources.add(this._requests);
  }

  update(updateBufferAndMakeEventFunc: () => LocalFileEvent) {
    const event = updateBufferAndMakeEventFunc();
    this._requests.onEvent(event);

    // invariant: because the above two lines have updated both _buffers and _requests,
    // then getBufferAtVersion will necessarily return immediately and successfully.
    // And getBufferForFileEvent will also succeed.
    invariant(event.kind !== 'edit' || this.getBufferForFileEvent(event));

    this._fileEvents.next(event);
  }

  // If any out of sync state is detected then an Error is thrown.
  // This will force the client to send a 'sync' event to get back on track.
  onFileEvent(event: FileEvent): Promise<void> {
    const filePath = event.fileVersion.filePath;
    const changeCount = event.fileVersion.version;
    const fileInfo = this._buffers.get(filePath);
    const buffer = fileInfo != null ? fileInfo.buffer : null;
    switch (event.kind) {
      case FileEventKind.OPEN:
        invariant(buffer == null);
        this._open(filePath, event.contents, changeCount, event.languageId);
        break;
      case FileEventKind.CLOSE:
        if (buffer != null) {
          this._close(filePath, buffer);
        }
        break;
      case FileEventKind.EDIT:
        invariant(buffer != null);
        invariant(buffer.changeCount === changeCount - 1);
        invariant(buffer.getTextInRange(event.oldRange) === event.oldText);
        this.update(() => {
          buffer.setTextInRange(event.oldRange, event.newText);
          invariant(buffer.changeCount === changeCount);
          return event;
        });
        break;
      case FileEventKind.SAVE:
        this._save(filePath, changeCount);
        break;
      case FileEventKind.SYNC:
        if (buffer == null) {
          this._open(filePath, event.contents, changeCount, event.languageId);
        } else {
          this._syncEdit(filePath, buffer, event.contents, changeCount);
        }
        break;
      default:
        (event.kind: empty);
        throw new Error(`Unexpected FileEvent.kind: ${event.kind}`);
    }
    return Promise.resolve(undefined);
  }

  async onDirectoriesChanged(openDirectories: Set<NuclideUri>): Promise<void> {
    this._directoryEvents.next(openDirectories);
  }

  _syncEdit(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    contents: string,
    changeCount: number,
  ): void {
    // messages are out of order
    if (changeCount < buffer.changeCount) {
      return;
    }

    const oldText = buffer.getText();
    const oldRange = buffer.getRange();
    this.update(() => {
      buffer.setText(contents);
      const newRange = buffer.getRange();
      buffer.changeCount = changeCount;
      return createEditEvent(
        this.createFileVersion(filePath, changeCount),
        oldRange,
        oldText,
        newRange,
        buffer.getText(),
      );
    });
  }

  _open(
    filePath: NuclideUri,
    contents: string,
    changeCount: number,
    languageId: string,
  ): void {
    // We never call setPath on these TextBuffers as that will
    // start the TextBuffer attempting to sync with the file system.
    const newBuffer = new TextBuffer(contents);
    newBuffer.changeCount = changeCount;
    this.update(() => {
      this._buffers.set(filePath, {buffer: newBuffer, languageId});
      return createOpenEvent(
        this.createFileVersion(filePath, changeCount),
        contents,
        languageId,
      );
    });
  }

  _close(filePath: NuclideUri, buffer: simpleTextBuffer$TextBuffer): void {
    this.update(() => {
      this._buffers.delete(filePath);
      return createCloseEvent(
        this.createFileVersion(filePath, buffer.changeCount),
      );
    });
    buffer.destroy();
  }

  _save(filePath: NuclideUri, changeCount: number): void {
    this.update(() => {
      return createSaveEvent(this.createFileVersion(filePath, changeCount));
    });
  }

  dispose(): void {
    // The _close routine will delete elements from the _buffers map.
    // Per ES6 this is safe to do even while iterating.
    for (const [filePath, {buffer}] of this._buffers.entries()) {
      this._close(filePath, buffer);
    }
    invariant(this._buffers.size === 0);
    this._resources.dispose();
    this._fileEvents.complete();
    this._directoryEvents.complete();
  }

  // getBuffer: returns whatever is the current version of the buffer.
  getBuffer(filePath: NuclideUri): ?simpleTextBuffer$TextBuffer {
    // TODO: change this to return a string, to ensure that no caller will ever mutate
    // the buffer contents (and hence its changeCount). The only modifications allowed
    // are those that come from the editor inside this.onFileEvent.
    const fileInfo = this._buffers.get(filePath);
    return fileInfo != null ? fileInfo.buffer : null;
  }

  // getBufferAtVersion(version): if the stream of onFileEvent gets up to this particular
  // version, either now or in the future, then will return the buffer for that version.
  // But if for whatever reason the stream of onFileEvent won't hit that precise version
  // then returns null. See comments in _requests.waitForBufferAtVersion for
  // the subtle scenarios where it might return null.
  async getBufferAtVersion(
    fileVersion: FileVersion,
  ): Promise<?simpleTextBuffer$TextBuffer> {
    // TODO: change this to return a string, like getBuffer() above.
    if (!(await this._requests.waitForBufferAtVersion(fileVersion))) {
      return null;
    }
    const buffer = this.getBuffer(fileVersion.filePath);
    return buffer != null && buffer.changeCount === fileVersion.version
      ? buffer
      : null;
  }

  // getBufferForFileEvent - this function may be called immediately when an edit or save
  // event happens, before any awaits. At that time the buffer is guaranteed to be
  // available. If called at any other time, the buffer may no longer be available,
  // in which case it may throw.
  getBufferForFileEvent(fileEvent: FileEvent): simpleTextBuffer$TextBuffer {
    // TODO: change this to return a string, like getBuffer() above.
    const fileVersion = fileEvent.fileVersion;
    invariant(this._requests.isBufferAtVersion(fileVersion));
    const buffer = this.getBuffer(fileVersion.filePath);
    invariant(buffer != null && buffer.changeCount === fileVersion.version);
    return buffer;
  }

  getOpenDirectories(): Set<NuclideUri> {
    return this._directoryEvents.getValue();
  }

  // Returns directory which contains this path if any.
  // Remote equivalent of atom.project.relativizePath()[1]
  // TODO: Return the most nested open directory.
  //       Note that Atom doesn't do this, though it should.
  getContainingDirectory(filePath: NuclideUri): ?NuclideUri {
    for (const dir of this.getOpenDirectories()) {
      if (nuclideUri.contains(dir, filePath)) {
        return dir;
      }
    }
    return null;
  }

  getOpenFiles(): Iterator<NuclideUri> {
    return this._buffers.keys();
  }

  observeFileEvents(): Observable<LocalFileEvent> {
    return Observable.from(
      Array.from(this._buffers.entries()).map(
        ([filePath, {buffer, languageId}]) => {
          invariant(buffer != null);
          invariant(languageId != null);
          return createOpenEvent(
            this.createFileVersion(filePath, buffer.changeCount),
            buffer.getText(),
            languageId,
          );
        },
      ),
    ).concat(this._fileEvents);
  }

  observeDirectoryEvents(): Observable<Set<NuclideUri>> {
    return this._directoryEvents;
  }

  createFileVersion(filePath: NuclideUri, version: number): FileVersion {
    return {
      notifier: this,
      filePath,
      version,
    };
  }
}

function createOpenEvent(
  fileVersion: FileVersion,
  contents: string,
  languageId: string,
): FileOpenEvent {
  return {
    kind: FileEventKind.OPEN,
    fileVersion,
    contents,
    languageId,
  };
}

function createCloseEvent(fileVersion: FileVersion): FileCloseEvent {
  return {
    kind: FileEventKind.CLOSE,
    fileVersion,
  };
}

function createSaveEvent(fileVersion: FileVersion): FileSaveEvent {
  return {
    kind: FileEventKind.SAVE,
    fileVersion,
  };
}

function createEditEvent(
  fileVersion: FileVersion,
  oldRange: atom$Range,
  oldText: string,
  newRange: atom$Range,
  newText: string,
): FileEditEvent {
  return {
    kind: FileEventKind.EDIT,
    fileVersion,
    oldRange,
    oldText,
    newRange,
    newText,
  };
}
