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

import type {LinterMessageV2} from 'atom-ide-ui';
import type {BuckTaskRunnerService} from '../../nuclide-buck/lib/types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';

import {getLogger} from 'log4js';
import {observeActiveEditorsDebounced} from 'nuclide-commons-atom/debounced';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {compact} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable, Subject} from 'rxjs';
import shallowEqual from 'shallowequal';
import {track} from 'nuclide-analytics';
import {getPythonServiceByNuclideUri} from '../../nuclide-remote-connection';
import {GRAMMAR_SET} from './constants';

const DEBOUNCE_INTERVAL = 1000;
// TODO(hansonw): increase when code action UI supports more
const NUM_SUGGESTIONS = 3;

export default class LinkTreeLinter {
  _buckTaskRunnerService: ?BuckTaskRunnerService;
  _cwdApi: ?CwdApi;

  // Once the user interacts with a diagnostic, hide it forever.
  _disposedPaths: Set<string> = new Set();

  consumeBuckTaskRunner(service: BuckTaskRunnerService): IDisposable {
    this._buckTaskRunnerService = service;
    return new UniversalDisposable(() => {
      this._buckTaskRunnerService = null;
    });
  }

  consumeCwdApi(api: CwdApi): IDisposable {
    this._cwdApi = api;
    return new UniversalDisposable(() => {
      this._cwdApi = null;
    });
  }

  observeMessages(): Observable<Array<LinterMessageV2>> {
    return observeActiveEditorsDebounced(DEBOUNCE_INTERVAL)
      .let(compact)
      .switchMap(editor => {
        const path = editor.getPath();
        if (
          path == null ||
          this._disposedPaths.has(path) ||
          !GRAMMAR_SET.has(editor.getGrammar().scopeName)
        ) {
          return Observable.of([]);
        }
        // If the CWD doesn't contain the file, Buck isn't going to work.
        const cwd = this._cwdApi == null ? null : this._cwdApi.getCwd();
        if (cwd != null && !nuclideUri.contains(cwd, path)) {
          return Observable.of([]);
        }
        const pythonService = getPythonServiceByNuclideUri(path);
        return Observable.fromPromise(pythonService.getBuildableTargets(path))
          .filter(targets => targets.length > 0)
          .switchMap(targets => {
            const buckService = this._buckTaskRunnerService;
            if (buckService == null || editor.getLineCount() === 0) {
              return Observable.of([]);
            }
            const position = [
              [0, 0],
              [0, editor.lineTextForBufferRow(0).length],
            ];
            const disposed = new Subject();
            // If the user happened to build a viable target - great!
            const taskCompleted = observableFromSubscribeFunction(cb =>
              buckService.onDidCompleteTask(task => {
                if (targets.includes(task.buildTarget)) {
                  cb();
                }
              }),
            );
            const solutions = targets.slice(0, NUM_SUGGESTIONS).map(target => ({
              title: target,
              position,
              apply: () => {
                track('python.link-tree-built', {target, path});
                buckService.setBuildTarget(target);
                atom.commands.dispatch(
                  atom.views.getView(atom.workspace),
                  'nuclide-task-runner:toggle-buck-toolbar',
                  {visible: true},
                );
                // TODO: Ideally this would actually trigger the build -
                // but there's no way to wait for 'build' to be enabled.
                this._disposedPaths.add(path);
                disposed.next();
              },
            }));
            solutions.push({
              title: 'No thanks',
              position,
              apply: () => {
                track('python.link-tree-ignored', {path});
                this._disposedPaths.add(path);
                disposed.next();
              },
            });
            return Observable.of([
              {
                kind: 'action',
                severity: 'info',
                location: {
                  file: path,
                  position,
                },
                excerpt:
                  'For better language services, build a binary or unittest\n' +
                  'that uses this file with Buck. Suggestions:',
                solutions,
              },
            ])
              .concat(Observable.never())
              .takeUntil(disposed)
              .takeUntil(taskCompleted);
          })
          .takeUntil(
            observableFromSubscribeFunction(cb => editor.onDidDestroy(cb)),
          )
          .concat(Observable.of([]));
      })
      .catch((err, continuation) => {
        getLogger('LinkTreeLinter').error(err);
        return continuation;
      })
      .distinctUntilChanged(shallowEqual);
  }
}
