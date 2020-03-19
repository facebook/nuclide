/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {
  FileGraph,
  FileMap,
  RelationList,
} from '../../nuclide-file-family/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import Projectionist from '../../nuclide-projectionist';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';

export default class ProjectionistFileFamilyProvider {
  _cwd: ?NuclideUri;
  _disposables: UniversalDisposable;
  _projectionist: ?Projectionist;

  constructor(cwdApis: Observable<?CwdApi>) {
    this._disposables = new UniversalDisposable(
      cwdApis
        .switchMap(
          cwdApi =>
            cwdApi == null
              ? Observable.of(null)
              : observableFromSubscribeFunction(cwdApi.observeCwd.bind(cwdApi)),
        )
        .switchMap(cwd => {
          if (cwd == null) {
            return Observable.of([null, null]);
          }

          return Promise.all([getFileSystemServiceByNuclideUri(cwd), cwd]);
        })
        .switchMap(([fsService, cwd]) => {
          if (fsService == null || cwd == null) {
            return Observable.of([null, null, null]);
          }

          return Promise.all([
            fsService.findNearestAncestorNamed('.projections.json', cwd),
            fsService,
            cwd,
          ]);
        })
        .switchMap(
          ([configPath, fsService, cwd]) =>
            configPath == null || fsService == null
              ? Observable.of([null, cwd])
              : Promise.all([fsService.readFile(configPath), cwd]),
        )
        .subscribe(([rulesStr, cwd]) => {
          if (rulesStr != null) {
            let rules;
            try {
              rules = JSON.parse(rulesStr.toString());
            } catch (e) {}
            if (rules != null) {
              this._projectionist = new Projectionist(rules);
            }
          }
          this._cwd = cwd;
        }),
    );
  }

  async getRelatedFiles(path: NuclideUri): Promise<FileGraph> {
    const projectionist = this._projectionist;
    const cwd = this._cwd;

    if (
      projectionist == null ||
      cwd == null ||
      !nuclideUri.contains(cwd, path)
    ) {
      return {
        files: new Map(),
        relations: [],
      };
    }

    const alternates = await Promise.all(
      projectionist
        .getAlternates(nuclideUri.relative(cwd, path))
        .map(async uri => {
          const fullUri = nuclideUri.join(cwd, uri);
          const fsService = getFileSystemServiceByNuclideUri(fullUri);
          return {
            uri,
            exists: await fsService.exists(fullUri),
          };
        }),
    );

    const files: FileMap = new Map([
      [path, {labels: new Set()}],
      ...alternates.map(({uri, exists}) => {
        const type = projectionist.getType(uri);
        return [
          nuclideUri.resolve(cwd, uri),
          {
            labels: type == null ? new Set() : new Set([type]),
            exists,
          },
        ];
      }),
    ]);

    const relations: RelationList = alternates.map(({uri}) => {
      const labels = new Set(['alternate']);
      const type = projectionist.getType(uri);
      if (type != null) {
        labels.add(type);
      }
      return {
        from: path,
        to: nuclideUri.resolve(cwd, uri),
        labels,
        directed: true,
      };
    });

    return {
      files,
      relations,
    };
  }
}
