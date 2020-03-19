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

import invariant from 'assert';
import url from 'url';
import {MemoryLogger} from '../../commons-node/memoryLogger';

const MAX_REQUEST_LENGTH = 1e6;

export const protocolLogger = new MemoryLogger(null);

type QueryParams = {[key: string]: any};
type SerializedArguments = {args: Array<string>, argTypes: Array<string>};

/**
 * Write a text or convert to text response with an optional status code.
 */
export function sendTextResponse(
  response: http$fixed$ServerResponse,
  text: any,
  statusCode: ?number,
): void {
  if (typeof statusCode === 'number') {
    response.statusCode = statusCode;
  }
  response.write(text || '');
  response.end();
}

/**
 * Write a json response text with an optional status code.
 */
export function sendJsonResponse(
  response: http$fixed$ServerResponse,
  json: any,
  statusCode: ?number,
): void {
  response.setHeader('Content-Type', 'application/json');
  sendTextResponse(response, JSON.stringify(json), statusCode);
}

/**
 * Parses the request body in an anyc/promise way
 */
export function parseRequestBody(
  httpRequest: http$fixed$IncomingMessage,
  isJson: ?boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    httpRequest.on('data', data => {
      body += data;
      // too much POST data, kill the connection!
      if (body.length > MAX_REQUEST_LENGTH) {
        reject(new Error('body is too big'));
        httpRequest.connection.destroy();
      }
    });
    httpRequest.on('end', () => resolve(isJson ? JSON.parse(body) : body));
  });
}

/**
 * Parses the url parameters ?abc=erf&lol=432c
 */
export function getQueryParameters(requestUrl: string): QueryParams {
  const components: ?Object = url.parse(requestUrl, true);
  invariant(components != null);
  const {query} = components;
  return query;
}

/**
 * Serializes the method arguments to args and argTypes arrays
 * to send the metadata about the argument types with the data
 * to help the server understand and parse it.
 */
export function serializeArgs(args: Array<any>): SerializedArguments {
  const argsOnHttp = [];
  const argTypes = [];
  args.forEach(arg => {
    // I do this because nulls are normally sent as empty strings
    if (arg === undefined) {
      argsOnHttp.push('');
      argTypes.push('undefined');
    } else if (typeof arg === 'string') {
      argsOnHttp.push(arg);
      argTypes.push('string');
    } else {
      // object, number, boolean null
      argsOnHttp.push(JSON.stringify(arg));
      argTypes.push('object');
    }
  });
  return {
    args: argsOnHttp,
    argTypes,
  };
}

/**
 * Deserializes a url with query parameters: args, argTypes to an array
 * of the original arguments of the same types the client called the function with.
 */
export function deserializeArgs(requestUrl: string): Array<any> {
  let {args, argTypes} = getQueryParameters(requestUrl);
  args = args || [];
  argTypes = argTypes || [];
  const argsArray = Array.isArray(args) ? args : [args];
  const argTypesArray = Array.isArray(argTypes) ? argTypes : [argTypes];
  return argsArray.map((arg, i) => {
    // I do this because nulls are normally sent as empty strings.
    if (argTypesArray[i] === 'undefined') {
      return undefined;
    } else if (argTypesArray[i] === 'string') {
      return arg;
    } else {
      // some methods have options object arguments.
      return JSON.parse(arg);
    }
  });
}
