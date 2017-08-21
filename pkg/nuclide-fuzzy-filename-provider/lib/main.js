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

import type {BusySignalService} from 'atom-ide-ui';
import type {FileResult, Provider} from '../../nuclide-quick-open/lib/types';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import scheduleIdleCallback from '../../commons-node/scheduleIdleCallback';
import {getFuzzyFileSearchServiceByNuclideUri} from '../../nuclide-remote-connection';
import {RpcTimeoutError} from '../../nuclide-rpc';
import {getLogger} from 'log4js';
import FuzzyFileNameProvider from './FuzzyFileNameProvider';
import {getIgnoredNames} from './utils';

const logger = getLogger('nuclide-fuzzy-filename-provider');

/**
 * A fallback provider for when the initial query hasn't come back yet.
 */
export type FuzzyFilenameFallbackProvider = {
  executeQuery(
    query: string,
    directory: atom$Directory,
  ): Promise<?Array<FileResult>>,
};

class Activation {
  _busySignalService: ?BusySignalService;
  _fallbackProvider: ?FuzzyFilenameFallbackProvider;
  _subscriptions: UniversalDisposable;
  _subscriptionsByRoot: Map<string, UniversalDisposable>;

  constructor() {
    (this: any)._readySearch = this._readySearch.bind(this);

    this._subscriptions = new UniversalDisposable();
    this._subscriptionsByRoot = new Map();

    // Do search preprocessing for all existing and future root directories.
    this._readySearch(atom.project.getPaths());
    this._subscriptions.add(atom.project.onDidChangePaths(this._readySearch));
  }

  _readySearch(projectPaths: Array<string>): void {
    // Add new project roots.
    for (const projectPath of projectPaths) {
      if (!this._subscriptionsByRoot.has(projectPath)) {
        const disposables = new UniversalDisposable(
          // Wait a bit before starting the initial search, since it's a heavy op.
          scheduleIdleCallback(
            () => {
              this._initialSearch(projectPath).catch(err => {
                // RPC timeout errors can often happen here, but don't dispose the search.
                if (err instanceof RpcTimeoutError) {
                  logger.warn(
                    `Warmup fuzzy filename search for ${projectPath} hit the RPC timeout.`,
                  );
                } else {
                  logger.error(
                    `Error starting fuzzy filename search for ${projectPath}: ${err}`,
                  );
                  this._disposeSearch(projectPath);
                }
              });
            },
            {timeout: 5000},
          ),
        );
        this._subscriptionsByRoot.set(projectPath, disposables);
      }
    }

    // Clean up removed project roots.
    for (const [projectPath] of this._subscriptionsByRoot) {
      if (!projectPaths.includes(projectPath)) {
        this._disposeSearch(projectPath);
      }
    }
  }

  async _initialSearch(projectPath: string): Promise<void> {
    const service = getFuzzyFileSearchServiceByNuclideUri(projectPath);
    const isAvailable = await service.isFuzzySearchAvailableFor(projectPath);
    if (!isAvailable) {
      throw new Error('Nonexistent directory');
    }

    const disposables = this._subscriptionsByRoot.get(projectPath);
    invariant(disposables != null);

    const busySignalDisposable =
      this._busySignalService == null
        ? new UniversalDisposable()
        : this._busySignalService.reportBusy(
            `File search: indexing ${projectPath}`,
          );
    disposables.add(busySignalDisposable);

    // It doesn't matter what the search term is. Empirically, doing an initial
    // search speeds up the next search much more than simply doing the setup
    // kicked off by 'fileSearchForDirectory'.
    try {
      await service.queryFuzzyFile(projectPath, 'a', getIgnoredNames());
    } catch (err) {
      throw err;
    } finally {
      disposables.dispose();
    }
  }

  _disposeSearch(projectPath: string): void {
    try {
      const service = getFuzzyFileSearchServiceByNuclideUri(projectPath);
      service.disposeFuzzySearch(projectPath);
    } catch (err) {
      logger.error(
        `Error disposing fuzzy filename service for ${projectPath}`,
        err,
      );
    } finally {
      const disposables = this._subscriptionsByRoot.get(projectPath);
      if (disposables != null) {
        disposables.dispose();
        this._subscriptionsByRoot.delete(projectPath);
      }
    }
  }

  registerProvider(): Provider {
    return {
      ...FuzzyFileNameProvider,
      executeQuery: async (query: string, directory: atom$Directory) => {
        const initialDisposable = this._subscriptionsByRoot.get(
          directory.getPath(),
        );
        // If the initial query is still executing, use the fallback provider.
        if (
          initialDisposable != null &&
          !initialDisposable.disposed &&
          this._fallbackProvider != null
        ) {
          const results = await this._fallbackProvider.executeQuery(
            query,
            directory,
          );
          if (results != null && results.length > 0) {
            return results;
          }
        }
        return FuzzyFileNameProvider.executeQuery(query, directory);
      },
    };
  }

  consumeBusySignal(service: BusySignalService): IDisposable {
    this._busySignalService = service;
    return new UniversalDisposable(() => {
      this._busySignalService = null;
    });
  }

  consumeFallbackProvider(
    provider: FuzzyFilenameFallbackProvider,
  ): IDisposable {
    this._fallbackProvider = provider;
    return new UniversalDisposable(() => {
      this._fallbackProvider = null;
    });
  }

  dispose(): void {
    this._subscriptions.dispose();
    this._subscriptionsByRoot.forEach(disposables => disposables.dispose());
    this._subscriptionsByRoot.clear();
  }
}

createPackage(module.exports, Activation);
