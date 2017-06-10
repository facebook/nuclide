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
/* global localStorage */

import type {DebuggerConfigAction} from '../../nuclide-debugger-base';

// transientSettings will matinain configuration that should be persisted for the
// duration of the current Nunclide session (so preserved across the configuration dialog
// closing and re-opening), but not preserved if Nuclide is restarted.
const transientSettings = {};

function _getStorageKey(
  host: string,
  action: DebuggerConfigAction,
  debuggerName: string,
) {
  return 'NUCLIDE_DEBUGGER_CONFIG_' + host + '_' + action + '_' + debuggerName;
}

export function serializeDebuggerConfig(
  host: string,
  action: DebuggerConfigAction,
  debuggerName: string,
  persistent: Object,
  transient?: Object,
): void {
  const key = _getStorageKey(host, action, debuggerName);
  localStorage.setItem(key, JSON.stringify(persistent));

  if (transient == null) {
    delete transientSettings[key];
  } else {
    transientSettings[key] = transient;
  }
}

export function deserializeDebuggerConfig(
  host: string,
  action: DebuggerConfigAction,
  debuggerName: string,
  callback: (transientSettings: Object, persistentSettings: Object) => void,
): void {
  const key = _getStorageKey(host, action, debuggerName);
  const val = localStorage.getItem(key);
  try {
    const persistedSettings = val != null ? (JSON.parse(val): any) : {};
    callback(transientSettings[key] || {}, persistedSettings);
  } catch (err) {}
}

export function setLastUsedDebugger(
  host: string,
  action: DebuggerConfigAction,
  debuggerDisplayName: string,
): void {
  const key = 'NUCLIDE_DEBUGGER_LAST_USED_' + host + '_' + action;
  localStorage.setItem(key, debuggerDisplayName);
}

export function getLastUsedDebugger(
  host: string,
  action: DebuggerConfigAction,
): ?string {
  const key = 'NUCLIDE_DEBUGGER_LAST_USED_' + host + '_' + action;
  return localStorage.getItem(key);
}
