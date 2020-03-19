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

import type {AgentOptions} from '../../common/types';

import invariant from 'assert';
import request from 'request';
import https from 'https';
import http from 'http';
import url from 'url';
import passesGK from 'nuclide-commons/passesGK';

export type RequestOptions = {
  uri: string,
  method?: string,
  agentOptions?: AgentOptions,
  useQuerystring?: boolean,
  timeout?: number,
  body?: string,
};

export type ResponseBody = {body: string, response: HttpResponse};
type HttpResponse = {statusCode: number};

/**
 * Promisified version of the request function:
 * https://www.npmjs.com/package/request#requestoptions-callback
 * Defaults to using the node's querystring module to encode the url query parameters.
 * If you want to use the npm's qs module to encode the query parameters, explicitly provide
 * the option:
 * {useQuerystring: false}
 */
export default (async function asyncRequest(
  options: RequestOptions,
): Promise<ResponseBody> {
  const useNodeRequest = await passesGK('bigdig_node_http_request');

  return new Promise((resolve, reject) => {
    if (options.useQuerystring === undefined) {
      options.useQuerystring = true;
    }

    const handleResponse = (error, response, body) => {
      if (error) {
        reject(error);
      } else if (
        response != null &&
        (response.statusCode < 200 || response.statusCode >= 300)
      ) {
        let errorJson = {};
        if (typeof body !== 'object') {
          try {
            errorJson = JSON.parse(body);
          } catch (e) {
            // 404 responses aren't currently JSON.
            errorJson = {message: body};
          }
        }
        // Cast to Object for use of code field below...
        const err: Object = new Error(errorJson.message);
        // Success http status codes range from 200 to 299.
        err.code = errorJson.code || response.statusCode;
        reject(err);
      } else {
        invariant(body != null);
        invariant(response != null);
        resolve({body, response});
      }
    };

    if (useNodeRequest) {
      nodeRequest(options, handleResponse);
    } else {
      request(options, handleResponse);
    }
  });
});

// TODO support IPv6 support T36867827/T36962554 for all cases
function nodeRequest(opts: RequestOptions, cb) {
  const parsedUri = url.parse(opts.uri);
  const agentOptions = opts.agentOptions;

  const options = {
    host: parsedUri.hostname,
    port: parsedUri.port,
    path: parsedUri.pathname,
    method: opts.method,
    timeout: opts.timeout,
    cert: agentOptions ? agentOptions.cert : undefined,
    key: agentOptions ? agentOptions.key : undefined,
    ca: agentOptions ? agentOptions.ca : undefined,
  };

  let requestMethod = https.request;

  if (parsedUri.protocol != null && parsedUri.protocol.match(/http:/)) {
    requestMethod = http.request;
  }

  const req = requestMethod(options, res => {
    let body = '';

    res.on('data', d => {
      body += d;
    });

    res.on('end', () => {
      cb(null, res, body);
    });
  });

  req.on('error', err => {
    cb(err, null, null);
  });

  req.end(opts.body);
}
