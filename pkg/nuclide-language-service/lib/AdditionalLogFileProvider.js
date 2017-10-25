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

import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {LanguageService} from './LanguageService';

import {arrayFlatten} from 'nuclide-commons/collection';
import {timeoutAfterDeadline} from 'nuclide-commons/promise';
import {stringifyError} from 'nuclide-commons/string';
import {ConnectionCache} from '../../nuclide-remote-connection';

export class LanguageAdditionalLogFilesProvider<T: LanguageService> {
  id: string = 'als';
  _name: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(name: string, connectionToLanguageService: ConnectionCache<T>) {
    this._name = name;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'additional-log-files',
      '0.0.0',
      new LanguageAdditionalLogFilesProvider(name, connectionToLanguageService),
    );
  }

  async getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>> {
    const resultsForConnection = async (prefix, connection) => {
      const service = await this._connectionToLanguageService.get(connection);
      const subResults = await service.getAdditionalLogFiles(deadline - 1000);
      return subResults.map(log => ({...log, title: prefix + log.title}));
    };

    const connections = Array.from(this._connectionToLanguageService.keys());
    const results = await Promise.all(
      connections.map(connection => {
        const prefix =
          `[${this._name}]` +
          (connection == null ? '' : connection.getRemoteHostname() + ':');
        return timeoutAfterDeadline(
          deadline,
          resultsForConnection(prefix, connection),
        ).catch(e => [
          {
            title: `${prefix}language_service`,
            data: stringifyError(e),
          },
        ]);
      }),
    );
    return arrayFlatten(results);
  }
}
