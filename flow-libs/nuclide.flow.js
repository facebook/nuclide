/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

/* eslint-disable no-undef */

declare interface nuclide$CwdApi {
  setCwd(path: string): void;
  observeCwd(callback: (path: ?string) => void): IDisposable;
  getCwd(): ?string;
}

declare interface nuclide$RpcService {
  getServiceByNuclideUri(serviceName: string, uri: ?string): any;
}
