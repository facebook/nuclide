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

import type {IJavaAndroidAttachProcessConfig} from 'atom-ide-debugger-java-android/types';
import type {
  Device,
  DeviceProcessTaskProvider,
  Process,
  ProcessTaskType,
} from 'nuclide-debugger-common/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {VsAdapterTypes} from 'nuclide-debugger-common';
import {Observable} from 'rxjs';
import {getDebuggerService} from 'nuclide-commons-atom/debugger';

function _createAndroidDebugAttachConfig(
  targetUri: NuclideUri,
  device: Device,
  proc: Process,
): IJavaAndroidAttachProcessConfig {
  const config = {
    deviceAndProcess: {
      // See pkg/nuclide-device-panel-android/lib/Registration.js to see why
      // serial and identifier are interchangeable
      deviceSerial: device.identifier,
      selectedProcess: {
        user: proc.user,
        pid: String(proc.pid),
        name: proc.name,
      },
    },
    adbServiceUri: targetUri,
  };
  return {
    targetUri,
    debugMode: 'attach',
    adapterType: VsAdapterTypes.JAVA_ANDROID,
    config,
    processName:
      'Process ' + proc.pid + ' (Android Java ' + device.displayName + ')',
  };
}

export class JavaDebuggerDevicePanelProvider
  implements DeviceProcessTaskProvider {
  constructor() {}

  getType(): string {
    return 'Android';
  }

  getTaskType(): ProcessTaskType {
    return 'DEBUG';
  }

  getSupportedPIDs(
    host: NuclideUri,
    device: Device,
    procs: Process[],
  ): Observable<Set<number>> {
    return Observable.of(
      new Set(procs.filter(proc => proc.isJava).map(proc => proc.pid)),
    );
  }

  getName(): string {
    return 'Attach Java debugger';
  }

  async run(host: NuclideUri, device: Device, proc: Process): Promise<void> {
    const debuggerService = await getDebuggerService();
    const config = _createAndroidDebugAttachConfig(host, device, proc);
    debuggerService.startVspDebugging(config);
  }
}
