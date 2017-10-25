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
import type {Level} from 'nuclide-commons/process';
import type {DiagnosticMessage} from 'atom-ide-ui';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {BuckBuildOutput, BuckSubcommand} from './types';

import {Observable} from 'rxjs';
import stripAnsi from 'strip-ansi';
import {getLogger} from 'log4js';
import DiagnosticsParser from './DiagnosticsParser';
import {exitEventToMessage} from 'nuclide-commons/process';

const PROGRESS_OUTPUT_INTERVAL = 5 * 1000;
const BUILD_FAILED_MESSAGE = 'BUILD FAILED:';
const BUILD_OUTPUT_REGEX = /^OK {3}(.*?) (.*?) (.*?)$/;

export type BuckEvent =
  | {
      type: 'progress',
      progress: ?number,
    }
  | {
      type: 'log',
      message: string,
      level: Level,
    }
  | {
      type: 'error',
      message: string,
    }
  | {
      type: 'diagnostics',
      diagnostics: Array<DiagnosticMessage>,
    }
  | {
      type: 'socket-connected',
    }
  | {type: 'build-output', output: BuckBuildOutput};

function convertJavaLevel(level: string): Level {
  switch (level) {
    case 'INFO':
      return 'info';
    case 'WARNING':
      return 'warning';
    case 'SEVERE':
      return 'error';
  }
  return 'log';
}

export function getEventsFromSocket(
  socketStream: Observable<BuckWebSocketMessage>,
): Observable<BuckEvent> {
  const log = (message, level = 'log') =>
    Observable.of({
      type: 'log',
      message,
      level,
    });

  const eventStream = socketStream
    .flatMap((message: BuckWebSocketMessage) => {
      switch (message.type) {
        case 'SocketConnected':
          return Observable.of({type: 'socket-connected'});
        case 'ParseStarted':
          return log('Parsing BUCK files...');
        case 'ParseFinished':
          return log('Parsing finished. Starting build...');
        case 'ConsoleEvent':
          const match = message.message.match(BUILD_OUTPUT_REGEX);
          if (match != null && match.length === 4) {
            // The result is also printed to stdout and converted into build-output there.
            return Observable.empty();
          } else {
            return log(message.message, convertJavaLevel(message.level.name));
          }
        case 'InstallFinished':
          return log('Install finished.', 'info');
        case 'BuildFinished':
          return log(
            `Build finished with exit code ${message.exitCode}.`,
            message.exitCode === 0 ? 'info' : 'error',
          );
        case 'BuildProgressUpdated':
          return Observable.of({
            type: 'progress',
            progress: message.progressValue,
          });
        case 'CompilerErrorEvent':
          // TODO: forward suggestions to diagnostics as autofixes
          return log(message.error, 'error');
      }
      return Observable.empty();
    })
    .catch(err => {
      getLogger('nuclide-buck').error('Got Buck websocket error', err);
      // Return to indeterminate progress.
      return Observable.of({
        type: 'progress',
        progress: null,
      });
    })
    .share();

  // Periodically emit log events for progress updates.
  const progressEvents = eventStream.switchMap(event => {
    if (
      event.type === 'progress' &&
      event.progress != null &&
      event.progress > 0 &&
      event.progress < 1
    ) {
      return log(`Building... [${Math.round(event.progress * 100)}%]`);
    }
    return Observable.empty();
  });

  return eventStream.merge(
    progressEvents
      .take(1)
      .concat(progressEvents.sampleTime(PROGRESS_OUTPUT_INTERVAL)),
  );
}

export function getEventsFromProcess(
  processStream: Observable<LegacyProcessMessage>, // TODO(T17463635)
): Observable<BuckEvent> {
  return processStream.map(message => {
    switch (message.kind) {
      case 'error':
        return {
          type: 'error',
          message: `Buck failed: ${message.error.message}`,
        };
      case 'exit':
        const logMessage = `Buck exited with ${exitEventToMessage(message)}.`;
        if (message.exitCode === 0) {
          return {
            type: 'log',
            message: logMessage,
            level: 'info',
          };
        }
        return {
          type: 'error',
          message: logMessage,
        };
      case 'stderr':
      case 'stdout':
        const match = message.data.trim().match(BUILD_OUTPUT_REGEX);
        if (match != null && match.length === 4) {
          return {
            type: 'build-output',
            output: {
              target: match[1],
              successType: match[2],
              path: match[3],
            },
          };
        } else {
          return {
            type: 'log',
            // Some Buck steps output ansi escape codes regardless of terminal setting.
            message: stripAnsi(message.data),
            // Build failure messages typically do not show up in the web socket.
            // TODO(hansonw): fix this on the Buck side
            level:
              message.data.indexOf(BUILD_FAILED_MESSAGE) === -1
                ? 'log'
                : 'error',
          };
        }
      default:
        (message: empty);
        throw new Error('impossible');
    }
  });
}

export function combineEventStreams(
  subcommand: BuckSubcommand,
  socketEvents: Observable<BuckEvent>,
  processEvents: Observable<BuckEvent>,
): Observable<BuckEvent> {
  // Every build finishes with a 100% progress event.
  function isBuildFinishEvent(event: BuckEvent) {
    return event.type === 'progress' && event.progress === 1;
  }
  function isRegularLogMessage(event: BuckEvent) {
    return event.type === 'log' && event.level === 'log';
  }
  // Socket stream never stops, so use the process lifetime.
  const finiteSocketEvents = socketEvents
    .takeUntil(
      processEvents
        .ignoreElements()
        // Despite the docs, takeUntil doesn't respond to completion.
        .concat(Observable.of(null)),
    )
    .share();
  let mergedEvents = Observable.merge(
    finiteSocketEvents,
    // Take all process output until the first socket message.
    // There's a slight risk of output duplication if the socket message is late,
    // but this is pretty rare.
    processEvents.takeUntil(finiteSocketEvents).takeWhile(isRegularLogMessage),
    // Error/info logs from the process represent exit/error conditions, so always take them.
    // We ensure that error/info logs will not duplicate messages from the websocket.
    processEvents.skipWhile(isRegularLogMessage),
  );
  if (subcommand === 'test' || subcommand === 'run') {
    // The websocket does not reliably provide test output.
    // After the build finishes, fall back to the Buck output stream.
    mergedEvents = Observable.concat(
      mergedEvents.takeUntil(finiteSocketEvents.filter(isBuildFinishEvent)),
      // Return to indeterminate progress.
      Observable.of({type: 'progress', progress: null}),
      processEvents,
    );
  } else if (subcommand === 'install') {
    // Add a message indicating that install has started after build completes.
    // The websocket does not naturally provide any indication.
    mergedEvents = Observable.merge(
      mergedEvents,
      finiteSocketEvents.filter(isBuildFinishEvent).switchMapTo(
        Observable.of(
          {
            type: 'progress',
            progress: null,
          },
          {
            type: 'log',
            message: 'Installing...',
            level: 'info',
          },
        ),
      ),
    );
  }
  return mergedEvents;
}

export function getDiagnosticEvents(
  events: Observable<BuckEvent>,
  buckRoot: string,
): Observable<BuckEvent> {
  const diagnosticsParser = new DiagnosticsParser();
  return events.flatMap(event => {
    // For log messages, try to detect compile errors and emit diagnostics.
    if (event.type === 'log') {
      return Observable.fromPromise(
        diagnosticsParser.getDiagnostics(event.message, event.level, buckRoot),
      ).map(diagnostics => ({type: 'diagnostics', diagnostics}));
    }
    return Observable.empty();
  });
}
