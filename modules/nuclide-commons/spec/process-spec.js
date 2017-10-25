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

import type {ProcessExitMessage} from '../process';

import EventEmitter from 'events';
import {sleep} from '../promise';
import child_process from 'child_process';
import invariant from 'assert';
import {Observable, Scheduler, Subject} from 'rxjs';

import {
  spawn,
  getOutputStream,
  killProcess,
  killUnixProcessTree,
  logStreamErrors,
  observeProcess,
  observeProcessRaw,
  parsePsOutput,
  preventStreamsFromThrowing,
  ProcessSystemError,
  runCommand,
  runCommandDetailed,
  scriptifyCommand,
  exitEventToMessage,
} from '../process';

describe('commons-node/process', () => {
  let origPlatform;

  beforeEach(() => {
    origPlatform = process.platform;
    // Use a fake platform so the platform's PATH is not used in case the test is run on a platform
    // that requires special handling (like OS X).
    Object.defineProperty(process, 'platform', {value: 'MockMock'});
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {value: origPlatform});
  });

  describe('process.killProcess', () => {
    it('should only kill the process when `killTree` is false', () => {
      waitsForPromise(async () => {
        const proc = {
          kill: jasmine.createSpy(),
        };
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        await killProcess((proc: any), false);
        expect(proc.kill).toHaveBeenCalled();
      });
    });

    it('should kill the process tree when `killTree` is true', () => {
      waitsForPromise(async () => {
        jasmine.useRealClock();
        // Create a tree that's more than level child deep.
        const proc = child_process.spawn('bash', [
          '-c',
          '( (sleep 1000)& sleep 1000 )& wait',
        ]);
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        spyOn(process, 'kill').andCallThrough();
        await sleep(250); // Give some time for the processes to spawn.
        await killUnixProcessTree(proc);
        expect(process.kill.callCount).toBeGreaterThan(2);
      });
    });

    it('should kill the process tree on windows when `killTree` is true', () => {
      waitsForPromise(async () => {
        const proc = {
          pid: 123,
        };
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        Object.defineProperty(process, 'platform', {value: 'win32'});
        spyOn(child_process, 'exec');
        await killProcess((proc: any), true);
        expect(child_process.exec.calls.length).toBe(1);
        expect(child_process.exec.calls[0].args[0]).toBe(
          `taskkill /pid ${proc.pid} /T /F`,
        );
      });
    });
  });

  describe('process.parsePsOutput', () => {
    it('parse `ps` unix output', () => {
      const unixPsOut =
        ' PPID   PID COMM\n' +
        '    0     1  /sbin/launchd\n' +
        '    1    42  command with spaces';
      const processList = parsePsOutput(unixPsOut);
      expect(processList).toEqual([
        {command: '/sbin/launchd', pid: 1, parentPid: 0},
        {command: 'command with spaces', pid: 42, parentPid: 1},
      ]);
    });

    it('parse `ps` windows output', () => {
      const windowsProcessOut =
        'ParentProcessId   ProcessId   Name\r\n' +
        '           0                4     System Process\r\n' +
        '           4                228   smss.exe';

      const processList = parsePsOutput(windowsProcessOut);
      expect(processList).toEqual([
        {command: 'System Process', pid: 4, parentPid: 0},
        {command: 'smss.exe', pid: 228, parentPid: 4},
      ]);
    });
  });

  describe('getOutputStream', () => {
    it('captures stdout, stderr and exitCode', () => {
      waitsForPromise(async () => {
        const child = child_process.spawn(process.execPath, [
          '-e',
          'console.error("stderr"); console.log("std out"); process.exit(0);',
        ]);
        const results = await getOutputStream(child)
          .toArray()
          .toPromise();
        expect(results).toEqual([
          {kind: 'stderr', data: 'stderr\n'},
          {kind: 'stdout', data: 'std out\n'},
          {kind: 'exit', exitCode: 0, signal: null},
        ]);
      });
    });

    it('errors on nonzero exit codes by default', () => {
      waitsForPromise(async () => {
        const child = child_process.spawn(process.execPath, [
          '-e',
          'console.error("stderr"); console.log("std out"); process.exit(42);',
        ]);
        const results = await getOutputStream(child)
          // $FlowIssue: Add materialize to type defs
          .materialize()
          .toArray()
          .toPromise();
        expect(results.map(notification => notification.kind)).toEqual([
          'N',
          'N',
          'E',
        ]);
        const {error} = results[2];
        expect(error.name).toBe('ProcessExitError');
        expect(error.exitCode).toBe(42);
        expect(error.stderr).toBe('stderr\n');
      });
    });

    it('accumulates the first `exitErrorBufferSize` bytes of stderr for the exit error', () => {
      waitsForPromise(async () => {
        let error;
        const child = child_process.spawn(process.execPath, [
          '-e',
          'console.error("stderr"); process.exit(42);',
        ]);
        try {
          await getOutputStream(child, {
            exitErrorBufferSize: 2,
            isExitError: () => true,
          })
            .toArray()
            .toPromise();
        } catch (err) {
          error = err;
        }
        expect(error).toBeDefined();
        invariant(error != null);
        expect(error.stderr).toBe('st');
      });
    });
  });

  describe('spawn', () => {
    it('errors when the process does', () => {
      waitsForPromise(async () => {
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        const processStream = spawn('fakeCommand');
        let error;
        try {
          await processStream.toPromise();
        } catch (err) {
          error = err;
        }
        expect(error).toBeDefined();
        invariant(error);
        expect(error.code).toBe('ENOENT');
        expect(error.name).toBe('ProcessSystemError');
      });
    });

    // Node delays the emission of the error until after the process is returned so that you have a
    // chance to subscribe to the error event. Observables aren't bound by the same limitations as
    // event-emitter APIs, so we can do better and not emit the process if there was an error
    // spawning it.
    it('errors before emitting the process', () => {
      waitsForPromise(async () => {
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        let proc;
        await spawn('fakeCommand')
          .do(p => {
            proc = p;
          })
          .catch(err => {
            expect(proc).toBeUndefined();
            expect(err.code).toBe('ENOENT');
            expect(err.name).toBe('ProcessSystemError');
            return Observable.empty();
          })
          .toPromise();
      });
    });

    it('leaves an error handler when you unsubscribe', () => {
      waitsForPromise(async () => {
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        let resolve;
        const promise = new Promise(r => {
          resolve = r;
        });
        const sub = spawn('cat')
          // If we subscribe synchronously, and it emits synchronously, `sub` won't have been
          // assigned yet in our `subscribe()` callback, so we use the async scheduler.
          .subscribeOn(Scheduler.async)
          .subscribe(proc => {
            // As soon as we have a process, unsubscribe. This will happen before the error is
            // thrown.
            sub.unsubscribe();

            // Make sure that the error handler is still registered. If it isn't, and the process
            // errors, node will consider the error unhandled and we'll get a redbox.
            expect(proc.listenerCount('error')).toBe(1);

            resolve();
          });
        await promise;
      });
    });

    it('can be retried', () => {
      waitsForPromise(async () => {
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        spyOn(child_process, 'spawn');
        try {
          await spawn('fakeCommand')
            .retryWhen(errors =>
              errors.scan((errorCount, err) => {
                // If this is the third time the process has errored (i.e. the have already been
                // two errors before), stop retrying. (We try 3 times because because Rx 3 and 4
                // have bugs with retrying shared observables that would give false negatives for
                // this test if we only tried twice.)
                if (errorCount === 2) {
                  throw err;
                }
                return errorCount + 1;
              }, 0),
            )
            .toPromise();
        } catch (err) {}
        expect(child_process.spawn.callCount).toBe(3);
      });
    });

    it('can be timed out', () => {
      waitsForPromise(async () => {
        let error;
        let proc;
        try {
          await spawn('sleep', ['10000'], {timeout: 1})
            .do(p => {
              proc = p;
              spyOn(proc, 'kill');
            })
            .toPromise();
        } catch (err) {
          error = err;
        }
        invariant(proc != null);
        invariant(error != null);
        expect(error.name).toBe('ProcessTimeoutError');
        expect(proc.kill).toHaveBeenCalled();
      });
    });
  });

  describe('observeProcess', () => {
    it('errors when the process does', () => {
      waitsForPromise(async () => {
        spyOn(console, 'error'); // suppress error printing
        spyOn(console, 'log'); // suppress log printing
        const processStream = observeProcess('fakeCommand', []);
        let error;
        try {
          await processStream.toPromise();
        } catch (err) {
          error = err;
        }
        expect(error).toBeDefined();
        invariant(error);
        expect(error.code).toBe('ENOENT');
        expect(error.name).toBe('ProcessSystemError');
      });
    });

    it('errors on nonzero exit codes by default', () => {
      waitsForPromise(async () => {
        const results = await observeProcess(process.execPath, [
          '-e',
          'console.error("stderr"); console.log("std out"); process.exit(42);',
        ])
          // $FlowIssue: Add materialize to type defs
          .materialize()
          .toArray()
          .toPromise();
        expect(results.map(notification => notification.kind)).toEqual([
          'N',
          'N',
          'E',
        ]);
        const {error} = results[2];
        expect(error.name).toBe('ProcessExitError');
        expect(error.exitCode).toBe(42);
        expect(error.stderr).toBe('stderr\n');
      });
    });

    it("doesn't get an exit message when there's an exit error", () => {
      waitsForPromise(async () => {
        const results = await observeProcess(process.execPath, [
          '-e',
          'process.exit(42);',
        ])
          // $FlowIssue: Add materialize to type defs
          .materialize()
          .toArray()
          .toPromise();
        expect(results.length).toBe(1);
        expect(results[0].kind).toBe('E');
      });
    });

    it('accumulates the first `exitErrorBufferSize` bytes of stderr for the exit error', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await observeProcess(
            process.execPath,
            ['-e', 'console.error("stderr"); process.exit(42);'],
            {exitErrorBufferSize: 2, isExitError: () => true},
          )
            .toArray()
            .toPromise();
        } catch (err) {
          error = err;
        }
        expect(error).toBeDefined();
        invariant(error != null);
        expect(error.stderr).toBe('st');
      });
    });
  });

  describe('observeProcessRaw', () => {
    it("doesn't split on line breaks", () => {
      spyOn(console, 'error');
      spyOn(console, 'log'); // suppress log printing
      waitsForPromise({timeout: 1000}, async () => {
        const event = await observeProcessRaw(process.execPath, [
          '-e',
          'process.stdout.write("stdout1\\nstdout2\\n"); process.exit(1)',
        ])
          .take(1)
          .toPromise();
        invariant(event.kind === 'stdout');
        expect(event.data).toBe('stdout1\nstdout2\n');
      });
    });
  });

  describe('runCommand', () => {
    beforeEach(() => {
      // Suppress console spew.
      spyOn(console, 'error');
      spyOn(console, 'log'); // suppress log printing
    });

    if (origPlatform === 'win32') {
      return;
    }

    it('sends the stdin to the process', () => {
      waitsForPromise(async () => {
        const output = await runCommand('cat', [], {
          input: 'hello',
        }).toPromise();
        expect(output).toBe('hello');
      });
    });

    it('sends a stream of stdin to the process', () => {
      waitsForPromise(async () => {
        const input = new Subject();
        const outputPromise = runCommand('cat', [], {
          input,
        }).toPromise();
        input.next('hello');
        input.next(' ');
        input.next('world');
        input.complete();
        expect(await outputPromise).toBe('hello world');
      });
    });

    it('enforces maxBuffer', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommand('yes', [], {maxBuffer: 100}).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.message).toContain('maxBuffer');
      });
    });

    it('returns stdout of the running process', () => {
      waitsForPromise(async () => {
        const val = await runCommand('echo', ['-n', 'foo'], {
          env: process.env,
        }).toPromise();
        expect(val).toEqual('foo');
      });
    });

    it("throws an error if the process can't be spawned", () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommand('fakeCommand').toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.code).toBe('ENOENT');
        expect(error.name).toBe('ProcessSystemError');
      });
    });

    it('throws an error if the exit code !== 0', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommand(process.execPath, [
            '-e',
            'process.exit(1)',
          ]).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.name).toBe('ProcessExitError');
        expect(error.exitCode).toBe(1);
      });
    });

    it('includes stdout and stderr in ProcessExitErrors', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommand(process.execPath, [
            '-e',
            'process.stderr.write("oopsy"); process.stdout.write("daisy"); process.exit(1)',
          ]).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.name).toBe('ProcessExitError');
        expect(error.stderr).toBe('oopsy');
        expect(error.stdout).toBe('daisy');
      });
    });

    it('accumulates the stderr if the process exits with a non-zero code', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommand(process.execPath, [
            '-e',
            'process.stderr.write("oopsy"); process.exit(1)',
          ]).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.stderr).toBe('oopsy');
      });
    });

    // Previously we had a bug where we mutated the seed and subsequent subscriptions would use the
    // mutated value.
    it("doesn't share a mutable seed (regression test)", () => {
      waitsForPromise(async () => {
        const observable = runCommand(process.execPath, [
          '-e',
          'process.stdout.write("hello"); process.exit(0)',
        ]);
        await observable.toPromise();
        expect(await observable.toPromise()).toBe('hello');
      });
    });

    describe('checkOutput compatibility', () => {
      if (origPlatform !== 'win32') {
        it('returns stdout of the running process', () => {
          waitsForPromise(async () => {
            const val = await runCommand('echo', ['-n', 'foo'], {
              env: process.env,
            }).toPromise();
            expect(val).toEqual('foo');
          });
        });
        it('throws an error if the exit code !== 0', () => {
          waitsForPromise({shouldReject: true}, async () => {
            await runCommand(process.execPath, [
              '-e',
              'process.exit(1)',
            ]).toPromise();
          });
        });
      }
    });
  });

  describe('runCommandDetailed', () => {
    beforeEach(() => {
      // Suppress console spew.
      spyOn(console, 'error');
      spyOn(console, 'log'); // suppress log printing
    });

    if (origPlatform === 'win32') {
      return;
    }

    it('sends the stdin to the process', () => {
      waitsForPromise(async () => {
        const output = await runCommandDetailed('cat', [], {
          input: 'hello',
        }).toPromise();
        expect(output.stdout).toBe('hello');
      });
    });

    it('enforces maxBuffer', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommandDetailed('yes', [], {maxBuffer: 100}).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.message).toContain('maxBuffer');
      });
    });

    it('returns stdout, stderr, and the exit code of the running process', () => {
      waitsForPromise(async () => {
        const val = await runCommandDetailed(process.execPath, [
          '-e',
          'process.stdout.write("out"); process.stderr.write("err"); process.exit(0)',
        ]).toPromise();
        expect(val).toEqual({stdout: 'out', stderr: 'err', exitCode: 0});
      });
    });

    it("throws an error if the process can't be spawned", () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommandDetailed('fakeCommand').toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.code).toBe('ENOENT');
        expect(error.name).toBe('ProcessSystemError');
      });
    });

    it('throws an error if the exit code !== 0', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommandDetailed(process.execPath, [
            '-e',
            'process.exit(1)',
          ]).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.name).toBe('ProcessExitError');
        expect(error.exitCode).toBe(1);
      });
    });

    it('accumulates the stderr if the process exits with a non-zero code', () => {
      waitsForPromise(async () => {
        let error;
        try {
          await runCommandDetailed(process.execPath, [
            '-e',
            'process.stderr.write("oopsy"); process.exit(1)',
          ]).toPromise();
        } catch (err) {
          error = err;
        }
        invariant(error != null);
        expect(error.stderr).toBe('oopsy');
      });
    });
  });

  describe('exitEventToMessage', () => {
    it('exitCode', () => {
      expect(exitEventToMessage(makeExitMessage(1))).toBe('exit code 1');
    });

    it('signal', () => {
      expect(
        exitEventToMessage({kind: 'exit', exitCode: null, signal: 'SIGTERM'}),
      ).toBe('signal SIGTERM');
    });
  });

  describe('preventStreamsFromThrowing', () => {
    let proc: child_process$ChildProcess;
    beforeEach(() => {
      proc = ({
        stdin: new EventEmitter(),
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
      }: any);
      spyOn(proc.stdin, 'addListener').andCallThrough();
      spyOn(proc.stdout, 'addListener').andCallThrough();
      spyOn(proc.stderr, 'addListener').andCallThrough();
      spyOn(proc.stdin, 'removeListener').andCallThrough();
      spyOn(proc.stdout, 'removeListener').andCallThrough();
      spyOn(proc.stderr, 'removeListener').andCallThrough();
    });

    it('adds listeners', () => {
      preventStreamsFromThrowing(proc);
      expect(proc.stdin.addListener).toHaveBeenCalledWith(
        'error',
        jasmine.any(Function),
      );
      expect(proc.stdout.addListener).toHaveBeenCalledWith(
        'error',
        jasmine.any(Function),
      );
      expect(proc.stderr.addListener).toHaveBeenCalledWith(
        'error',
        jasmine.any(Function),
      );
    });

    it('removes listeners when disposed', () => {
      const disposable = preventStreamsFromThrowing(proc);
      disposable.dispose();
      expect(proc.stdin.removeListener).toHaveBeenCalledWith(
        'error',
        jasmine.any(Function),
      );
      expect(proc.stdout.removeListener).toHaveBeenCalledWith(
        'error',
        jasmine.any(Function),
      );
      expect(proc.stderr.removeListener).toHaveBeenCalledWith(
        'error',
        jasmine.any(Function),
      );
    });
  });

  describe('logStreamErrors', () => {
    let proc: child_process$ChildProcess;
    beforeEach(() => {
      proc = ({
        stdin: new EventEmitter(),
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
      }: any);

      // Add a no-op listener so the error events aren't thrown.
      proc.stdin.on('error', () => {});
      proc.stdout.on('error', () => {});
      proc.stderr.on('error', () => {});
    });

    it('logs errors', () => {
      logStreamErrors(proc, 'test', [], {});
      spyOn(console, 'error');
      proc.stderr.emit('error', new Error('Test error'));
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled();
    });

    it("doesn't log when disposed", () => {
      const disposable = logStreamErrors(proc, 'test', [], {});
      spyOn(console, 'error');
      disposable.dispose();
      proc.stderr.emit('error', new Error('Test error'));
      // eslint-disable-next-line no-console
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('ProcessSystemError', () => {
    it('contains the correct properties', () => {
      const proc = (({}: any): child_process$ChildProcess);
      const originalError = {
        errno: 2,
        code: 'ETEST',
        path: 'path value',
        syscall: 'syscall value',
      };
      const err = new ProcessSystemError(originalError, proc);
      expect(err.errno).toBe(2);
      expect(err.code).toBe('ETEST');
      expect(err.path).toBe('path value');
      expect(err.syscall).toBe('syscall value');
      expect(err.process).toBe(proc);
    });
  });

  describe('scriptifyCommand', () => {
    if (process.platform === 'linux') {
      it('escapes correctly on linux', () => {
        waitsForPromise(async () => {
          const output = await runCommand(
            ...scriptifyCommand('echo', [
              'a\\b c\\\\d e\\\\\\f g\\\\\\\\h "dubs" \'singles\'',
              'one   two',
            ]),
          ).toPromise();
          expect(output.trim()).toBe(
            'a\\b c\\\\d e\\\\\\f g\\\\\\\\h "dubs" \'singles\' one   two',
          );
        });
      });
    }
  });
});

function makeExitMessage(exitCode: number): ProcessExitMessage {
  return {
    kind: 'exit',
    exitCode,
    signal: null,
  };
}
