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
  Breakpoint,
  StackFrame,
  SourceBreakpoint,
} from 'vscode-debugprotocol';
import type {OCamlDebugStartInfo} from './OCamlDebugger';
import invariant from 'assert';
import {OCamlDebugProxy} from './OCamlDebugProxy';
import NuclideUri from 'nuclide-commons/nuclideUri';
import url from 'url';
import {logger} from 'vscode-debugadapter';

function uriToModuleName(uri: string) {
  const pathname = uri.startsWith('file://') ? url.parse(uri).pathname : uri;
  invariant(pathname != null && pathname !== '');
  const fileName = NuclideUri.basename(pathname).replace(/\.[^.]+$/, '');
  return fileName.charAt(0).toUpperCase() + fileName.substr(1);
}

function extractList<T>(
  text: string,
  prefix: string,
  keepLines: boolean,
  empty: T,
  f: (s: string[]) => T,
): T {
  const i = text.indexOf(prefix);
  if (i < 0) {
    return empty;
  }
  const t = text.substr(i + prefix.length);
  const parts = keepLines
    ? t.split(/\r?\n/g)
    : t.replace(/[\s\r\n]+/g, ' ').split(' ');
  const list = parts.map(s => s.trim()).filter(s => s.length > 0);
  return f(list);
}

class Lock {
  _inner: Promise<number>;
  _expected: number;

  constructor() {
    this._inner = Promise.resolve(0);
    this._expected = 0;
  }

  async enter(): Promise<{exitLock(): void}> {
    const curCount = await this._inner;
    if (curCount !== this._expected) {
      // Sometimes we get multiple Promises waiting on the same _inner, so if we
      // detect that we're stale start waiting again.
      return this.enter();
    }

    let e: () => void;
    this._inner = new Promise(resolve => {
      this._expected++;
      e = () => resolve(this._expected);
    });
    return {exitLock: () => e()};
  }
}

export class Session {
  _debugProxy: OCamlDebugProxy;
  _modules: Set<string>;
  _shortNamesToPaths: Map<string, string>;
  _breakpoints: Map<string, Array<Breakpoint>>;
  _lock: Lock;
  _disposeOnBreakListener: ?() => void;

  _onBreakpointHit: (breakpointId: string) => Promise<void>;
  _onProgramExit: (errorText: ?string) => Promise<void>;

  _paused: boolean;

  constructor(
    debugProxy: OCamlDebugProxy,
    modules: Set<string>,
    onBreakpointHit: (breakpointId: string) => Promise<void>,
    onProgramExit: (errorText: ?string) => Promise<void>,
  ) {
    this._debugProxy = debugProxy;
    this._modules = modules;
    this._onProgramExit = onProgramExit;
    this._onBreakpointHit = onBreakpointHit;

    this._shortNamesToPaths = new Map();
    this._breakpoints = new Map();
    this._paused = true;
    this._lock = new Lock();
  }

  async getStack(): Promise<StackFrame[]> {
    const output = await this._send('backtrace');
    return extractList(output, 'Backtrace:', true, [], lines => {
      const frames = [];
      for (const line of lines) {
        const m = /#(\d+) ([^\s]+) ([^:]+):(\d+):(\d+)/.exec(line);
        if (m) {
          // We generally have a result for _shortNamesToPaths when running
          // locally, and generally don't when running remotely.
          const path = this._shortNamesToPaths.get(m[3]) || m[3];
          frames.push({
            id: Number(m[1]),
            name: m[2],
            moduleId: m[2],
            line: Number(m[4]),
            column: Number(m[5]),
            source: {
              path,
            },
          });
        }
      }
      return frames;
    });
  }

  stepOver(): Promise<void> {
    return this._step('next');
  }

  async stepOut(): Promise<void> {
    return this._step('finish');
  }

  stepInto(): Promise<void> {
    return this._step('step 1');
  }

  async evaluate(frameId: ?number, expr: string): Promise<string> {
    return this._runWithLock(async () => {
      if (frameId != null) {
        await this._send(`frame ${frameId}`);
      }

      const result = await this._send(`print (${expr})`);
      const i = result.indexOf(':');
      return i >= 0 ? result.substr(i + 1).trim() : result;
    });
  }

  async _step(command: string): Promise<void> {
    await this._send(command);
  }

  async setBreakpointsByUri(
    breakpoints: SourceBreakpoint[],
    uri: ?string,
    shortname: ?string,
  ): Promise<Breakpoint[]> {
    const mapFailedBreakpoint = bp => {
      return {
        line: bp.line,
        column: bp.column || 0,
        verified: false,
      };
    };

    // The count of returned breakpoints must always equal the count of
    // requested breakpoints, so instead of returning an empty list if something
    // goes wrong we just have to return a bunch of unverified breakpoints.
    if (uri == null || shortname == null) {
      logger.error(
        `Could not set breakpoint: ${JSON.stringify({uri, shortname})}.`,
      );
      return breakpoints.map(mapFailedBreakpoint);
    }

    const moduleName = uriToModuleName(uri);
    if (!this._modules.has(moduleName)) {
      logger.error(
        `Could not set breakpoint: ${moduleName} is not part of the executable.`,
      );
      return breakpoints.map(mapFailedBreakpoint);
    }

    const existingBreakpoints = this._breakpoints.get(uri);
    if (existingBreakpoints) {
      await Promise.all(
        existingBreakpoints.map(this.deleteBreakpoint.bind(this)),
      );
    }

    this._shortNamesToPaths.set(shortname, uri);
    const breakpointsPromise = breakpoints.map(async bp =>
      this._pauseAndLock(async () => {
        const result = await this._send(`break @${moduleName} ${bp.line}`);
        logger.verbose(result);
        const m = /^Breakpoint (\d+) at \d+: file (.+), line (\d+), characters (\d+)-(\d+)$/m.exec(
          result,
        );
        if (m) {
          return {
            id: Number(m[1]),
            line: Number(m[3]),
            column: Number(m[4]),
            verified: true,
          };
        }

        return mapFailedBreakpoint(bp);
      }),
    );

    const breakpointsToReturn = await Promise.all(breakpointsPromise);
    this._breakpoints.set(uri, breakpointsToReturn);

    return breakpointsToReturn;
  }

  deleteBreakpoint(breakpoint: Breakpoint): Promise<void> {
    const breakpointId = breakpoint.id;
    if (breakpointId != null) {
      return this._pauseAndLock(async () => {
        await this._send(`delete ${breakpointId}`);
      });
    }

    return Promise.resolve();
  }

  async pause(): Promise<boolean> {
    if (this._paused) {
      return true;
    }
    if (this._disposeOnBreakListener) {
      this._disposeOnBreakListener();
      this._disposeOnBreakListener = null;
    }
    await this._debugProxy.pause();
    this._paused = true;
    return false;
  }

  resume(): void {
    this._paused = false;
    this._disposeOnBreakListener = this._debugProxy.attachOnPromptListener(
      output => {
        const lines = output
          .replace(/\r?\n/g, '\n')
          .split('\n')
          .filter(l => l.length > 0)
          .reverse();
        const handleEvent = (breakpointId: ?string, error?: string) => {
          this._runWithLock(() => {
            this._paused = true;
            if (breakpointId != null) {
              return this._onBreakpointHit(breakpointId);
            } else {
              return this._onProgramExit(error);
            }
          });
        };
        for (const line of lines) {
          let m = /^Unhandled exception: (.+)$/.exec(line);
          if (m) {
            return handleEvent(undefined, m[1]);
          }
          if (line === 'Program end.') {
            return handleEvent(undefined, undefined);
          }
          m = /^Breakpoint: (\d+)/.exec(line);
          if (m) {
            return handleEvent(m[1], undefined);
          }
        }
      },
    );
    this._debugProxy.resume();
  }

  dispose(): void {
    if (this._debugProxy) {
      this._debugProxy.kill();
    }
  }

  async _runWithLock<T>(f: () => Promise<T>): Promise<T> {
    const {exitLock} = await this._lock.enter();
    try {
      return await f();
    } finally {
      exitLock();
    }
  }

  async _pauseAndLock<T>(f: () => Promise<T>): Promise<T> {
    return this._runWithLock(async () => {
      const wasPaused = await this.pause();
      try {
        return await f();
      } finally {
        if (!wasPaused) {
          this.resume();
        }
      }
    });
  }

  static async _startOcamlDebug(
    startInfo: OCamlDebugStartInfo,
    onProgramExit: (error: ?string) => Promise<void>,
  ): Promise<OCamlDebugProxy> {
    const debuggerArguments = [];
    for (const includeDir of startInfo.includeDirectories) {
      debuggerArguments.push('-I', includeDir);
    }

    if (startInfo.workingDirectory) {
      debuggerArguments.push('-cd', startInfo.workingDirectory);
    }

    // Path of the executable to debug is optional because there are some
    // scripts in fbcode that execute ocamldebug with the correct arguments and
    // executable path, and we want to support executing those directly.
    if (startInfo.executablePath.trim().length > 0) {
      const executablePath = startInfo.executablePath;
      debuggerArguments.push(executablePath);
    }

    const command =
      startInfo.ocamldebugExecutable !== ''
        ? startInfo.ocamldebugExecutable
        : 'ocamldebug';
    debuggerArguments.push(...startInfo.arguments);

    const ocamlDebug = new OCamlDebugProxy(
      command,
      debuggerArguments,
      result => {
        onProgramExit(result.kind === 'finished' ? null : result.message);
      },
    );

    await ocamlDebug.waitForPrompt();
    await ocamlDebug.send('goto 0');
    return ocamlDebug;
  }

  static async start(
    startInfo: OCamlDebugStartInfo,
    onBreakpointHit: (breakpointId: string) => Promise<void>,
    onProgramExit: (error: ?string) => Promise<void>,
  ): Promise<Session> {
    const ocamlDebug = await Session._startOcamlDebug(startInfo, onProgramExit);

    const modulesText = await ocamlDebug.send('info modules');
    logger.verbose(`MODULES ${modulesText}`);
    return new Session(
      ocamlDebug,
      Session._extractModules(modulesText),
      onBreakpointHit,
      onProgramExit,
    );
  }

  _send(command: string): Promise<string> {
    return this._debugProxy.send(command);
  }

  static _extractModules(modulesText: string): Set<string> {
    return extractList(modulesText, 'Used modules:', false, new Set(), l =>
      l.reduce((acc, v) => {
        acc.add(v);
        return acc;
      }, new Set()),
    );
  }
}
