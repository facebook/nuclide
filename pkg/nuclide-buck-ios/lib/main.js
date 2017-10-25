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
import type {PlatformGroup} from '../../nuclide-buck/lib/types';
import type {PlatformService} from '../../nuclide-buck/lib/PlatformService';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {BuckEvent} from '../../nuclide-buck/lib/BuckEventStream';

import {SUPPORTED_RULE_TYPES} from './types';
import {getDevicePlatform, getSimulatorPlatform} from './Platforms';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Disposable} from 'atom';
import {Observable} from 'rxjs';
import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';

let disposable: ?Disposable = null;

export function deactivate(): void {
  if (disposable != null) {
    disposable.dispose();
    disposable = null;
  }
}

export function consumePlatformService(service: PlatformService): void {
  disposable = service.register(provideIosPlatformGroup);
}

function provideIosPlatformGroup(
  buckRoot: NuclideUri,
  ruleType: string,
  buildTarget: string,
): Observable<?PlatformGroup> {
  if (!SUPPORTED_RULE_TYPES.has(ruleType)) {
    return Observable.of(null);
  }
  if (ruleType === 'apple_binary' && buildTarget.endsWith('AppleMac')) {
    return Observable.of(null);
  }

  return Observable.fromPromise(
    fsPromise.exists(nuclideUri.join(buckRoot, 'mode', 'oculus-mobile')),
  ).switchMap(result => {
    if (result) {
      return Observable.of(null);
    } else {
      return Observable.fromPromise(
        _getDebuggerCallback(buckRoot),
      ).switchMap(debuggerCallback => {
        return Observable.combineLatest(
          getSimulatorPlatform(buckRoot, ruleType, debuggerCallback),
          getDevicePlatform(buckRoot, ruleType, debuggerCallback),
        ).map(([simulatorPlatform, devicePlatform]) => {
          return {
            name: 'iOS',
            platforms: [simulatorPlatform, devicePlatform],
          };
        });
      });
    }
  });
}

async function _getDebuggerCallback(
  buckRoot: NuclideUri,
): Promise<?(Observable<LegacyProcessMessage>) => Observable<BuckEvent>> {
  const nativeDebuggerService = await consumeFirstProvider(
    'nuclide-debugger.native-debugger-service',
  );

  if (nativeDebuggerService == null) {
    return null;
  }

  return (processStream: Observable<LegacyProcessMessage>) => {
    return nativeDebuggerService.debugTargetFromBuckOutput(
      buckRoot,
      processStream,
    );
  };
}
