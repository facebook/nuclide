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

import bigInt from 'big-integer';
import {dataDisassembleResult} from './MITypes';
import HandleMap from './HandleMap';
import MIProxy from './MIProxy';
import StackFrames from './StackFrames';

type SourceRef = {
  stackFrameHandle: number,
  startingPoint: ?string,
};

export default class Disassemble {
  _client: MIProxy;
  _stackFrames: StackFrames;
  _handleMap: HandleMap<SourceRef>;
  _sourceRefByStackFrameHandle: Map<number, number>;

  constructor(client: MIProxy, stackFrames: StackFrames) {
    this._client = client;
    this._stackFrames = stackFrames;
    this._handleMap = new HandleMap();
    this._sourceRefByStackFrameHandle = new Map();
  }

  sourceReferenceForStackFrame(stackFrameHandle: number): number {
    let handle = this._sourceRefByStackFrameHandle.get(stackFrameHandle);
    if (handle == null) {
      const sourceRef = {stackFrameHandle, startingPoint: undefined};
      handle = this._handleMap.put(sourceRef);
      this._sourceRefByStackFrameHandle.set(stackFrameHandle, handle);
    }

    return handle;
  }

  async getDisassembly(sourceRef: number): Promise<string> {
    const source = this._handleMap.getObjectByHandle(sourceRef);
    if (source == null) {
      throw new Error(`Invalid source reference ${sourceRef}`);
    }

    let startingAddress = source.startingPoint;
    if (startingAddress == null) {
      source.startingPoint = await this._getFrameAddress(
        source.stackFrameHandle,
      );
      startingAddress = source.startingPoint;
    }

    const hexPattern = /^0x([0-9a-fA-F]+)$/;
    const match = startingAddress.match(hexPattern);
    if (match == null) {
      throw new Error(
        `Failed to disassemble because value ${startingAddress} is not a valid hex address`,
      );
    }

    const start = bigInt(match[1], 16);

    // $TODO find a good balance between useful and performant. For now
    // just disassemble 4k worth of code, which is a fair bit but still comes
    // back quickly
    const end = start.add(4096);

    const command = `data-disassemble -s 0x${start.toString(
      16,
    )} -e 0x${end.toString(16)} -- 0`;

    const response = await this._client.sendCommand(command);
    if (!response.done) {
      throw new Error(`Failed to disassemble for source handle ${sourceRef}`);
    }

    const instructions = dataDisassembleResult(response);

    return instructions.asm_insns.map(_ => `${_.address} ${_.inst}`).join('\n');
  }

  async _getFrameAddress(stackFrameHandle: number): Promise<string> {
    const frameRef = this._stackFrames.stackFrameByHandle(stackFrameHandle);
    if (frameRef == null) {
      throw new Error(
        `Could not discover stack frame handle ${stackFrameHandle} for disassembly`,
      );
    }

    const frames = await this._stackFrames.stackFramesForThread(
      frameRef.threadId,
      frameRef.frameIndex,
      1,
    );

    const frame = frames.stackFrames[0];
    if (frame == null || frame.addr == null) {
      throw new Error(
        `Could not retrieve stack frame for handle ${stackFrameHandle} for disassembly`,
      );
    }

    return frame.addr;
  }
}
