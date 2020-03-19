/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {AndroidJavaProcess, SimpleProcess, AdbDevice} from './types';
import type {
  LegacyProcessMessage,
  ProcessMessage,
} from 'nuclide-commons/process';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import {parsePsTableOutput} from './common/ps';
import {runCommand, observeProcess} from 'nuclide-commons/process';

const ADB_TIMEOUT = 5000;

export class Adb {
  _serial: string;

  constructor(serial: string) {
    this._serial = serial;
  }

  getAndroidProp(key: string): Observable<string> {
    return this.runShortCommand('shell', 'getprop', key).map(s => s.trim());
  }

  getDeviceArchitecture(): Observable<string> {
    return this.getAndroidProp('ro.product.cpu.abi');
  }

  async getInstalledPackages(): Promise<Array<string>> {
    const prefix = 'package:';
    const stdout = await this.runShortCommand(
      'shell',
      'pm',
      'list',
      'packages',
    ).toPromise();
    return stdout
      .trim()
      .split(/\s+/)
      .map(s => s.substring(prefix.length));
  }

  async isPackageInstalled(pkg: string): Promise<boolean> {
    const packages = await this.getInstalledPackages();
    return packages.includes(pkg);
  }

  getDeviceModel(): Observable<string> {
    return this.getAndroidProp('ro.product.model').map(
      s => (s === 'sdk' ? 'emulator' : s),
    );
  }

  getAPIVersion(): Observable<string> {
    return this.getAndroidProp('ro.build.version.sdk');
  }

  getBrand(): Observable<string> {
    return this.getAndroidProp('ro.product.brand');
  }

  getManufacturer(): Observable<string> {
    return this.getAndroidProp('ro.product.manufacturer');
  }

  getDeviceInfo(): Observable<Map<string, string>> {
    const unknownCB = () => Observable.of('');
    return Observable.forkJoin(
      this.getDeviceArchitecture().catch(unknownCB),
      this.getAPIVersion().catch(unknownCB),
      this.getDeviceModel().catch(unknownCB),
      this.getOSVersion().catch(unknownCB),
      this.getManufacturer().catch(unknownCB),
      this.getBrand().catch(unknownCB),
      this.getWifiIp().catch(unknownCB),
    ).map(
      ([
        architecture,
        apiVersion,
        model,
        android_version,
        manufacturer,
        brand,
        wifi_ip,
      ]) => {
        return new Map([
          ['name', this._serial],
          ['adb_port', '5037'],
          ['architecture', architecture],
          ['api_version', apiVersion],
          ['model', model],
          ['android_version', android_version],
          ['manufacturer', manufacturer],
          ['brand', brand],
          ['wifi_ip', wifi_ip],
        ]);
      },
    );
  }

  getWifiIp(): Observable<string> {
    return this.runShortCommand('shell', 'ip', 'addr', 'show', 'wlan0').map(
      lines => {
        const line = lines.split(/\n/).filter(l => l.includes('inet'))[0];
        if (line == null) {
          return '';
        }
        const rawIp = line.trim().split(/\s+/)[1];
        return rawIp.substring(0, rawIp.indexOf('/'));
      },
    );
  }

  // In some android devices, we have to kill the package, not the process.
  // http://stackoverflow.com/questions/17154961/adb-shell-operation-not-permitted
  async stopProcess(packageName: string, pid: number): Promise<void> {
    await Promise.all([
      this.runShortCommand(
        'shell',
        'am',
        'force-stop',
        packageName,
      ).toPromise(),
      this.runShortCommand('shell', 'kill', '-9', `${pid}`).toPromise(),
      this.runShortCommand(
        'shell',
        'run-as',
        packageName,
        'kill',
        '-9',
        `${pid}`,
      ).toPromise(),
    ]);
  }

  getOSVersion(): Observable<string> {
    return this.getAndroidProp('ro.build.version.release');
  }

  installPackage(packagePath: NuclideUri): Observable<ProcessMessage> {
    invariant(!nuclideUri.isRemote(packagePath));
    return (
      this.getAPIVersion()
        .map(version => parseInt(version, 10) >= 17)
        .catch(() => Observable.of(false))
        .switchMap(canUseDowngradeOption =>
          this.runLongCommandNew(
            ...[
              'install',
              '-r',
              // The -d option allows downgrades, which happen frequently during development.
              ...(canUseDowngradeOption ? ['-d'] : []),
              packagePath,
            ],
          ),
        )
        // adb install sends a lot of identical progress events to stdout, deduplicate them
        .distinctUntilChanged((a, b) => {
          if (a.kind === 'stdout' && b.kind === 'stdout') {
            return a.data === b.data;
          } else {
            return false;
          }
        })
    );
  }

  uninstallPackage(packageName: string): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this.runLongCommand('uninstall', packageName);
  }

  async getForwardSpec(pid: number): Promise<?string> {
    const specLines = await this.runShortCommand(
      'forward',
      '--list',
    ).toPromise();
    const specs = specLines.split(/\n/).map(line => {
      const cols = line.split(/\s+/);
      return {
        spec: cols[1],
        target: cols[2],
      };
    });
    const matchingSpec = specs.find(spec => spec.target === `jdwp:${pid}`);
    if (matchingSpec != null) {
      return matchingSpec.spec;
    }
    return null;
  }

  async forwardJdwpPortToPid(tcpPort: number, pid: number): Promise<?string> {
    await this.runShortCommand(
      'forward',
      `tcp:${tcpPort}`,
      `jdwp:${pid}`,
    ).toPromise();
    return this.getForwardSpec(pid);
  }

  async removeJdwpForwardSpec(spec: ?string): Promise<string> {
    let output;
    let result = '';
    if (spec != null) {
      output = this.runLongCommand('forward', '--remove', spec);
    } else {
      output = this.runLongCommand('forward', '--remove-all');
    }

    const subscription = output.subscribe(processMessage => {
      switch (processMessage.kind) {
        case 'stdout':
        case 'stderr':
          result += processMessage.data + '\n';
          break;
      }
    });
    await output.toPromise();
    subscription.unsubscribe();
    return result;
  }

  async launchActivity(
    packageName: string,
    activity: string,
    debug: boolean,
    action: ?string,
    parameters: ?Map<string, string>,
  ): Promise<string> {
    if (debug) {
      // Enable "wait for debugger" semantics for the next launch of
      // the specified package.
      await this.setDebugApp(packageName, false);
    }

    const args = ['shell', 'am', 'start'];
    if (action != null) {
      args.push('-a', action);
    }
    if (parameters != null) {
      for (const [key, parameter] of parameters) {
        args.push('-e', key, parameter);
      }
    }
    args.push('-W', '-n');
    args.push(`${packageName}/${activity}`);
    return this.runShortCommand(...args).toPromise();
  }

  async launchMainActivity(
    packageName: string,
    debug: boolean,
  ): Promise<string> {
    if (debug) {
      // Enable "wait for debugger" semantics for the next launch of
      // the specified package.
      await this.setDebugApp(packageName, false);
    }

    const args = [
      'shell',
      'monkey',
      '-p',
      `${packageName}`,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ];
    return this.runShortCommand(...args).toPromise();
  }

  async launchService(
    packageName: string,
    serviceName: string,
    debug: boolean,
  ): Promise<string> {
    if (debug) {
      // Enable "wait for debugger" semantics for the next launch of
      // the specified package.
      await this.setDebugApp(packageName, false);
    }

    const args = [
      'shell',
      'am',
      'startservice',
      `${packageName}/${serviceName}`,
    ];
    return this.runShortCommand(...args).toPromise();
  }

  setDebugApp(packageName: string, persist: boolean): Promise<string> {
    const args = ['shell', 'am', 'set-debug-app', '-w'];

    if (persist) {
      args.push('--persistent');
    }
    args.push(`${packageName}`);
    return this.runShortCommand(...args).toPromise();
  }

  _dumpsysPackage(): Observable<string> {
    return this.runShortCommand('shell', 'dumpsys', 'package');
  }

  activityExists(packageName: string, activity: string): Promise<boolean> {
    const packageActivityString = `${packageName}/${activity}`;
    return this._dumpsysPackage()
      .map(stdout => stdout.includes(packageActivityString))
      .toPromise();
  }

  getAllAvailablePackages(): Promise<Array<string>> {
    return this._dumpsysPackage()
      .map(stdout => stdout.split('\n').map(line => line.trim()))
      .toPromise();
  }

  touchFile(path: string): Promise<string> {
    return this.runShortCommand('shell', 'touch', path).toPromise();
  }

  removeFile(path: string): Promise<string> {
    return this.runShortCommand('shell', 'rm', path).toPromise();
  }

  getDebuggableProcesses(): Observable<Array<SimpleProcess>> {
    return this.getJavaProcesses();
  }

  getJavaProcesses(): Observable<Array<AndroidJavaProcess>> {
    const jdwpProcesses = new Set();
    return this.runPsCommand()
      .map(stdout => {
        const psOutput = stdout.trim();
        return parsePsTableOutput(psOutput, ['user', 'pid', 'name']);
      })
      .switchMap(allProcesses => {
        const map = new Map();
        allProcesses
          .filter(row => row != null)
          .forEach(proc => map.set(proc.pid, proc));
        return Promise.resolve(map);
      })
      .switchMap(allProcessesMap => {
        return this.runLongCommand('jdwp').map(output => {
          if (output.kind === 'stdout') {
            const block: string = output.data;
            block.split(/\s+/).forEach(pid => {
              const proc = allProcessesMap.get(pid);
              if (proc != null) {
                jdwpProcesses.add(proc);
              }
            });
          }
        });
      })
      .timeout(1000)
      .catch(error => Observable.of([]))
      .switchMap(() => {
        return Promise.resolve(Array.from(jdwpProcesses));
      });
  }

  async dumpsysPackage(pkg: string): Promise<?string> {
    if (!(await this.isPackageInstalled(pkg))) {
      return null;
    }
    return this.runShortCommand('shell', 'dumpsys', 'package', pkg).toPromise();
  }

  getDeviceArgs(): Array<string> {
    return this._serial !== '' ? ['-s', this._serial] : [];
  }

  getProcesses(): Observable<Array<SimpleProcess>> {
    return this.runPsCommand().map(stdout =>
      stdout.split(/\n/).map(line => {
        const info = line.trim().split(/\s+/);
        return {user: info[0], pid: info[1], name: info[info.length - 1]};
      }),
    );
  }

  runPsCommand(...additionalCommands: string[]): Observable<string> {
    return this.getAPIVersion().switchMap(apiVersion => {
      let commands = ['shell', 'ps'];
      // Starting with Android 8.0 Oreo (API 26) ps only returns all processes
      // with -A
      if (parseInt(apiVersion, 10) >= 26) {
        commands.push('-A');
      }
      commands = commands.concat(additionalCommands);
      return this.runShortCommand(...commands);
    });
  }

  runShortCommand(...command: string[]): Observable<string> {
    return runCommand('adb', this.getDeviceArgs().concat(command));
  }

  runLongCommand(...command: string[]): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return observeProcess('adb', this.getDeviceArgs().concat(command), {
      killTreeWhenDone: true,
      /* TODO(T17353599) */ isExitError: () => false,
    }).catch(error => Observable.of({kind: 'error', error})); // TODO(T17463635)
  }

  runLongCommandNew(...command: string[]): Observable<ProcessMessage> {
    return observeProcess('adb', this.getDeviceArgs().concat(command), {
      killTreeWhenDone: true,
    });
  }

  static _parseDevicesCommandOutput(stdout: string): Array<AdbDevice> {
    const nameFrequency: Map<string, number> = new Map();

    return stdout
      .split(/\n+/g)
      .slice(1)
      .filter(s => s.length > 0 && !s.trim().startsWith('*'))
      .map(s => s.split(/\s+/g))
      .filter(a => a[0] !== '')
      .map(a => {
        const serial = a[0];
        const props = a.slice(2);
        let product;
        let model;
        let device;
        let usb;
        let transportId;
        for (const prop of props) {
          const pair = prop.split(':');
          if (pair.length !== 2) {
            continue;
          }
          switch (pair[0]) {
            case 'product':
              product = pair[1];
              break;
            case 'model':
              model = pair[1];
              break;
            case 'device':
              device = pair[1];
              break;
            case 'usb':
              usb = pair[1];
              break;
            case 'transport_id':
              transportId = pair[1];
              break;
            default:
              break;
          }
        }
        const displayName =
          serial.startsWith('emulator') ||
          serial.startsWith('localhost:') ||
          model == null
            ? serial
            : model;

        const count = nameFrequency.get(displayName);
        if (count == null) {
          nameFrequency.set(displayName, 1);
        } else {
          nameFrequency.set(displayName, count + 1);
        }

        return {
          serial,
          displayName,
          product,
          model,
          device,
          usb,
          transportId,
        };
      })
      .map(device => {
        const {displayName, serial} = device;
        if (displayName === serial || nameFrequency.get(displayName) === 1) {
          return device;
        } else {
          return {
            ...device,
            displayName: `${displayName} - ${serial}`,
          };
        }
      });
  }

  static getDevices(): Promise<Array<AdbDevice>> {
    return runCommand('adb', ['devices', '-l'])
      .map(stdout => this._parseDevicesCommandOutput(stdout))
      .timeout(ADB_TIMEOUT)
      .toPromise();
  }

  static killServer(): Promise<void> {
    return runCommand('adb', ['kill-server'])
      .mapTo(undefined)
      .toPromise();
  }

  static getVersion(): Promise<string> {
    return runCommand('adb', ['version'])
      .map(versionString => {
        const version = versionString.match(/version (\d+.\d+.\d+)/);
        if (version) {
          return version[1];
        }
        throw new Error(`No version found with "${versionString}"`);
      })
      .toPromise();
  }
}
