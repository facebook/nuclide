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

import type {PlatformGroup} from './types';

import {Disposable} from 'atom';
import {Observable, Subject} from 'rxjs';
import {getLogger} from 'log4js';

type PlatformProvider = (
  buckRoot: string,
  ruleType: string,
  buildTarget: string,
) => Observable<?PlatformGroup>;

export class PlatformService {
  _registeredProviders: Array<PlatformProvider> = [];
  _providersChanged: Subject<void> = new Subject();

  register(platformProvider: PlatformProvider): Disposable {
    this._registeredProviders.push(platformProvider);
    this._providersChanged.next();
    return new Disposable(() => {
      const index = this._registeredProviders.indexOf(platformProvider);
      this._registeredProviders.splice(index, 1);
      this._providersChanged.next();
    });
  }

  getPlatformGroups(
    buckRoot: string,
    ruleType: string,
    buildTarget: string,
  ): Observable<Array<PlatformGroup>> {
    return this._providersChanged.startWith(undefined).switchMap(() => {
      const observables = this._registeredProviders.map(provider =>
        provider(buckRoot, ruleType, buildTarget).catch(error => {
          getLogger('nuclide-buck').error(
            `Getting buck platform groups from ${provider.name} failed:`,
            error,
          );
          return Observable.of(null);
        }),
      );
      return (
        Observable.from(observables)
          // $FlowFixMe: type combineAll
          .combineAll()
          .map(platformGroups => {
            return platformGroups
              .filter(p => p != null)
              .sort((a, b) =>
                a.name.toUpperCase().localeCompare(b.name.toUpperCase()),
              );
          })
      );
    });
  }
}
