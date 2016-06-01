'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../nuclide-remote-uri';

import LRUCache from 'lru-cache';
import JediServer from './JediServer';

export type JediCompletion = {
  type: string;
  text: string;
  description?: string;
  params?: Array<string>;
};

export type JediCompletionsResult = {
  completions: Array<JediCompletion>;
};

export type JediDefinition = {
  type: string;
  text: string;
  file: NuclideUri;
  line: number;
  column: number;
};

export type JediDefinitionsResult = {
  definitions: Array<JediDefinition>;
};

export type JediReferencesResult = {
  references: Array<JediDefinition>;
};

// Limit the number of active Jedi processes.
const jediServers = new LRUCache({
  max: 10,
  dispose(key: NuclideUri, val: JediServer) {
    val.dispose();
  },
});


// Cache the pythonPath on first execution so we don't rerun overrides script
// everytime.
let pythonPath;
async function getPythonPath() {
  if (pythonPath) {
    return pythonPath;
  }
  // Default to assuming that python is in system PATH.
  pythonPath = 'python';
  try {
    // Override the python path if override script is present.
    // $FlowFB
    const overrides = await require('./fb/find-jedi-server-args')();
    if (overrides.pythonExecutable) {
      pythonPath = overrides.pythonExecutable;
    }
  } catch (e) {
    // Ignore.
  }
  return pythonPath;
}


async function getJediServer(src: NuclideUri): Promise<JediServer> {
  let server = jediServers.get(src);
  if (server != null) {
    return server;
  }
  // Create a JediServer using default python path.
  server = new JediServer(src, await getPythonPath());
  jediServers.set(src, server);
  return server;
}

export async function getCompletions(
  src: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?JediCompletionsResult> {
  const server = await getJediServer(src);
  return server.call(
    'get_completions',
    {
      src,
      contents,
      line,
      column,
    });
}

export async function getDefinitions(
  src: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?JediDefinitionsResult> {
  const server = await getJediServer(src);
  return server.call(
    'get_definitions',
    {
      src,
      contents,
      line,
      column,
    });
}

export async function getReferences(
  src: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?JediReferencesResult> {
  const server = await getJediServer(src);
  return server.call(
    'get_references',
    {
      src,
      contents,
      line,
      column,
    });
}
