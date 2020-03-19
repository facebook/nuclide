/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  DatatipService,
  ConsoleService,
  RegisterExecutorFunction,
  TerminalApi,
} from 'atom-ide-ui';
import type {
  DebuggerConfigurationProvider,
  IProcessConfig,
  VsAdapterType,
} from 'nuclide-debugger-common';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type raiseNativeNotificationFunc = ?(
  title: string,
  body: string,
  timeout: number,
  raiseIfAtomHasFocus: boolean,
) => ?IDisposable;

let _raiseNativeNotification: ?raiseNativeNotificationFunc = null;
let _registerExecutor: ?RegisterExecutorFunction = null;
let _datatipService: ?DatatipService = null;
let _createConsole: ?ConsoleService = null;
let _terminalService: ?TerminalApi = null;
let _rpcService: ?nuclide$RpcService = null;
const _configurationProviders: Map<
  VsAdapterType,
  DebuggerConfigurationProvider,
> = new Map();

export function setConsoleService(createConsole: ConsoleService): IDisposable {
  _createConsole = createConsole;
  return new UniversalDisposable(() => {
    _createConsole = null;
  });
}

export function getConsoleService(): ?ConsoleService {
  return _createConsole;
}

export function setConsoleRegisterExecutor(
  registerExecutor: RegisterExecutorFunction,
): IDisposable {
  _registerExecutor = registerExecutor;
  return new UniversalDisposable(() => {
    _registerExecutor = null;
  });
}

export function getConsoleRegisterExecutor(): ?RegisterExecutorFunction {
  return _registerExecutor;
}

export function setDatatipService(datatipService: DatatipService): IDisposable {
  _datatipService = datatipService;
  return new UniversalDisposable(() => {
    _datatipService = null;
  });
}

export function getDatatipService(): ?DatatipService {
  return _datatipService;
}

export function setNotificationService(
  raiseNativeNotification: raiseNativeNotificationFunc,
): void {
  _raiseNativeNotification = raiseNativeNotification;
}

export function getNotificationService(): ?raiseNativeNotificationFunc {
  return _raiseNativeNotification;
}

export function setTerminalService(terminalService: TerminalApi): IDisposable {
  _terminalService = terminalService;
  return new UniversalDisposable(() => {
    _terminalService = null;
  });
}

export function getTerminalService(): ?TerminalApi {
  return _terminalService;
}

export function setRpcService(rpcService: nuclide$RpcService): IDisposable {
  _rpcService = rpcService;
  return new UniversalDisposable(() => {
    _rpcService = null;
  });
}

export function isNuclideEnvironment(): boolean {
  return _rpcService != null;
}

export function addDebugConfigurationProvider(
  provider: DebuggerConfigurationProvider,
): IDisposable {
  const existingProvider = _configurationProviders.get(provider.adapterType);
  if (existingProvider != null) {
    throw new Error(
      'Debug Configuration Provider already exists for adapter type: ' +
        provider.adapterType,
    );
  }
  _configurationProviders.set(provider.adapterType, provider);
  return new UniversalDisposable(() => {
    _configurationProviders.delete(provider.adapterType);
  });
}

export async function resolveDebugConfiguration(
  configuration: IProcessConfig,
): Promise<IProcessConfig> {
  const existingProvider = _configurationProviders.get(
    configuration.adapterType,
  );
  return existingProvider != null
    ? existingProvider.resolveConfiguration(configuration)
    : configuration;
}
