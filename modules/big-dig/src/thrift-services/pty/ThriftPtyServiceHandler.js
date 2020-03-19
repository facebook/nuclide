/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */
import type {ITerminal} from 'nuclide-prebuilt-libs/pty';
import type {SpawnArguments} from './types';

import {getOriginalEnvironment} from 'nuclide-commons/process';
import fsPromise from 'nuclide-commons/fsPromise';
// $FlowIgnore
import pty_types from './gen-nodejs/pty_types';
import {getLogger} from 'log4js';
import * as nodePty from 'nuclide-prebuilt-libs/pty';
import invariant from 'assert';

const logger = getLogger('thrift-pty-server-handler');
const KB = 1000;
const MB = KB * KB;
// Unix pty's often use 4096. Other OS's have different values. Use 20kb to be safe.
const MAX_PTY_OS_OUTPUT_CHUNK_BYTES = 20 * KB;
const PTY_PAUSE_THRESHOLD_BYTES = 4 * MB;
const BUFFER_LENGTH_BYTES =
  PTY_PAUSE_THRESHOLD_BYTES + MAX_PTY_OS_OUTPUT_CHUNK_BYTES;
const MAX_POLL_RESPONSE_SIZE_BYTES = 0.5 * MB;
const PTY_RESUME_THRESHOLD_BYTES = 0;
const LONG_POLL_TIMEOUT_MESSAGE = 'long_poll_timed_out';
const DEFAULT_ENCODING = 'utf-8';

// ensure the last chunk of data can be stored in buffer before pausing pty
invariant(
  PTY_PAUSE_THRESHOLD_BYTES + MAX_PTY_OS_OUTPUT_CHUNK_BYTES <=
    BUFFER_LENGTH_BYTES,
);

async function patchCurrentEnvironment(envPatches: {
  [string]: string,
}): Promise<{[string]: string}> {
  const currentEnv = {...(await getOriginalEnvironment())};
  const filteredVariables = ['NODE_ENV', 'NODE_PATH'];
  for (const x of filteredVariables) {
    delete currentEnv[x];
  }
  return {
    ...currentEnv,
    ...envPatches,
  };
}

type PtyRunningMeta = {
  status: 'running',
  pty: ITerminal,
  isPtyPaused: boolean,
  bufferCursor: number,
  encoding: string,
  buffer: Buffer,
  droppedBytes: number,
  resolveLongPoll: ?(string) => void,
  longPollTimeoutId: ?TimeoutID,
};

type PtyExitedMeta = {
  status: 'exited',
  signal: number,
  code: number,
};

type PtyMeta = PtyRunningMeta | PtyExitedMeta;

/**
 * These are the actual functions called by the Thrift server/service. The
 * auto-generated Thrift service handles the passing of data from the transport
 * to the function and back. But the functions aren't defined in Thrift --
 * they're defined here in a service Handler.
 */
export class ThriftPtyServiceHandler {
  _ptys: Map<number, PtyMeta>;

  constructor() {
    this._ptys = new Map();
  }

  dispose(): void {
    this._ptys.forEach((meta, id) => {
      this.disposeId(id);
    });
  }

  disposeId(id: number): void {
    const meta = this._requireMeta(id);
    if (meta.status === 'running') {
      const pid = meta.pty.pid;
      meta.pty.destroy();
      logger.info('disposed of pty with pid', pid, 'id', id);
    }
  }

  async poll(id: number, timeoutSec: number): Promise<pty_types.PollEvent> {
    const meta = this._requireMeta(id);

    if (meta.status === 'exited') {
      const pollEvent = new pty_types.PollEvent();
      pollEvent.eventType = pty_types.PollEventType.NO_PTY;
      pollEvent.chunk = null;
      pollEvent.exitCode = meta.code;
      pollEvent.exitSignal = meta.signal;
      return pollEvent;
    }

    if (meta.bufferCursor) {
      const pollEvent = new pty_types.PollEvent();
      pollEvent.eventType = pty_types.PollEventType.NEW_OUTPUT;
      pollEvent.chunk = this._drainOutputFromBuffer(id);
      return pollEvent;
    }

    try {
      const chunk = await this._waitForNewOutput(meta, timeoutSec);
      const pollEvent = new pty_types.PollEvent();
      pollEvent.eventType = pty_types.PollEventType.NEW_OUTPUT;
      pollEvent.chunk = Buffer.from(chunk);
      return pollEvent;
    } catch (e) {
      if (e === LONG_POLL_TIMEOUT_MESSAGE) {
        const pollEvent = new pty_types.PollEvent();
        pollEvent.eventType = pty_types.PollEventType.TIMEOUT;
        pollEvent.chunk = null;
        return pollEvent;
      } else {
        throw e;
      }
    }
  }

  resize(id: number, columns: number, rows: number): void {
    const pty = this._requireRunningMeta(id).pty;
    pty.resize(columns, rows);
  }

  setEncoding(id: number, encoding: string): void {
    const meta = this._requireRunningMeta(id);
    meta.encoding = encoding;
    meta.pty.setEncoding(encoding);
  }

  async spawn(spawnArguments: SpawnArguments): Promise<number> {
    const defaultSpawnCommand = '/bin/bash';
    if (!fsPromise.exists(spawnArguments.command)) {
      logger.warn(
        `command ${
          spawnArguments.command
        } does not exist. Using ${defaultSpawnCommand} instead`,
      );
      spawnArguments.command = defaultSpawnCommand;
    }

    const id = this._ptys.size;

    logger.info('creating new pty id ', id, 'with these arguments');
    logger.info(spawnArguments);

    const pty = nodePty.spawn(
      spawnArguments.command,
      spawnArguments.commandArgs,
      {
        name: spawnArguments.name,
        cwd: spawnArguments.cwd,
        env: await patchCurrentEnvironment(spawnArguments.envPatches),
        cols: spawnArguments.cols,
        rows: spawnArguments.rows,
      },
    );

    const meta = {
      pty,
      buffer: Buffer.alloc(BUFFER_LENGTH_BYTES),
      bufferCursor: 0,
      encoding: DEFAULT_ENCODING,
      droppedBytes: 0,
      isPtyPaused: false,
      resolveLongPoll: null,
      longPollTimeoutId: null,
      status: 'running',
    };
    this._ptys.set(id, meta);
    this._addListeners(id, meta);
    logger.info('Spawned pty with pid', pty.pid, 'id', id);
    return id;
  }

  writeInput(id: number, data: string): void {
    const pty = this._requireRunningMeta(id).pty;
    pty.write(data);
  }

  // client api entrypoints above this point
  // private methods below this point

  _addListeners(id: number, meta: PtyRunningMeta): void {
    const dataCallback = (chunk: string) => {
      if (meta.bufferCursor === 0 && meta.resolveLongPoll) {
        meta.resolveLongPoll(chunk);
        if (meta.longPollTimeoutId != null) {
          clearTimeout(meta.longPollTimeoutId);
        }
        meta.resolveLongPoll = null;
        return;
      }

      const lenNewData = Buffer.byteLength(chunk);
      const finalCursor = meta.bufferCursor + lenNewData;
      if (finalCursor > PTY_PAUSE_THRESHOLD_BYTES) {
        if (meta.pty) {
          meta.pty.pause();
          meta.isPtyPaused = true;
        }
      }
      if (meta.buffer != null) {
        meta.buffer.write(chunk, meta.bufferCursor);
        meta.bufferCursor += lenNewData;
      }
    };

    meta.pty.addListener('data', dataCallback);
    meta.pty.addListener('exit', (code, signal) => {
      logger.info('got exit code', code, 'signal', signal, 'for id', id);
      this._ptys.set(id, {status: 'exited', code, signal});
      this.disposeId(id);
    });
  }

  _drainOutputFromBuffer(id: number): Buffer {
    const meta = this._requireRunningMeta(id);
    const buffer = meta.buffer;
    const exceedsMaxPayload = meta.bufferCursor > MAX_POLL_RESPONSE_SIZE_BYTES;
    let chunk;
    if (exceedsMaxPayload) {
      // return first n bytes of buffer
      chunk = buffer.slice(0, MAX_POLL_RESPONSE_SIZE_BYTES);
      // move buffer data to the left
      buffer.copy(
        buffer,
        0, // dest start
        MAX_POLL_RESPONSE_SIZE_BYTES, // src start
        meta.bufferCursor, // src end
      );
      // move cursor back by the amount we stripped off the front
      meta.bufferCursor -= MAX_POLL_RESPONSE_SIZE_BYTES;
    } else {
      // send the whole buffer
      chunk = buffer.slice(0, meta.bufferCursor);
      meta.bufferCursor = 0;
    }
    if (meta.isPtyPaused && meta.bufferCursor <= PTY_RESUME_THRESHOLD_BYTES) {
      meta.pty.resume();
      meta.isPtyPaused = false;
    }
    return chunk;
  }

  _requireMeta(ptyId: number): PtyMeta {
    const meta = this._ptys.get(ptyId);
    if (meta == null) {
      throw new pty_types.Error({message: 'no pty metadata for id ' + ptyId});
    }
    return meta;
  }

  _requireRunningMeta(ptyId: number): PtyRunningMeta {
    const meta = this._requireMeta(ptyId);
    if (meta.status === 'running') {
      return meta;
    } else {
      throw new pty_types.Error({
        message: `pty with id ${ptyId} is not running`,
      });
    }
  }

  async _waitForNewOutput(
    meta: PtyRunningMeta,
    timeoutSec: number,
  ): Promise<string> {
    const SEC_TO_MSEC = 1000;
    return new Promise((resolveLongPoll, rejectLongPoll) => {
      // attach resolve function to this pty's metadata so it can immediately
      // resolve if new data arrives
      if (meta.resolveLongPoll) {
        throw new Error('Multiple clients cannot poll the same pty');
      }
      meta.resolveLongPoll = resolveLongPoll;

      meta.longPollTimeoutId = setTimeout(() => {
        meta.resolveLongPoll = null;
        rejectLongPoll(LONG_POLL_TIMEOUT_MESSAGE);
      }, timeoutSec * SEC_TO_MSEC);
    });
  }
}
