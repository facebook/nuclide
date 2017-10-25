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

import {Observable} from 'rxjs';
import * as Actions from './Actions';
import invariant from 'assert';
import {getProviders} from '../providers';
import {DeviceTask} from '../DeviceTask';
import {Cache} from '../../../commons-node/cache';
import shallowEqual from 'shallowequal';

import type {ActionsObservable} from 'nuclide-commons/redux-observable';
import type {Action, Store, AppState, ProcessTask, Process} from '../types';

export function pollDevicesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.TOGGLE_DEVICE_POLLING)
    .switchMap(action => {
      invariant(action.type === Actions.TOGGLE_DEVICE_POLLING);
      return Observable.of([store.getState(), action.payload.isActive]);
    })
    .distinctUntilChanged(
      ([stateA, isActiveA], [stateB, isActiveB]) =>
        stateA.deviceType === stateB.deviceType &&
        stateA.host === stateB.host &&
        isActiveA === isActiveB,
    )
    .switchMap(([state, isActive]) => {
      // eslint-disable-next-line eqeqeq
      if (state.deviceType === null || !isActive) {
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
      getDeviceTasks(state).switchMap(deviceTasks =>
        Observable.of(Actions.setDeviceTasks(deviceTasks)),
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

const deviceTypeTaskCache = new Cache({
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
              new DeviceTask(
                () => provider.getTask(state.host),
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
    invariant(action.type === Actions.SET_PROCESSES);
    const state = store.getState();
    return getProcessTasks(state).switchMap(processTasks =>
      Observable.of(Actions.setProcessTasks(processTasks)),
    );
  });
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
        const processes = state.processes.isError ? [] : state.processes.value;
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

// The actual device tasks are cached so that if a task is running when the store switches back and
// forth from the device associated with that task, the same running task is used
const deviceTaskCache = new Cache({
  keyFactory: ([state: AppState, providerName: string]) =>
    JSON.stringify([state.host, state.deviceType, providerName]),
});
function getDeviceTasks(state: AppState): Observable<DeviceTask[]> {
  const device = state.device;
  if (device == null) {
    return Observable.of([]);
  }
  return Observable.merge(
    ...Array.from(getProviders().deviceTask)
      .filter(provider => provider.getType() === state.deviceType)
      .map(provider => {
        return provider
          .isSupported(state.host)
          .switchMap(isSupported => {
            if (!isSupported) {
              return Observable.empty();
            }
            return Observable.of(
              deviceTaskCache.getOrCreate(
                [state, provider.getName()],
                () =>
                  new DeviceTask(
                    () => provider.getTask(state.host, device),
                    provider.getName(),
                  ),
              ),
            );
          })
          .catch(() => Observable.empty());
      }),
  )
    .toArray()
    .map(actions =>
      actions.sort((a, b) => a.getName().localeCompare(b.getName())),
    );
}
