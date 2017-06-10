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
import type {
  HostServices,
} from '../../nuclide-language-service-rpc/lib/rpc-types';

import {FileCache} from '../../nuclide-open-files-rpc';
import {LspLanguageService} from './LspLanguageService';
import {
  MultiProjectLanguageService,
  forkHostServices,
} from '../../nuclide-language-service-rpc';

export function createMultiLspLanguageService(
  logger: log4js$Logger,
  fileCache: FileCache,
  host: HostServices,
  consoleSource: string,
  command: string,
  args: Array<string>,
  projectFileName: string,
  fileExtensions: Array<NuclideUri>,
): MultiProjectLanguageService<LspLanguageService> {
  const result = new MultiProjectLanguageService();

  // This MultiProjectLanguageService stores LspLanguageServices, lazily
  // created upon demand, one per project root. Demand is usually "when the
  // user opens a file" or "when the user requests project-wide symbol search".

  // What state is the each LspLanguageService in? ...
  // * 'Initializing' state, still spawning the LSP server and negotiating with
  //    it, or inviting the user via a dialog box to retry initialization.
  // * 'Ready' state, able to handle LanguageService requests properly.
  // * 'Stopped' state, meaning that the LspConnection died and will not be
  //   restarted, but we can still respond to those LanguageServiceRequests
  //   that don't require an LspConnection).

  const languageServiceFactory = async (projectDir: string) => {
    await result.hasObservedDiagnostics();
    // We're awaiting until AtomLanguageService has observed diagnostics (to
    // prevent race condition: see below).

    const lsp = new LspLanguageService(
      logger,
      fileCache,
      (await forkHostServices(host, logger)),
      consoleSource,
      command,
      args,
      projectDir,
      fileExtensions,
    );

    lsp.start(); // Kick off 'Initializing'...
    return lsp;

    // CARE! We want to avoid a race condition where LSP starts producing
    // diagnostics before AtomLanguageService has yet had a chance to observe
    // them (and we don't want to have to buffer the diagnostics indefinitely).
    // We rely on the fact that LSP won't produce them before start() has
    // returned. As soon as we ourselves return, MultiProjectLanguageService
    // will hook up observeDiagnostics into the LSP process, so it'll be ready.
  };

  result.initialize(
    logger,
    fileCache,
    host,
    projectFileName,
    fileExtensions,
    languageServiceFactory,
  );
  return result;
}
