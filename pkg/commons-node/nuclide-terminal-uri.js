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

import invariant from 'assert';
import url from 'url';
import uuid from 'uuid';

import type {Command} from '../nuclide-pty-rpc/rpc-types';
import type {IconName} from 'nuclide-commons-ui/Icon';

export const URI_PREFIX = 'atom://nuclide-terminal-view';
export const TERMINAL_DEFAULT_LOCATION = 'pane';
export const TERMINAL_DEFAULT_ICON = 'terminal';

export type TerminalInfo = {
  cwd?: string,
  command?: Command,
  title?: string,
  key?: string,
  remainOnCleanExit: boolean,
  defaultLocation: string,
  icon: IconName,
  environmentVariables?: Map<string, string>,
  preservedCommands?: Array<string>,
};

export function uriFromCwd(cwd: ?string): string {
  const cwdOptions = cwd == null ? {} : {cwd};
  return uriFromInfo({
    ...cwdOptions,
    remainOnCleanExit: false,
    defaultLocation: TERMINAL_DEFAULT_LOCATION,
    icon: TERMINAL_DEFAULT_ICON,
  });
}

export function uriFromInfo(info: TerminalInfo): string {
  const uri = url.format({
    protocol: 'atom',
    host: 'nuclide-terminal-view',
    slashes: true,
    query: {
      cwd: info.cwd == null ? '' : info.cwd,
      command: info.command == null ? '' : JSON.stringify(info.command),
      title: info.title == null ? '' : info.title,
      key: info.key != null && info.key !== '' ? info.key : uuid.v4(),
      remainOnCleanExit: info.remainOnCleanExit,
      defaultLocation: info.defaultLocation,
      icon: info.icon,
      environmentVariables:
        info.environmentVariables != null
          ? JSON.stringify([...info.environmentVariables])
          : '',
      preservedCommands: JSON.stringify(info.preservedCommands || []),
    },
  });
  invariant(uri.startsWith(URI_PREFIX));
  return uri;
}

export function infoFromUri(paneUri: string): TerminalInfo {
  const {query} = url.parse(paneUri, true);
  if (query == null) {
    return {
      remainOnCleanExit: false,
      defaultLocation: TERMINAL_DEFAULT_LOCATION,
      icon: TERMINAL_DEFAULT_ICON,
    };
  } else {
    const cwd = query.cwd === '' ? {} : {cwd: query.cwd};
    const command =
      query.command === '' ? {} : {command: JSON.parse(query.command)};
    const title = query.title === '' ? {} : {title: query.title};
    const remainOnCleanExit = query.remainOnCleanExit === 'true';
    const key = query.key;
    const defaultLocation =
      query.defaultLocation != null && query.defaultLocation !== ''
        ? query.defaultLocation
        : TERMINAL_DEFAULT_LOCATION;
    const icon =
      query.icon != null && query.icon !== ''
        ? query.icon
        : TERMINAL_DEFAULT_ICON;
    const environmentVariables =
      query.environmentVariables != null && query.environmentVariables !== ''
        ? new Map(JSON.parse(query.environmentVariables))
        : new Map();
    const preservedCommands = JSON.parse(query.preservedCommands || '[]');
    return {
      ...cwd,
      ...command,
      ...title,
      remainOnCleanExit,
      defaultLocation,
      icon,
      key,
      environmentVariables,
      preservedCommands,
    };
  }
}
