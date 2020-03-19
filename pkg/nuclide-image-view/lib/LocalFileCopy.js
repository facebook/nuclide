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

import {File} from 'atom';
import crypto from 'crypto';
import {getLogger} from 'log4js';
import {getFileForPath} from 'nuclide-commons-atom/projects';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {writeToStream} from 'nuclide-commons/stream';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullthrows from 'nullthrows';
import os from 'os';
import {BehaviorSubject, Observable, ReplaySubject} from 'rxjs';
import temp from 'temp';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';

/**
 * A file-like object that represents a local copy of a remote file.
 */
export default class LocalFileCopy {
  _initialFilePath: NuclideUri;
  _remoteFile: BehaviorSubject<?File> = new BehaviorSubject();
  _tmpFile: BehaviorSubject<?File> = new BehaviorSubject();
  _disposed: ReplaySubject<mixed> = new ReplaySubject(1);

  constructor(filePath: NuclideUri) {
    this._initialFilePath = filePath;
    getRemoteFile(filePath)
      .takeUntil(this._disposed)
      .subscribe(remoteFile => {
        this._remoteFile.next(remoteFile);
      });
    ((this._remoteFile.filter(Boolean): any): Observable<File>)
      .switchMap(file =>
        observableFromSubscribeFunction(cb => file.onDidChange(cb))
          .startWith(null)
          .switchMap(path => copyToLocalTempFile(file.getPath()))
          .catch(err => {
            // TODO: Improve error handling by updating view instead of resorting to notifications.
            atom.notifications.addError(
              'There was an error loading the image. Please close the tab and try again.',
              {dismissable: true},
            );
            getLogger('nuclide-image-view').error(err);
            return Observable.empty();
          }),
      )
      .takeUntil(this._disposed)
      .subscribe(tmpFile => {
        this._tmpFile.next(tmpFile);
      });
  }

  dispose(): void {
    this._disposed.next();
  }

  whenReady(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._tmpFile
        .filter(Boolean)
        .take(1)
        .takeUntil(this._disposed)
        .subscribe(() => {
          callback();
        }),
    );
  }

  getPath() {
    const remoteFile = this._remoteFile.getValue();
    return remoteFile == null ? this._initialFilePath : remoteFile.getPath();
  }

  getLocalPath() {
    const tmpFile = this._tmpFile.getValue();
    return tmpFile == null ? null : tmpFile.getPath();
  }

  onDidChange(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._tmpFile.takeUntil(this._disposed).subscribe(() => {
        callback();
      }),
    );
  }

  onDidRename(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._remoteFile
        .filter(Boolean)
        .switchMap(remoteFile =>
          observableFromSubscribeFunction(cb =>
            nullthrows(remoteFile).onDidRename(cb),
          ),
        )
        .takeUntil(this._disposed)
        .subscribe(() => {
          callback();
        }),
    );
  }

  onDidDelete(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._remoteFile
        .filter(Boolean)
        .switchMap(remoteFile =>
          observableFromSubscribeFunction(cb =>
            nullthrows(remoteFile).onDidDelete(cb),
          ),
        )
        .takeUntil(this._disposed)
        .subscribe(() => {
          callback();
        }),
    );
  }
}

function copyToLocalTempFile(remotePath: string): Observable<File> {
  return Observable.defer(async () => {
    const fsService = getFileSystemServiceByNuclideUri(remotePath);
    const {mtime} = await fsService.stat(remotePath);
    return {fsService, mtime};
  }).switchMap(({fsService, mtime}) => {
    const cacheDir = nuclideUri.join(os.tmpdir(), 'nuclide-remote-images');
    // Create a unique filename based on the path and mtime. We use a hash so we don't run into
    // filename length restrictions.
    const hash = crypto
      .createHash('md5')
      .update(remotePath)
      .digest('hex')
      .slice(0, 7);
    const extname = nuclideUri.extname(remotePath);
    const basename = nuclideUri.basename(remotePath);
    const name = basename.slice(0, basename.length - extname.length);
    const tmpFilePath = nuclideUri.join(
      cacheDir,
      `${name}-${hash}-${mtime.getTime()}${extname}`,
    );
    return Observable.fromPromise(fsPromise.exists(tmpFilePath)).switchMap(
      exists => {
        if (exists) {
          return Observable.of(new File(tmpFilePath));
        }
        return fsService
          .createReadStream(remotePath)
          .refCount()
          .let(writeToTempFile(tmpFilePath));
      },
    );
  });
}

const writeToTempFile = (targetPath: string) => (
  source: Observable<Buffer>,
): Observable<File> => {
  return Observable.defer(() => {
    const writeStream = temp.createWriteStream();
    return writeToStream(source, writeStream)
      .ignoreElements()
      .concat(
        Observable.defer(async () => {
          // Move the file to the final destination.
          await fsPromise.mkdirp(nuclideUri.dirname(targetPath));
          await fsPromise.mv(writeStream.path, targetPath);
          return new File(targetPath);
        }),
      );
  });
};

// We have to wait for so much.
function getRemoteFile(path: string): Observable<?File> {
  return observableFromSubscribeFunction(cb =>
    atom.packages.serviceHub.consume('nuclide-remote-projects', '0.0.0', cb),
  )
    .switchMap(service => {
      if (service == null) {
        return Observable.of(null);
      }
      return observableFromSubscribeFunction(cb =>
        service.waitForRemoteProjectReload(cb),
      ).map(() => getFileForPath(path));
    })
    .take(1);
}
