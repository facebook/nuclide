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

import type {SearchStrategy} from 'nuclide-commons/ConfigCache';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';
import type {LogLevel} from '../../nuclide-logging/lib/rpc-types';
import type {LspPreferences} from './LspLanguageService';

import invariant from 'assert';
import {getLogger} from 'log4js';
import fsPromise from 'nuclide-commons/fsPromise';
import which from 'nuclide-commons/which';
import resolveFrom from 'resolve-from';
import {LspLanguageService} from './LspLanguageService';
import {getNuclideRealDir} from 'nuclide-commons/system-info';
import {FileCache} from '../../nuclide-open-files-rpc/lib/main';
import {
  MultiProjectLanguageService,
  forkHostServices,
} from '../../nuclide-language-service-rpc';

export type LspLanguageServiceParams = {|
  /* Required Parameters */

  // Pass this in from getNotifierByConnection() on the client.
  // This enables syncing of open files and directories.
  fileNotifier: FileNotifier,
  // Pass this in from getHostServices() on the client.
  // This enables the LSP server to trigger things like Atom notifications.
  host: HostServices,
  // LSP servers will be multiplexed based on a list of "project" files.
  // For every open file and directory, Nuclide will look upwards in parent directories for
  // any file in `projectFileNames` and then start a LSP server with `rootUri` set to the
  // directory containing the project file.
  // This makes it possible to have several different LSP servers for different open files,
  // even if the user hasn't mounted each of the project roots as directories in Atom.
  // The exact choice of file may be influenced by `projectFileSearchStrategy` below.
  // Example: Hack uses ['.hhconfig'] and Flow uses ['.flowconfig'].
  projectFileNames: Array<string>,
  // Language services will only be enabled for files with extensions in `fileExtensions`.
  // Example: ['.php', '.hhi'] etc. for Hack.
  fileExtensions: Array<string>,
  // A log4js category for LSP-related logging.
  // This will appear beside each message in Nuclide's log files.
  logCategory: string,
  // A log4js level for LSP-related logging.
  // Setting this to TRACE will enable logging of all messages over the LSP connection.
  logLevel: LogLevel,

  /* Optional Parameters */

  // Additional options to be passed to spawn().
  // See: SpawnProcessOptions from nuclide-commons/process
  spawnOptions?: Object,
  // When enabled, fork Nuclide's Node process to run the server.
  // `command` will be resolved via Node's require algorithm relative to the Nuclide root.
  fork?: boolean,
  // `initializationOptions` will be included in the LSP 'initialize' request.
  // See: https://microsoft.github.io/language-server-protocol/specification#initialize
  initializationOptions?: Object,
  // If multiple `projectFileNames` are found in parent directories, this specifies
  // the strategy to determine which one to use as the LSP `rootUri`.
  // nearest: Uses the matching project file in the closest parent directory possible.
  // furthest: Uses the matching project file in the furthest parent directory possible.
  // priority: Takes the first match in `projectFileNames` that exists in a parent directory,
  //           and then takes the 'nearest' strategy for that file.
  // pathMatch: Treat the filename list as path fragments and use the portion of the
  //            parent directory up to the end of the first fragment that matches.
  //            Example: file '/a/b/x/foo.c' with pattern ['b/x'] will match '/a/b/x'.
  // Default: 'nearest'.
  projectFileSearchStrategy?: SearchStrategy,
  // When spawning the LSP process, use the user's original shell environment
  // (rather than the sanitized Nuclide environment).
  // Default: false.
  useOriginalEnvironment?: boolean,
  // If provided, keeps an in-memory log of all LSP connection messages for the last
  // `additionalLogFilesRetentionPeriod` milliseconds.
  // These logs will be included with Nuclide's bug reports.
  // Default: 0.
  additionalLogFilesRetentionPeriod?: number,
  // Waits for the client to start observing diagnostics before starting the LSP server.
  // It's important to disable this if you don't plan to show diagnostics from the LSP server.
  // Otherwise, this should always be enabled.
  // Default: true.
  waitForDiagnostics?: boolean,
  // Waits for client to start observing status before starting the LSP server.
  // This defaults to false because not many language servers show status.
  // Similar to waitForDiagnostics.
  // Default: false.
  waitForStatus?: boolean,
  // Additional preferences for the language server.
  lspPreferences?: LspPreferences,
|};

/**
 * Creates a language service capable of connecting to an LSP server.
 * Note that spawnOptions and initializationOptions must both be RPC-able.
 */
export async function createMultiLspLanguageService(
  languageServerName: string,
  command_: string,
  args: Array<string>,
  params: LspLanguageServiceParams,
): Promise<?LanguageService> {
  const logger = getLogger(params.logCategory);
  logger.setLevel(params.logLevel);

  let command = command_;
  // if command is a json payload, it's resolved in LspLanguageService.js
  // after the projectRoot has been determined.
  if (!command.startsWith('{')) {
    command = params.fork
      ? (resolveFrom(getNuclideRealDir(), command_): string)
      : command_;
    const exists = params.fork
      ? await fsPromise.exists(command)
      : (await which(command)) != null;
    if (!exists) {
      const message = `Command "${command}" could not be found: ${languageServerName} language features will be disabled.`;
      logger.warn(message);
      params.host.consoleNotification(languageServerName, 'warning', message);
      return null;
    }
  }

  const result = new MultiProjectLanguageService();

  const fileCache = params.fileNotifier;
  invariant(fileCache instanceof FileCache);

  // This MultiProjectLanguageService stores LspLanguageServices, lazily
  // created upon demand, one per project root. Demand is usually "when the
  // user opens a file" or "when the user requests project-wide symbol search".

  // What state is each LspLanguageService in? ...
  // * 'Initializing' state, still spawning the LSP server and negotiating with
  //    it, or inviting the user via a dialog box to retry initialization.
  // * 'Ready' state, able to handle LanguageService requests properly.
  // * 'Stopped' state, meaning that the LspConnection died and will not be
  //   restarted, but we can still respond to those LanguageServiceRequests
  //   that don't require an LspConnection).

  const languageServiceFactory = async (projectDir: string) => {
    if (params.waitForDiagnostics !== false) {
      await result.hasObservedDiagnostics();
    }
    if (params.waitForStatus === true) {
      await result.hasObservedStatus();
    }
    // We're awaiting until AtomLanguageService has observed diagnostics (to
    // prevent race condition: see below).

    const lsp = new LspLanguageService(
      logger,
      fileCache,
      await forkHostServices(params.host, logger),
      languageServerName,
      command,
      args,
      params.spawnOptions,
      params.fork,
      projectDir,
      params.fileExtensions,
      params.initializationOptions || {},
      Number(params.additionalLogFilesRetentionPeriod),
      params.useOriginalEnvironment || false,
      params.lspPreferences,
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
    params.host,
    params.projectFileNames,
    params.projectFileSearchStrategy,
    params.fileExtensions,
    languageServiceFactory,
  );
  return result;
}
