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

import HandleMap from './HandleMap';
import MIProxy from './MIProxy';
import {StackFrame} from 'vscode-debugadapter';
import {
  stackInfoDepthResult,
  stackListFramesResult,
  toCommandError,
} from './MITypes';

export type CachedStackFrame = {
  threadId: number,
  frameIndex: number,
};

type StackTraceResponseBody = {
  stackFrames: Array<StackFrame>,
  totalFrames?: number,
};

export default class StackFrames {
  _client: MIProxy;
  _frames: HandleMap<CachedStackFrame>;
  _frameIdsByThreadAndLevel: Map<number, Map<number, number>>;

  constructor(client: MIProxy) {
    this._client = client;
    this._frames = new HandleMap();
    this._frameIdsByThreadAndLevel = new Map();
  }

  clearCachedFrames() {
    this._frames.clear();
    this._frameIdsByThreadAndLevel.clear();
  }

  stackFrameByHandle(handle: number): ?CachedStackFrame {
    return this._frames.getObjectByHandle(handle);
  }

  async stackFramesForThread(
    threadId: number,
    startFrame: ?number,
    levels: ?number,
  ): Promise<StackTraceResponseBody> {
    const depthResult = await this._client.sendCommand(
      `stack-info-depth --thread ${threadId}`,
    );
    if (!depthResult.done) {
      throw new Error(
        `Protocol error retrieving stack depth (${
          toCommandError(depthResult).msg
        })`,
      );
    }

    const depth = parseInt(stackInfoDepthResult(depthResult).depth, 10);
    const lowFrame = startFrame == null ? 0 : startFrame;

    if (lowFrame >= depth) {
      return {
        totalFrames: depth,
        stackFrames: [],
      };
    }

    const highFrame =
      (levels == null ? lowFrame + depth : lowFrame + levels) - 1;
    const command = `stack-list-frames --thread ${threadId} --no-frame-filters ${lowFrame} ${highFrame}`;
    const frameResult = await this._client.sendCommand(command);

    if (!frameResult.done) {
      throw new Error(
        `Protocol error retrieving stack frames (${
          toCommandError(frameResult).msg
        })`,
      );
    }

    const frames = stackListFramesResult(frameResult);

    return {
      totalFrames: depth,
      stackFrames: frames.stack.map(_ => {
        const level = parseInt(_.frame.level, 10);
        return {
          id: this._handleForFrame(threadId, level),
          name:
            _.frame.func != null
              ? _.frame.func
              : _.frame.from != null
                ? _.frame.from
                : _.frame.addr,
          source:
            _.frame.file == null && _.frame.fullname == null
              ? undefined
              : {
                  name: _.frame.file,
                  path: _.frame.fullname,
                },
          line: _.frame.line == null ? 0 : parseInt(_.frame.line, 10),
          column: 0,
          addr: _.frame.addr,
        };
      }),
    };
  }

  _handleForFrame(threadId: number, frameIndex: number): number {
    let mapForThread = this._frameIdsByThreadAndLevel.get(threadId);
    if (mapForThread == null) {
      mapForThread = new Map();
      this._frameIdsByThreadAndLevel.set(threadId, mapForThread);
    }

    let frame = mapForThread.get(frameIndex);
    if (frame == null) {
      const cachedFrame = {
        threadId,
        frameIndex,
      };
      frame = this._frames.put(cachedFrame);
      mapForThread.set(frameIndex, frame);
    }

    return frame;
  }
}
