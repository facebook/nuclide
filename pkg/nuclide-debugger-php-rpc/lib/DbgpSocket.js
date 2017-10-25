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

import dedent from 'dedent';
import logger from './utils';
import {
  base64Decode,
  base64Encode,
  isContinuationCommand,
  isEvaluationCommand,
} from './helpers';
import EventEmitter from 'events';
import {DbgpMessageHandler} from './DbgpMessageHandler';
import {attachEvent} from 'nuclide-commons/event';
import invariant from 'assert';
import type {Socket} from 'net';

export const ConnectionStatus = {
  // Responses to the DBGP 'status' command
  Starting: 'starting',
  Stopping: 'stopping',
  Stopped: 'stopped',
  Running: 'running',
  Break: 'break',
  // Error and End are not dbgp status codes, they relate to socket states.
  Error: 'error',
  End: 'end',
  // stdout and stderr are emitted when DBGP sends the corresponding message packets.
  Stdout: 'stdout',
  Stderr: 'stderr',
  // Break message statuses allow us to identify whether a connection stopped because of a break
  // message or a breakpoint
  BreakMessageReceived: 'status_break_message_received',
  BreakMessageSent: 'status_break_message_sent',
  // Indicates if the dummy connection should be shown in the UI.
  DummyIsViewable: 'dummy is viewable',
  DummyIsHidden: 'dummy is hidden',
};

// Notifications.
export const BREAKPOINT_RESOLVED_NOTIFICATION = 'breakpoint_resolved';

// Valid continuation commands
export const COMMAND_RUN = 'run';
export const COMMAND_STEP_INTO = 'step_into';
export const COMMAND_STEP_OVER = 'step_over';
export const COMMAND_STEP_OUT = 'step_out';
export const COMMAND_STOP = 'stop';
export const COMMAND_DETACH = 'detach';

const DBGP_SOCKET_STATUS_EVENT = 'dbgp-socket-status';
const DBGP_SOCKET_NOTIFICATION_EVENT = 'dbgp-socket-notification';

const STREAM_MESSAGE_MAX_SIZE = 1024;

export type DbgpContext = {
  name: string,
  id: string,
};

export type DbgpProperty = {
  $: {
    name?: string, // name and fullname are omitted when we get data back from the `eval` command.
    fullname?: string,
    address?: string,
    type: string,

    // array or object
    classname?: string,
    children?: boolean,
    numchildren?: number,
    page?: number,
    pagesize?: number,
    recursive?: number,

    // string
    size?: number,
    encoding?: string,
  },

  // Value if present, subject to encoding if present
  _?: string,

  // array or object members
  property?: Array<DbgpProperty>,
};

export type FileLineBreakpointInfo = {
  filename: string,
  lineNumber: number,
  conditionExpression: ?string,
};

export type DbgpBreakpoint = {
  id: string,
  type: string,
  state: string,
  resolved?: string,
  hit_condition?: string,
  hit_count?: number,
  filename?: string,
  lineno?: number,
};

type EvaluationResult = {
  error?: Object,
  result?: ?DbgpProperty,
  wasThrown: boolean,
};

type Call = {
  command: string,
  complete: (results: Object) => void,
};

const DEFAULT_DBGP_PROPERTY: DbgpProperty = {
  $: {
    type: 'undefined',
  },
};

/**
 * Handles sending and recieving dbgp messages over a net Socket.
 * Dbgp documentation can be found at http://xdebug.org/docs-dbgp.php
 */
export class DbgpSocket {
  _socket: ?Socket;
  _transactionId: number;
  // Maps from transactionId -> call
  _calls: Map<number, Call>;
  _emitter: EventEmitter;
  _isClosed: boolean;
  _messageHandler: DbgpMessageHandler;
  _pendingEvalTransactionIds: Set<number>;
  _lastContinuationCommandTransactionId: ?number;

  constructor(socket: Socket) {
    this._socket = socket;
    this._transactionId = 0;
    this._calls = new Map();
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(100);
    this._isClosed = false;
    this._messageHandler = new DbgpMessageHandler();
    this._pendingEvalTransactionIds = new Set();
    this._lastContinuationCommandTransactionId = null;

    socket.on('end', this._onEnd.bind(this));
    socket.on('error', this._onError.bind(this));
    socket.on('data', this._onData.bind(this));
  }

  onStatus(callback: (status: string) => mixed): IDisposable {
    return attachEvent(this._emitter, DBGP_SOCKET_STATUS_EVENT, callback);
  }

  onNotification(
    callback: (notifyName: string, notify: Object) => mixed,
  ): IDisposable {
    return attachEvent(this._emitter, DBGP_SOCKET_NOTIFICATION_EVENT, callback);
  }

  _onError(error: {code: string}): void {
    // Not sure if hhvm is alive or not
    // do not set _isClosed flag so that detach will be sent before dispose().
    logger.error('socket error ' + error.code);
    this._emitStatus(ConnectionStatus.Error, error.code);
  }

  _onEnd(): void {
    this._isClosed = true;
    this.dispose();
    this._emitStatus(ConnectionStatus.End);
  }

  _onData(data: Buffer | string): void {
    const message = data.toString();
    logger.debug('Received data: ' + message);
    let responses = [];
    try {
      responses = this._messageHandler.parseMessages(message);
    } catch (e) {
      // If message parsing fails, then our contract with HHVM is violated and we need to kill the
      // connection.
      this._emitStatus(ConnectionStatus.Error, e.message);
      return;
    }
    responses.forEach(r => {
      const {response, stream, notify} = r;
      if (response) {
        this._handleResponse(response, message);
      } else if (stream != null) {
        this._handleStream(stream);
      } else if (notify != null) {
        this._handleNotification(notify);
      } else {
        logger.error('Unexpected socket message: ' + message);
      }
    });
  }

  _handleResponse(response: Object, message: string): void {
    const responseAttributes = response.$;
    const {command, transaction_id, status} = responseAttributes;
    const transactionId = Number(transaction_id);
    const call = this._calls.get(transactionId);
    if (!call) {
      logger.error('Missing call for response: ' + message);
      return;
    }
    // We handle evaluation commands specially since they can trigger breakpoints.
    if (isEvaluationCommand(command)) {
      if (status === ConnectionStatus.Break) {
        // The eval command's response with a `break` status is special because the backend will
        // send two responses for one xdebug eval request.  One when we hit a breakpoint in the
        // code being eval'd, and another when we finish executing the code being eval'd.
        // In this case, we are processing the first response for our eval request.  We will
        // record this response ID on our stack, so we can later identify the second response.
        // Then send a user-friendly message to the console, and trigger a UI update by moving to
        // running status briefly, and then back to break status.
        this._emitStatus(ConnectionStatus.DummyIsViewable);
        this._emitStatus(
          ConnectionStatus.Stdout,
          'Hit breakpoint in evaluated code.',
        );
        this._emitStatus(ConnectionStatus.Running);
        this._emitStatus(ConnectionStatus.Break);
        return; // Return early so that we don't complete any request.
      }
      this._handleEvaluationCommand(transactionId, message);
    }

    // If this is a break notification, check to see if its a file-line breakpoint, and if so,
    // confirm the bp is still installed. Since different requests are totally asynchronous to
    // the debugger (they're actually served by different processes), it's possible for a request
    // to hit a breakpoint after the frontend has removed it. When this happens, we should silently
    // just resume the connection rather than breaking at a stale breakpoint.
    if (status === ConnectionStatus.Break) {
      const xdebugMessages = response['xdebug:message'];
      if (xdebugMessages != null && xdebugMessages.length >= 1) {
        const breakDetails = xdebugMessages[0].$;
        this._emitStatus(
          ConnectionStatus.Break,
          breakDetails.filename,
          breakDetails.lineno,
          breakDetails.exception,
        );
      }
    }

    this._completeRequest(message, response, call, command, transactionId);
  }

  _handleEvaluationCommand(transactionId: number, message: string): void {
    invariant(this._pendingEvalTransactionIds.size > 0, 'No pending Eval Ids');
    invariant(
      this._pendingEvalTransactionIds.has(transactionId),
      'Got evaluation response for a request that was never sent.',
    );
    this._pendingEvalTransactionIds.delete(transactionId);
    const continuationId = this._lastContinuationCommandTransactionId;
    if (continuationId == null) {
      return;
    }
    // In this case, we are processing the second response to our eval request.  So we can
    // complete the current continuation command promise, and then complete the original
    // eval command promise.
    if (this._pendingEvalTransactionIds.size === 0) {
      // This is the last eval command before returning to the dummy connection entry-point, so
      // we will signal to the CM that the dummy connection is now un-viewable.
      this._emitStatus(ConnectionStatus.DummyIsHidden);
    }
    const continuationCommandCall = this._calls.get(continuationId);
    invariant(
      continuationCommandCall != null,
      'no pending continuation command request',
    );
    this._completeRequest(
      message,
      {$: {status: ConnectionStatus.Break}},
      continuationCommandCall,
      continuationCommandCall.command,
      continuationId,
    );
  }

  _handleStream(stream: Object): void {
    const outputType = stream.$.type;
    // The body of the `stream` XML can be omitted, e.g. `echo null`, so we defend against this.
    const outputText = stream._ != null ? base64Decode(stream._) : '';
    logger.debug(`${outputType} message received: ${outputText}`);
    const status =
      outputType === 'stdout'
        ? ConnectionStatus.Stdout
        : ConnectionStatus.Stderr;
    // TODO: t13439903 -- add a way to fetch the rest of the data.
    const truncatedOutputText = outputText.slice(0, STREAM_MESSAGE_MAX_SIZE);
    this._emitStatus(status, truncatedOutputText);
  }

  _handleNotification(notify: Object): void {
    const notifyName = notify.$.name;
    if (notifyName === 'breakpoint_resolved') {
      const breakpoint = notify.breakpoint[0].$;
      if (breakpoint == null) {
        logger.error(
          `Fail to get breakpoint from 'breakpoint_resolved' notify: ${JSON.stringify(
            notify,
          )}`,
        );
        return;
      }
      this._emitNotification(BREAKPOINT_RESOLVED_NOTIFICATION, breakpoint);
    } else {
      logger.error(`Unknown notify: ${JSON.stringify(notify)}`);
    }
  }

  _completeRequest(
    message: string,
    response: Object,
    call: Call,
    command: string,
    transactionId: number,
  ): void {
    this._calls.delete(transactionId);
    if (call.command !== command) {
      logger.error(
        'Bad command in response. Found ' +
          command +
          '. expected ' +
          call.command,
      );
      return;
    }
    try {
      logger.debug('Completing call: ' + message);
      call.complete(response);
    } catch (e) {
      logger.error('Exception: ' + e.toString() + ' handling call: ' + message);
    }
  }

  getStackFrames(): Promise<Object> {
    return this._callDebugger('stack_get');
  }

  async getContextsForFrame(frameIndex: number): Promise<Array<DbgpContext>> {
    const result = await this._callDebugger(
      'context_names',
      `-d ${frameIndex}`,
    );
    return result.context.map(context => context.$);
  }

  async getContextProperties(
    frameIndex: number,
    contextId: string,
  ): Promise<Array<DbgpProperty>> {
    const result = await this._callDebugger(
      'context_get',
      `-d ${frameIndex} -c ${contextId}`,
    );
    // 0 results yields missing 'property' member
    return result.property || [];
  }

  async getPropertiesByFullname(
    frameIndex: number,
    contextId: string,
    fullname: string,
    page: number,
  ): Promise<Array<DbgpProperty>> {
    // Escape any double quote in the expression.
    const escapedFullname = fullname.replace(/"/g, '\\"');
    const result = await this._callDebugger(
      'property_value',
      `-d ${frameIndex} -c ${contextId} -n "${escapedFullname}" -p ${page}`,
    );
    // property_value returns the outer property, we want the children ...
    // 0 results yields missing 'property' member
    if (result.property == null || result.property[0] == null) {
      return [];
    }
    return result.property[0].property || [];
  }

  async getPropertiesByFullnameAllConexts(
    frameIndex: number,
    fullname: string,
    page: number,
  ): Promise<Array<DbgpProperty>> {
    // Pass zero as contextId to search all contexts.
    return this.getPropertiesByFullname(
      frameIndex,
      /* contextId */ '0',
      fullname,
      page,
    );
  }

  async evaluateOnCallFrame(
    frameIndex: number,
    expression: string,
  ): Promise<EvaluationResult> {
    // Escape any double quote in the expression.
    const escapedExpression = expression.replace(/"/g, '\\"');
    // Quote the input expression so that we can support expression with
    // space in it(e.g. function evaluation).
    const result = await this._callDebugger(
      'property_value',
      `-d ${frameIndex} -n "${escapedExpression}"`,
    );
    if (result.error && result.error.length > 0) {
      return {
        error: result.error[0],
        wasThrown: true,
      };
    } else if (result.property != null) {
      return {
        result: result.property[0],
        wasThrown: false,
      };
    } else {
      logger.debug(
        `Received non-error evaluateOnCallFrame response with no properties: ${expression}`,
      );
      return {
        result: DEFAULT_DBGP_PROPERTY,
        wasThrown: false,
      };
    }
  }

  // Returns one of:
  //  starting, stopping, stopped, running, break
  async getStatus(): Promise<string> {
    const response = await this._callDebugger('status');
    // TODO: Do we ever care about response.$.reason?
    return response.$.status;
  }

  // Continuation commands get a response, but that response
  // is a status message which occurs after execution stops.
  async sendContinuationCommand(command: string): Promise<string> {
    this._emitStatus(ConnectionStatus.Running);
    const response = await this._callDebugger(command);
    const status = response.$.status;
    this._emitStatus(status);
    return status;
  }

  async sendBreakCommand(): Promise<boolean> {
    const response = await this._callDebugger('break');
    if (response.$.success !== '0') {
      this._emitStatus(ConnectionStatus.BreakMessageReceived);
    }
    return response.$.success !== '0';
  }

  async sendStdoutRequest(): Promise<boolean> {
    // `-c 1` tells HHVM to send stdout to the normal destination, as well as forward it to nuclide.
    const response = await this._callDebugger('stdout', '-c 1');
    return response.$.success !== '0';
  }

  /**
   * Stderr forwarding is not implemented by HHVM yet so this will always return failure.
   */
  async sendStderrRequest(): Promise<boolean> {
    const response = await this._callDebugger('stderr', '-c 1');
    return response.$.success !== '0';
  }

  /**
   * Sets a given config setting in the debugger to a given value.
   */
  async setFeature(name: string, value: string): Promise<boolean> {
    const response = await this._callDebugger(
      'feature_set',
      `-n ${name} -v ${value}`,
    );
    return response.$.success !== '0';
  }

  /**
   * Evaluate the expression in the debugger's current context.
   */
  async runtimeEvaluate(expr: string): Promise<EvaluationResult> {
    const response = await this._callDebugger(
      'eval',
      `-- ${base64Encode(expr)}`,
    );
    if (response.error && response.error.length > 0) {
      return {
        error: response.error[0],
        wasThrown: true,
      };
    } else if (response.property != null) {
      return {
        result: response.property[0],
        wasThrown: false,
      };
    } else {
      logger.debug(
        `Received non-error runtimeEvaluate response with no properties: ${expr}`,
      );
    }
    return {
      result: DEFAULT_DBGP_PROPERTY,
      wasThrown: false,
    };
  }

  /**
   * Returns the exception breakpoint id.
   */
  async setExceptionBreakpoint(exceptionName: string): Promise<string> {
    const response = await this._callDebugger(
      'breakpoint_set',
      `-t exception -x ${exceptionName}`,
    );
    if (response.error) {
      throw new Error(
        'Error from setPausedOnExceptions: ' + JSON.stringify(response),
      );
    }
    // TODO: Validate that response.$.state === 'enabled'
    return response.$.id;
  }

  /**
   * Set breakpoint on a source file line.
   * Returns a xdebug breakpoint id.
   */
  async setFileLineBreakpoint(
    breakpointInfo: FileLineBreakpointInfo,
  ): Promise<string> {
    const {filename, lineNumber, conditionExpression} = breakpointInfo;
    let params = `-t line -f ${filename} -n ${lineNumber}`;
    if (conditionExpression != null) {
      params += ` -- ${base64Encode(conditionExpression)}`;
    }
    const response = await this._callDebugger('breakpoint_set', params);
    if (response.error) {
      throw new Error(
        dedent`
        Error setting breakpoint for command: breakpoint_set ${params}
        Got response: ${JSON.stringify(response)}
        BreakpointInfo is: ${JSON.stringify(breakpointInfo)}
      `,
      );
    }
    // TODO: Validate that response.$.state === 'enabled'
    return response.$.id;
  }

  /**
   * Returns requested breakpoint object.
   */
  async getBreakpoint(breakpointId: string): Promise<DbgpBreakpoint> {
    const response = await this._callDebugger(
      'breakpoint_get',
      `-d ${breakpointId}`,
    );
    if (
      response.error != null ||
      response.breakpoint == null ||
      response.breakpoint[0] == null ||
      response.breakpoint[0].$ == null
    ) {
      throw new Error('Error getting breakpoint: ' + JSON.stringify(response));
    }
    return response.breakpoint[0].$;
  }

  async removeBreakpoint(breakpointId: string): Promise<any> {
    const response = await this._callDebugger(
      'breakpoint_remove',
      `-d ${breakpointId}`,
    );
    if (response.error) {
      throw new Error('Error removing breakpoint: ' + JSON.stringify(response));
    }
  }

  // Sends command to hhvm.
  // Returns an object containing the resulting attributes.
  _callDebugger(command: string, params: ?string): Promise<Object> {
    const transactionId = this._sendCommand(command, params);
    if (isEvaluationCommand(command)) {
      this._pendingEvalTransactionIds.add(transactionId);
    }
    const isContinuation = isContinuationCommand(command);
    if (isContinuation) {
      // Continuation commands can sometimes only be completed by an evaluation response.
      this._lastContinuationCommandTransactionId = transactionId;
    }
    return new Promise((resolve, reject) => {
      this._calls.set(transactionId, {
        command,
        complete: result => {
          if (isContinuation) {
            this._lastContinuationCommandTransactionId = null;
          }
          resolve(result);
        },
      });
    });
  }

  _sendCommand(command: string, params: ?string): number {
    const id = ++this._transactionId;
    let message = `${command} -i ${id}`;
    // flowlint-next-line sketchy-null-string:off
    if (params) {
      message += ' ' + params;
    }
    this._sendMessage(message);
    return id;
  }

  _sendMessage(message: string): void {
    const socket = this._socket;
    if (socket != null) {
      logger.debug('Sending message: ' + message);
      socket.write(message + '\x00');
    } else {
      logger.error('Attempt to send message after dispose: ' + message);
    }
  }

  _emitStatus(status: string, ...args: Array<string>): void {
    logger.debug('Emitting status: ' + status);
    this._emitter.emit(DBGP_SOCKET_STATUS_EVENT, status, ...args);
  }

  _emitNotification(notifyName: string, notify: Object): void {
    logger.debug(`Emitting notification: ${notifyName}`);
    this._emitter.emit(DBGP_SOCKET_NOTIFICATION_EVENT, notifyName, notify);
  }

  dispose(): void {
    if (!this._isClosed) {
      // TODO[jeffreytan]: workaround a crash(t8181538) in hhvm
      this.sendContinuationCommand(COMMAND_DETACH);
    }

    const socket = this._socket;
    if (socket) {
      // end - Sends the FIN packet and closes writing.
      // destroy - closes for reading and writing.
      socket.end();
      socket.destroy();
      this._socket = null;
      this._isClosed = true;
    }
  }
}
