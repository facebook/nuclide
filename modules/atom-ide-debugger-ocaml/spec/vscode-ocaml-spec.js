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

import * as DebugProtocol from 'vscode-debugprotocol';
import * as fs from 'fs';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import VsDebugSession from 'nuclide-debugger-common/VsDebugSession';
import {Logger} from 'vscode-debugadapter';
import {THREAD_ID} from '../lib/OCamlDebugger';

const logger = getLogger('ocaml-debugger-spec');
const adapterInfo = {
  command: 'node',
  args: [nuclideUri.join(__dirname, '../lib/vscode-debugger-entry.js')],
};
const OCAML_FIXTURES = nuclideUri.join(__dirname, 'fixtures');

function makeSource(name: string): DebugProtocol.Source {
  return {
    name,
    path: nuclideUri.join(OCAML_FIXTURES, name),
  };
}

async function checkResponse<T: DebugProtocol.base$Response>(
  responsePromise: Promise<T>,
  additionalValidation?: T => void,
): Promise<T> {
  const response = await responsePromise;
  expect(response.success).toBeTruthy(
    `Expected successful response, got ${JSON.stringify(response)}`,
  );

  if (additionalValidation != null) {
    additionalValidation(response);
  }

  return response;
}

async function withSession(
  executableName: string,
  breakpoints?: DebugProtocol.SetBreakpointsArguments,
  sessionContinuation: VsDebugSession => Promise<void>,
): Promise<void> {
  const session = new VsDebugSession(
    process.pid.toString(),
    logger,
    adapterInfo,
  );
  try {
    await checkResponse(
      session.initialize({adapterID: 'id', pathFormat: 'path'}),
    );
    await checkResponse(
      session.launch({
        ocamldebugExecutable: 'ocamldebug',
        executablePath: nuclideUri.join(__dirname, 'fixtures', executableName),
        arguments: [],
        environmentVariables: [],
        workingDirectory: OCAML_FIXTURES,
        includeDirectories: [],
        breakAfterStart: false,
        logLevel: Logger.Verbose,
      }),
    );

    if (breakpoints != null) {
      await checkResponse(session.setBreakpoints(breakpoints), response => {
        const unverifiedBreakpoints = response.body.breakpoints.filter(
          bp => !bp.verified,
        );
        expect(unverifiedBreakpoints.length).toBe(
          0,
          `The following breakpoints could not be set: ${JSON.stringify(
            unverifiedBreakpoints,
          )}`,
        );
      });
    }

    await checkResponse(session.configurationDone());

    await sessionContinuation(session);
  } finally {
    session.dispose();
  }
}

async function waitForEvent<T: DebugProtocol.DebugEvent>(
  eventStream: rxjs$Observable<T>,
): Promise<void> {
  await eventStream.take(1).toPromise();
}

const waitForBreak = (debugSession: VsDebugSession) =>
  waitForEvent(debugSession.observeStopEvents());

async function checkLine(
  debugSession: VsDebugSession,
  expectedLine: number,
): Promise<void> {
  await checkResponse(
    debugSession.stackTrace({threadId: THREAD_ID}),
    response => {
      expect(response.body.stackFrames[0].line).toBe(expectedLine);
    },
  );
}

describe('ocaml-debugger', () => {
  if (process.env.SANDCASTLE == null) {
    return;
  }

  let hasDoneSetup = false;
  beforeEach(() => {
    waitsForPromise(async () => {
      if (hasDoneSetup) {
        return;
      }

      jasmine.getEnv().defaultTimeoutInterval = 10000;

      const mlFiles = await new Promise((resolve, reject) => {
        fs.readdir(OCAML_FIXTURES, (err, files) => {
          if (err) {
            reject(err);
          }

          resolve(files.filter(file => file.endsWith('.ml')));
        });
      });

      await Promise.all(
        mlFiles.map(file =>
          runCommand(
            'ocamlc',
            ['-g', '-o', file.replace(/(\S+)\.ml$/, '$1.byte'), file],
            {cwd: OCAML_FIXTURES},
          ).toPromise(),
        ),
      );

      hasDoneSetup = true;
    });
  });

  it('can print values', () => {
    waitsForPromise(() =>
      withSession(
        'simple.byte',
        {
          source: makeSource('simple.ml'),
          breakpoints: [{line: 14}],
        },
        async debugSession => {
          await waitForBreak(debugSession);
          await checkResponse(
            debugSession.evaluate({expression: 'my_t'}),
            response => {
              expect(response.body.result).toBe(`t =
  {name = "My t"; id = 1349; field1 = "Field 1"; field2 = "Field 2";
   field3 = "Field 3"; field4 = "Field 4"; field5 = "Field 5"}`);
            },
          );
        },
      ),
    );
  });

  it('can set multiple breakpoints', () => {
    waitsForPromise(() =>
      withSession(
        'simple.byte',
        {
          source: makeSource('simple.ml'),
          breakpoints: [{line: 14}, {line: 26}],
        },
        async debugSession => {
          const waitCheckAndContinue = async (expectedLine: number) => {
            await waitForBreak(debugSession);
            await checkLine(debugSession, expectedLine);
            await checkResponse(debugSession.continue({threadId: THREAD_ID}));
          };

          // ocamldebug will hit breakpoint 14 as soon as it enters the
          // function, but won't hit 26 as a pre-execution breakpoint, only a
          // post-execution breakpoint. It's not the most predictable debugger
          // for people used to other ones.
          await waitCheckAndContinue(14);
          await waitCheckAndContinue(26);
        },
      ),
    );
  });

  it('supports step-over, step-in, and step-out', () => {
    waitsForPromise(() =>
      withSession(
        'simple.byte',
        {
          source: makeSource('simple.ml'),
          breakpoints: [{line: 26}],
        },
        async debugSession => {
          await waitForBreak(debugSession);
          await checkLine(debugSession, 26);

          await checkResponse(debugSession.next({threadId: THREAD_ID}));
          await checkLine(debugSession, 27);

          await checkResponse(debugSession.stepIn({threadId: THREAD_ID}));
          await checkLine(debugSession, 14);

          await checkResponse(debugSession.stepOut({threadId: THREAD_ID}));
          await checkLine(debugSession, 28);

          // OCaml *always* performs tail call optimization, so even if we
          // wanted to we couldn't hit line 29, since it's the lst line in
          // `main ()` so the function it calls is just directly inlined.
        },
      ),
    );
  });

  it('can set breakpoints even whilst in an infinite loop', () => {
    // This is important since ocamldebug is single threaded, so it can't
    // respond to user input while it's currently executing the program.
    waitsForPromise(() =>
      withSession('infinite_loop.byte', undefined, async debugSession => {
        await checkResponse(
          debugSession.setBreakpoints({
            source: makeSource('infinite_loop.byte'),
            breakpoints: [{line: 3}],
          }),
        );

        await waitForBreak(debugSession);
        await debugSession.disconnect();
      }),
    );
  });
});
