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

import type {BuckWebSocketMessage} from '../../nuclide-buck-rpc';
import type {BuckEvent} from './BuckEventStream';
import type {LegacyProcessMessage, TaskEvent} from 'nuclide-commons/process';
import type {ResolvedBuildTarget} from '../../nuclide-buck-rpc/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import passesGK from 'nuclide-commons/passesGK';
import typeof * as BuckService from '../../nuclide-buck-rpc';
import type {
  BuckBuildTask,
  BuckBuildOptions,
  BuckBuildOutput,
  BuckSubcommand,
  TaskSettings,
} from './types';
import type {
  DiagnosticInvalidationMessage,
  DiagnosticProviderUpdate,
  ObservableDiagnosticProvider,
} from 'atom-ide-ui';

import {Observable, Subject, TimeoutError} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  createMessage,
  createResult,
  taskFromObservable,
} from '../../commons-node/tasks';
import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {
  combineEventStreams,
  getDiagnosticEvents,
  getEventsFromSocket,
  getEventsFromProcess,
} from './BuckEventStream';
import {BuckConsoleParser} from './BuckConsoleParser';

const SOCKET_TIMEOUT = 30000;

export type {BuckSubcommand} from './types';

export class BuckBuildSystem {
  _diagnosticUpdates: Subject<DiagnosticProviderUpdate> = new Subject();
  _diagnosticInvalidations: Subject<
    DiagnosticInvalidationMessage,
  > = new Subject();

  build(opts: BuckBuildOptions): BuckBuildTask {
    const {root, target, args} = opts;
    let buildOutput: ?BuckBuildOutput = null;

    const task = taskFromObservable(
      this.runSubcommand(
        root,
        'build',
        target,
        {buildArguments: args},
        false,
        null,
      ).do(event => {
        if (event.type === 'result') {
          buildOutput = ((event.result: any): BuckBuildOutput);
        }
      }),
    );
    return {
      ...task,
      getBuildOutput(): BuckBuildOutput {
        if (buildOutput == null) {
          throw new Error('No build output!');
        }
        return buildOutput;
      },
    };
  }

  runSubcommand(
    buckRoot: NuclideUri,
    subcommand: BuckSubcommand,
    buildTarget: ResolvedBuildTarget,
    taskSettings: TaskSettings,
    isDebug: boolean,
    udid: ?string,
    processEventCallback: ?(
      processStream: Observable<LegacyProcessMessage>,
    ) => Observable<BuckEvent>,
    skipLaunchAfterInstall?: boolean = false,
  ): Observable<TaskEvent> {
    // Clear Buck diagnostics every time we run a buck command.
    this._diagnosticInvalidations.next({scope: 'all'});
    const buckService = getBuckServiceByNuclideUri(buckRoot);
    let buildArguments = taskSettings.buildArguments || [];
    const runArguments = taskSettings.runArguments || [];
    const keepGoing =
      taskSettings.keepGoing == null ? true : taskSettings.keepGoing;
    const targetString = getCommandStringForResolvedBuildTarget(buildTarget);

    return Observable.fromPromise(
      Promise.all([
        buckService.getHTTPServerPort(buckRoot),
        passesGK('nuclide_buck_superconsole'),
      ]),
    )
      .switchMap(([httpPort, useSuperconsole]) => {
        let socketEvents = null;
        let buildId: ?string = null;
        const socketStream = buckService
          .getWebSocketStream(buckRoot, httpPort)
          .refCount()
          .map(message => ((message: any): BuckWebSocketMessage))
          // The do() and filter() ensures that we only listen to messages
          // for a single build.
          .do(message => {
            // eslint-disable-next-line eqeqeq
            if (buildId === null) {
              if (message.type === 'BuildStarted') {
                buildId = message.buildId;
              }
            }
          })
          .filter(
            message => message.buildId == null || buildId === message.buildId,
          );
        if (httpPort > 0) {
          socketEvents = getEventsFromSocket(socketStream).share();
        }
        if (useSuperconsole) {
          buildArguments = buildArguments.concat([
            '--config',
            'ui.superconsole=enabled',
            '--config',
            'color.ui=always',
          ]);
        }

        let args =
          keepGoing && subcommand !== 'run'
            ? buildArguments.concat(['--keep-going'])
            : buildArguments;

        if (
          runArguments.length > 0 &&
          (subcommand === 'run' ||
            subcommand === 'install' ||
            subcommand === 'test')
        ) {
          args = args.concat(['--']).concat(runArguments);
        }

        const processMessages = runBuckCommand(
          buckService,
          buckRoot,
          targetString,
          subcommand,
          args,
          isDebug,
          udid,
          skipLaunchAfterInstall,
        ).share();
        const processEvents = getEventsFromProcess(processMessages).share();

        let httpRecommendation;
        let mergedEvents;
        if (socketEvents == null) {
          // Without a websocket, just pipe the Buck output directly.
          mergedEvents = processEvents;
          httpRecommendation = createMessage(
            'For better logs, set httpserver.port in your Buck config and restart Nuclide.',
            'info',
          );
        } else {
          mergedEvents = combineEventStreams(
            subcommand,
            socketEvents,
            processEvents,
          ).share();
          httpRecommendation = Observable.empty();
        }

        return Observable.concat(
          httpRecommendation,
          // Wait until the socket starts up before triggering the Buck process.
          socketEvents == null
            ? Observable.empty()
            : socketEvents
                .filter(event => event.type === 'socket-connected')
                .take(1)
                .timeout(SOCKET_TIMEOUT)
                .catch(err => {
                  if (err instanceof TimeoutError) {
                    throw new Error('Timed out connecting to Buck server.');
                  }
                  throw err;
                })
                .ignoreElements(),
          this._consumeEventStream(
            Observable.merge(
              mergedEvents,
              featureConfig.get('nuclide-buck.compileErrorDiagnostics')
                ? getDiagnosticEvents(mergedEvents, buckRoot)
                : Observable.empty(),
              processEventCallback != null
                ? processEventCallback(processMessages)
                : Observable.empty(),
            ),
            buckRoot,
          ),
        );
      })
      .share();
  }

  getDiagnosticProvider(): ObservableDiagnosticProvider {
    return {
      updates: this._diagnosticUpdates,
      invalidations: this._diagnosticInvalidations,
    };
  }

  /**
   * Processes side diagnostics, converts relevant events to TaskEvents.
   */
  _consumeEventStream(
    events: Observable<BuckEvent>,
    buckRoot: NuclideUri,
  ): Observable<TaskEvent> {
    // TODO: the Diagnostics API does not allow emitting one message at a time.
    // We have to accumulate messages per-file and emit them all.
    const fileDiagnostics = new Map();
    // Save error messages until the end so diagnostics have a chance to finish.
    // Real exceptions will not be handled by this, of course.
    let errorMessage = null;
    const consoleParser = new BuckConsoleParser();
    return Observable.concat(
      events.flatMap(event => {
        if (event.type === 'progress') {
          return Observable.of(event);
        } else if (event.type === 'buck-status') {
          return consoleParser.processStatusEvent(event);
        } else if (event.type === 'log') {
          return createMessage(event.message, event.level);
        } else if (event.type === 'build-output') {
          const {target, path, successType} = event.output;
          return Observable.concat(
            createMessage(`Target: ${target}`, 'log'),
            createMessage(`Output: ${path}`, 'log'),
            createMessage(`Success type: ${successType}`, 'log'),
            createResult({
              ...event.output,
              path: nuclideUri.join(buckRoot, path),
            }),
          );
        } else if (event.type === 'diagnostics') {
          // Warning: side effects below
          const {diagnostics} = event;
          // Update only the files that changed in this message.
          // Since emitting messages for a file invalidates it, we have to
          // be careful to emit all previous messages for it as well.
          const changedFiles = new Map();
          diagnostics.forEach(diagnostic => {
            let messages = fileDiagnostics.get(diagnostic.filePath);
            if (messages == null) {
              messages = [];
              fileDiagnostics.set(diagnostic.filePath, messages);
            }
            messages.push(diagnostic);
            changedFiles.set(diagnostic.filePath, messages);
          });
          this._diagnosticUpdates.next(changedFiles);
        } else if (event.type === 'error') {
          errorMessage = event.message;
        }
        return Observable.empty();
      }),
      Observable.defer(() => {
        if (fileDiagnostics.size > 0) {
          return createMessage(
            'Compilation errors detected: open the Diagnostics pane to jump to them.',
            'info',
          );
        } else {
          return Observable.empty();
        }
      }),
      Observable.defer(() => {
        if (errorMessage != null) {
          throw new Error(errorMessage);
        }
        return Observable.empty();
      }),
    );
  }
}

function runBuckCommand(
  buckService: BuckService,
  buckRoot: string,
  buildTarget: string,
  subcommand: BuckSubcommand,
  args: Array<string>,
  debug: boolean,
  simulator: ?string,
  skipLaunchAfterInstall?: boolean = false,
): Observable<LegacyProcessMessage> {
  // TODO(T17463635)
  if (debug) {
    // Stop any existing debugging sessions, as install hangs if an existing
    // app that's being overwritten is being debugged.
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'debugger:stop-debugging',
    );
  }

  const targets = splitTargets(buildTarget);
  if (subcommand === 'install') {
    const SENTINEL = {kind: 'exit', exitCode: null, signal: null};
    return (
      openExopackageTunnelIfNeeded(buckRoot, simulator)
        .switchMap(() => {
          return buckService
            .installWithOutput(
              buckRoot,
              targets,
              args,
              simulator,
              !skipLaunchAfterInstall,
              debug,
            )
            .refCount()
            .concat(Observable.of(SENTINEL));
        })
        // We need to do this to make sure that we close the
        // openExopackageTunnelIfNeeded observable once
        // buckService.installWithOutput finishes so we can close the tunnel.
        .takeWhile(value => value !== SENTINEL)
    );
  } else if (subcommand === 'build') {
    return buckService.buildWithOutput(buckRoot, targets, args).refCount();
  } else if (subcommand === 'test') {
    return buckService
      .testWithOutput(buckRoot, targets, args, debug)
      .refCount();
  } else if (subcommand === 'run') {
    return buckService.runWithOutput(buckRoot, targets, args).refCount();
  } else {
    throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

function getCommandStringForResolvedBuildTarget(
  target: ResolvedBuildTarget,
): string {
  const {qualifiedName, flavors} = target;
  const separator = flavors.length > 0 ? '#' : '';
  return `${qualifiedName}${separator}${flavors.join(',')}`;
}

function splitTargets(buildTarget: string): Array<string> {
  return buildTarget.trim().split(/\s+/);
}

function isOneWorldDevice(simulator: ?string): boolean {
  return simulator != null && /^localhost:\d+$/.test(simulator);
}

function openExopackageTunnelIfNeeded(
  host: NuclideUri,
  simulator: ?string,
): Observable<'ready'> {
  // We need to create this tunnel for exopackage installations to work as
  // buck expects this port to be open. We don't need it in the case of
  // installing to One World though because it's handled by adbmux.
  if (!nuclideUri.isRemote(host) || isOneWorldDevice(simulator)) {
    return Observable.of('ready');
  }

  return Observable.defer(async () =>
    passesGK('nuclide_adb_exopackage_tunnel'),
  ).mergeMap(shouldTunnel => {
    if (!shouldTunnel) {
      return Observable.of('ready');
    } else {
      return Observable.defer(async () =>
        consumeFirstProvider('nuclide.ssh-tunnel'),
      ).switchMap(service =>
        service.openTunnels([
          {
            description: 'exopackage',
            from: {host, port: 2829, family: 4},
            to: {host: 'localhost', port: 2829, family: 4},
          },
        ]),
      );
    }
  });
}
