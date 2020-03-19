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

import type {LinterMessage, LinterProvider} from 'atom-ide-ui';

import {Range} from 'atom';
import {getLogger} from 'log4js';
import {Observable, Subject} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand, runCommandDetailed} from 'nuclide-commons/process';
import featureConfig from 'nuclide-commons-atom/feature-config';

const requests: Subject<void> = new Subject();

// Check for a new version every 10 minutes.
const DOWNLOAD_INTERVAL = 10 * 60 * 1000;
// Display a "fetching" notification if it hasn't completed within 5s.
const DOWNLOAD_NOTIFICATION_DELAY = 5 * 1000;

let cachedVersionCheck: ?Observable<boolean> = null;
let versionCheckTime = 0;

function getInferCommand(): string {
  return String(featureConfig.get('nuclide-infer-al.pathToInfer'));
}

function checkVersion(cwd: string): Observable<boolean> {
  if (
    cachedVersionCheck == null ||
    Date.now() - versionCheckTime > DOWNLOAD_INTERVAL
  ) {
    versionCheckTime = Date.now();
    cachedVersionCheck = runCommand(getInferCommand(), ['--version'], {
      cwd,
    })
      // Return true as long as there's no error.
      .mapTo(true)
      .catch(err => {
        getLogger('nuclide-infer-al').error(
          'Error running infer --version:',
          err,
        );
        atom.notifications.addError('Error running Infer', {
          description: String(err),
          dismissable: true,
        });
        return Observable.of(false);
      })
      .race(
        // By using 'race', this won't show up if the version comes back first.
        Observable.timer(DOWNLOAD_NOTIFICATION_DELAY)
          .do(() => {
            atom.notifications.addInfo('Fetching Infer...', {
              description:
                'Fetching the latest version of Infer. This may take quite some time initially...',
              dismissable: true,
            });
          })
          .concat(Observable.never())
          .ignoreElements(),
      )
      // Share this and make it replayable.
      .publishReplay(1)
      .refCount();
    return cachedVersionCheck;
  }
  return cachedVersionCheck;
}

export function provideLint(): LinterProvider {
  return {
    name: 'nuclide-infer-al',
    grammarScopes: ['source.infer.al'],
    scope: 'file',
    lintOnFly: false,
    lint(editor: atom$TextEditor): Promise<?Array<LinterMessage>> {
      const src = editor.getPath();
      if (src == null || nuclideUri.isRemote(src)) {
        return Promise.resolve([]);
      }
      const cwd = nuclideUri.dirname(src);

      requests.next();
      return checkVersion(cwd)
        .take(1)
        .switchMap(success => {
          if (!success) {
            return Observable.of(null);
          }
          return (
            runCommandDetailed(
              getInferCommand(),
              [
                '--linters-def-file',
                src,
                '--no-default-linters',
                '--linters-validate-syntax-only',
              ],
              {isExitError: () => false, cwd},
            )
              .map(result => {
                if (result.exitCode === 0) {
                  return [];
                } else {
                  const json = JSON.parse(result.stdout);
                  return json.map(e => ({
                    name: 'Error',
                    type: 'Error',
                    html: '<pre>' + e.description + '</pre>',
                    filePath: e.filename,
                    range: new Range([e.line - 1, 0], [e.line, 0]),
                  }));
                }
              })
              .catch(err => {
                getLogger('nuclide-infer-al').error(
                  'Error running Infer command: ',
                  err,
                );
                atom.notifications.addError('Error running Infer', {
                  description: String(err),
                  dismissable: true,
                });
                return Observable.of(null);
              })
              // Stop if we get a new request in the meantime.
              .takeUntil(requests)
          );
        })
        .toPromise();
    },
  };
}
