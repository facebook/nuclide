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

import type {ActionsObservable} from 'nuclide-commons/redux-observable';
import type {
  ProcessTask,
  Process,
  AppInfoRow,
  DeviceAppInfoProvider,
  DeviceTypeComponent,
  Device,
  DeviceTaskProvider,
  Task,
} from 'nuclide-debugger-common/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Action, Store, AppState} from '../types';

import {getLogger} from 'log4js';
import {arrayEqual, arrayFlatten, collect} from 'nuclide-commons/collection';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import {Observable} from 'rxjs';
import {track} from 'nuclide-analytics';
import {AnalyticsActions} from '../constants';
import {DevicePanelTask} from '../DevicePanelTask';
import * as Actions from './Actions';
import invariant from 'assert';
import {getProviders} from '../providers';
import shallowEqual from 'shallowequal';
import * as Immutable from 'immutable';

export function pollDevicesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.TOGGLE_DEVICE_POLLING)
    .map(action => {
      invariant(action.type === Actions.TOGGLE_DEVICE_POLLING);
      return [store.getState(), action.payload.isActive];
    })
    .distinctUntilChanged(
      ([stateA, isActiveA], [stateB, isActiveB]) =>
        stateA.deviceType === stateB.deviceType &&
        stateA.host === stateB.host &&
        isActiveA === isActiveB,
    )
    .switchMap(([state, isActive]) => {
      if (state.deviceType == null || !isActive) {
        return Observable.empty();
      }
      for (const fetcher of getProviders().deviceList) {
        if (fetcher.getType() === state.deviceType) {
          return fetcher
            .observe(state.host)
            .map(devices => Actions.setDevices(devices));
        }
      }
      return Observable.empty();
    });
}

export function setDevicesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_DEVICES)
    .switchMap(action => {
      return getDeviceTasks(store.getState()).catch(error => {
        getLogger().error(error);
        track('nuclide-device-panel:device-tasks:error', {error});
        return Observable.of(new Map());
      });
    })
    .map(tasks => Actions.setDeviceTasks(tasks));
}

export function pollProcessesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.TOGGLE_PROCESS_POLLING)
    .switchMap(action => {
      invariant(action.type === Actions.TOGGLE_PROCESS_POLLING);
      return Observable.of([store.getState(), action.payload.isActive]);
    })
    .distinctUntilChanged(
      ([stateA, isActiveA], [stateB, isActiveB]) =>
        stateA.deviceType === stateB.deviceType &&
        stateA.host === stateB.host &&
        shallowEqual(stateA.device, stateB.device) &&
        isActiveA === isActiveB,
    )
    .switchMap(([state, isActive]) => {
      const device = state.device;
      if (device == null || !isActive) {
        return Observable.empty();
      }
      const providers = Array.from(getProviders().deviceProcesses).filter(
        provider => provider.getType() === state.deviceType,
      );
      if (providers[0] != null) {
        return providers[0]
          .observe(state.host, device)
          .map(processes => Actions.setProcesses(processes));
      }
      return Observable.empty();
    });
}

export function setDeviceEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_DEVICE).switchMap(action => {
    invariant(action.type === Actions.SET_DEVICE);
    const state = store.getState();
    return Observable.merge(
      getInfoTables(state).switchMap(infoTables =>
        Observable.of(Actions.setInfoTables(infoTables)),
      ),
      getProcessTasks(state).switchMap(processTasks =>
        Observable.of(Actions.setProcessTasks(processTasks)),
      ),
    );
  });
}

export function setDeviceTypesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_DEVICE_TYPES).switchMap(action => {
    invariant(action.type === Actions.SET_DEVICE_TYPES);
    const state = store.getState();
    const deviceType =
      state.deviceType != null ? state.deviceType : state.deviceTypes[0];
    return Observable.merge(
      Observable.of(Actions.setDeviceType(deviceType)),
      Observable.of(Actions.toggleDevicePolling(state.isPollingDevices)),
    );
  });
}

const deviceTypeTaskCache = new SimpleCache({
  keyFactory: ([state: AppState, providerName: string]) =>
    JSON.stringify([state.host, state.deviceType, providerName]),
});

export function setDeviceTypeEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_DEVICE_TYPE).switchMap(action => {
    const state = store.getState();
    return Observable.of(
      Array.from(getProviders().deviceTypeTask)
        .filter(provider => provider.getType() === state.deviceType)
        .map(provider =>
          deviceTypeTaskCache.getOrCreate(
            [state, provider.getName()],
            () =>
              new DevicePanelTask(
                () => provider.getDeviceTypeTask(state.host),
                provider.getName(),
              ),
          ),
        ),
    ).map(tasks =>
      Actions.setDeviceTypeTasks(
        tasks.sort((a, b) => a.getName().localeCompare(b.getName())),
      ),
    );
  });
}

export function setProcessesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_PROCESSES).switchMap(action => {
    const state = store.getState();
    return getProcessTasks(state).switchMap(processTasks =>
      Observable.of(Actions.setProcessTasks(processTasks)),
    );
  });
}

export function setAppInfoEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return observeProcessNamesOfInterest(actions, store)
    .switchMap(processNames => {
      const {device, host} = store.getState();
      if (device == null || processNames.length === 0) {
        return Observable.of(new Map());
      }
      const providers = Array.from(getProviders().appInfo);
      return observeAppInfoTables(processNames, providers, host, device);
    })
    .map(appInfoTables => Actions.setAppInfoTables(appInfoTables));
}

export function setDeviceTypeComponentsEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_DEVICE_TYPE).switchMap(action => {
    invariant(action.type === Actions.SET_DEVICE_TYPE);
    const {deviceType} = action.payload;
    const {host} = store.getState();
    if (deviceType == null) {
      return Observable.empty();
    }

    const providers = Array.from(getProviders().deviceTypeComponent).filter(
      provider => provider.getType() === deviceType,
    );
    if (providers.length === 0) {
      return Observable.empty();
    }

    const combinedComponents: Observable<
      Array<?DeviceTypeComponent>,
    > = Observable.from(
      providers.map(provider =>
        Observable.create(observer => {
          const disposable = provider.observe(host, component => {
            observer.next(component);
          });
          return () => {
            disposable.dispose();
          };
        })
          .startWith(null)
          .catch(e => {
            getLogger().error(e);
            return Observable.of(null);
          }),
      ),
      // $FlowFixMe add combineAll to flow
    ).combineAll();

    const groupedComponents = combinedComponents.map(components =>
      Immutable.List(components)
        .filter(c => c != null)
        .map(c => {
          invariant(c != null);
          return c;
        })
        .groupBy(c => c.position),
    );

    return groupedComponents.map(value =>
      Actions.setDeviceTypeComponents(Immutable.Map(value)),
    );
  });
}

function uniqueArray<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}

// Returns an observable to an array of process names. Only process names that
// are needed by the AppInfo providers are observed. A new value is produced
// every time the list of process names changes (a new process started running
// or a running process was shut down).
function observeProcessNamesOfInterest(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Array<string>> {
  return actions
    .ofType(Actions.SET_PROCESSES)
    .map(action => {
      const providers = Array.from(getProviders().appInfo);
      const processNamesOfInterest = new Set(
        providers.map(provider => provider.getProcessName()),
      );
      const processes = store.getState().processes.getOrDefault([]);
      return uniqueArray(
        processes
          .filter(process => processNamesOfInterest.has(process.name))
          .map(process => process.name),
      );
    })
    .distinctUntilChanged(arrayEqual);
}

// Given a list of process names and providers it returns an observable for a
// Map. Only providers for the given process names are subscribed to. The Map
// is keyed by application name and maps to an array of AppInfoRow. The
// AppInfoRow contains the values observed on each provider for the
// corresponding application name.
// This observable only emits a value when any of value is changed.
function observeAppInfoTables(
  processNames: Array<string>,
  providers: Array<DeviceAppInfoProvider>,
  host: string,
  device: Device,
): Observable<Map<string, Array<AppInfoRow>>> {
  const observables = processNames.map(processName => {
    const providersForProcess = providers.filter(
      provider => provider.getProcessName() === processName,
    );
    return observeAppInfoTable(providersForProcess, host, device);
  });

  const resultSelector = (...multipleAppInfoRows) =>
    // Creates a Map that groups by all appInfoRow by appName:
    // Map<appName, Array<AppInfoRow>>
    collect(
      arrayFlatten(multipleAppInfoRows).map(appInfoRow => [
        appInfoRow.appName,
        appInfoRow,
      ]),
    );

  // $FlowFixMe - combineLatest type spec doesn't support spread operator.
  return Observable.combineLatest(...observables, resultSelector);
}

function observeAppInfoTable(
  tableProviders: Array<DeviceAppInfoProvider>,
  host: string,
  device: Device,
): Observable<Array<AppInfoRow>> {
  return observeAppInfoProviderValues(tableProviders, host, device).map(
    values => {
      return tableProviders.map((provider, index) => ({
        appName: provider.getAppName(),
        name: provider.getName(),
        ...values[index], // {value, isError?}
        canUpdate: provider.canUpdate(),
        update: provider.update,
      }));
    },
  );
}

// Given an array of providers it subscribes to the values of all of them. It
// returns an observer to an array of all the produced values from the
// providers. A new array is produced every time any of values changes.
const APP_INFO_UPDATE_INTERVAL = 3000;
function observeAppInfoProviderValues(
  providers: Array<DeviceAppInfoProvider>,
  host: string,
  device: Device,
): Observable<Array<{value: string, isError?: boolean}>> {
  const observables = providers.map(provider =>
    Observable.timer(0, APP_INFO_UPDATE_INTERVAL)
      .switchMap(() => {
        return provider
          .observe(host, device)
          .map(value => ({value}))
          .catch(error => Observable.of({value: error.message, isError: true}));
      })
      .distinctUntilChanged(shallowEqual)
      .do(item => {
        if (item.isError) {
          track(AnalyticsActions.APPINFOTABLES_DATA_ERROR, item);
        } else {
          track(AnalyticsActions.APPINFOTABLES_DATA_VALUE, item);
        }
      }),
  );
  // $FlowFixMe - combineLatest type spec doesn't support spread operator.
  return Observable.combineLatest(...observables);
}

function getInfoTables(
  state: AppState,
): Observable<Map<string, Map<string, string>>> {
  const device = state.device;
  if (device == null) {
    return Observable.of(new Map());
  }
  return Observable.merge(
    ...Array.from(getProviders().deviceInfo)
      .filter(provider => provider.getType() === state.deviceType)
      .map(provider => {
        return provider
          .isSupported(state.host)
          .switchMap(isSupported => {
            if (!isSupported) {
              return Observable.empty();
            }
            return provider.fetch(state.host, device).map(list => ({
              title: provider.getTitle(),
              list,
              priority:
                provider.getPriority === undefined
                  ? -1
                  : provider.getPriority(),
            }));
          })
          .catch(() => Observable.empty());
      }),
  )
    .toArray()
    .map(infoTables =>
      infoTables
        .sort((a, b) => b.priority - a.priority)
        .map(table => [table.title, table.list]),
    )
    .map(infoTables => new Map(infoTables));
}

function getProcessTasks(state: AppState): Observable<ProcessTask[]> {
  const device = state.device;
  if (device == null) {
    return Observable.of([]);
  }
  return Observable.merge(
    ...Array.from(getProviders().processTask)
      .filter(provider => provider.getType() === state.deviceType)
      .map(provider => {
        const processes = state.processes.getOrDefault([]);
        return provider
          .getSupportedPIDs(state.host, device, processes)
          .map(supportedSet => {
            return {
              type: provider.getTaskType(),
              run: (proc: Process) => provider.run(state.host, device, proc),
              isSupported: (proc: Process) => supportedSet.has(proc.pid),
              name: provider.getName(),
            };
          });
      }),
  ).toArray();
}

// Generates a map of device tasks for each device identifier.
function getDeviceTasks(state: AppState): Observable<Map<string, Array<Task>>> {
  const {devices, deviceType, host} = state;
  if (deviceType == null) {
    return Observable.empty();
  }
  const providers = Array.from(getProviders().deviceTask).filter(
    provider => provider.getType() === deviceType,
  );

  const observablePerDevice = devices
    .getOrDefault([])
    .map(device => getDeviceTasksForDevice(providers, device, host));
  const combinedMapPairs: Observable<Array<[string, Array<Task>]>> =
    // $FlowIgnore combineAll
    Observable.from(observablePerDevice).combineAll();
  return combinedMapPairs.map(pairs => new Map(pairs));
}

// Generates a pair of device identifier + tasks for it. The identifier is always for the device passed in.
// It's convenient to make a Map out of these tuples.
function getDeviceTasksForDevice(
  providers: Array<DeviceTaskProvider>,
  device: Device,
  host: NuclideUri,
): Observable<[string, Array<Task>]> {
  // A single observable per each provider for this device.
  const perProviderAndDevice = providers.map(provider =>
    getDeviceTasksForProvider(device, provider, host),
  );
  // $FlowIgnore combineAll
  const combinedForDevice: Observable<Array<Array<Task>>> = Observable.from(
    perProviderAndDevice,
  ).combineAll();
  // Flatten the array (merge tasks from all providers into a single flat array)
  // and put that array it into a tuple with identifier for this device.
  return combinedForDevice
    .map(array =>
      array.reduce((acc, element) => {
        return acc.concat(element);
      }, []),
    )
    .map(tasks => [
      device.identifier,
      tasks.sort((a, b) => a.getName().localeCompare(b.getName())),
    ]);
}

function getDeviceTasksForProvider(
  device: Device,
  provider: DeviceTaskProvider,
  host: NuclideUri,
): Observable<Array<DevicePanelTask>> {
  return provider
    .getDeviceTasks(host, device)
    .catch(() => Observable.of([]))
    .defaultIfEmpty([])
    .map(tasks => {
      return tasks.map(
        // TODO: Keep track of tasks after starting them
        t => new DevicePanelTask(() => t.getEvents(), t.getName()),
      );
    });
}
