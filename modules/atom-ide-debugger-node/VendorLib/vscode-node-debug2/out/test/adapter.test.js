"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path = require("path");
const ts = require("vscode-chrome-debug-core-testsupport");
const utils = require("../src/utils");
const testSetup = require("./testSetup");
const DATA_ROOT = testSetup.DATA_ROOT;
suite('Node Debug Adapter etc', () => {
    let dc;
    setup(() => {
        return testSetup.setup()
            .then(_dc => dc = _dc);
    });
    teardown(() => {
        return testSetup.teardown();
    });
    suite('basic', () => {
        test('unknown request should produce error', done => {
            dc.send('illegal_request').then(() => {
                done(new Error('does not report error on unknown request'));
            }).catch(() => {
                done();
            });
        });
    });
    suite('initialize', () => {
        test('should return supported features', () => {
            return dc.initializeRequest().then(response => {
                assert.equal(response.body.supportsConfigurationDoneRequest, true);
            });
        });
        test('should produce error for invalid \'pathFormat\'', () => {
            return dc.initializeRequest({
                adapterID: 'mock',
                linesStartAt1: true,
                columnsStartAt1: true,
                pathFormat: 'url'
            }).then(response => {
                throw new Error('does not report error on invalid \'pathFormat\' attribute');
            }).catch(err => {
                // error expected
            });
        });
    });
    suite('launch', () => {
        test('should run program to the end', () => {
            if (utils.compareSemver(process.version, 'v8.0.0') < 0) {
                // Skip test if the node version doesn't emit the Runtime.executionContextDestroyed event
                return Promise.resolve();
            }
            const PROGRAM = path.join(DATA_ROOT, 'program.js');
            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM }),
                dc.waitForEvent('terminated')
            ]);
        });
        test('should stop on entry', () => {
            const PROGRAM = path.join(DATA_ROOT, 'program.js');
            const ENTRY_LINE = 1;
            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM, stopOnEntry: true }),
                dc.assertStoppedLocation('entry', { path: PROGRAM, line: ENTRY_LINE })
            ]);
        });
        test('should stop on debugger statement', () => {
            const PROGRAM = path.join(DATA_ROOT, 'programWithDebugger.js');
            const DEBUGGER_LINE = 6;
            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM }),
                dc.assertStoppedLocation('debugger_statement', { path: PROGRAM, line: DEBUGGER_LINE })
            ]);
        });
    });
    // verbose logging...
    suite.skip('output events', () => {
        const PROGRAM = path.join(DATA_ROOT, 'programWithOutput.js');
        test('stdout and stderr events should be complete and in correct order', () => {
            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM }),
                dc.assertOutput('stdout', 'Hello stdout 0\nHello stdout 1\nHello stdout 2\n'),
            ]);
        });
    });
    suite('eval', () => {
        const PROGRAM = path.join(DATA_ROOT, 'programWithFunction.js');
        function start() {
            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM }),
                dc.waitForEvent('initialized')
            ]).then(() => { });
        }
        test('works for a simple case', () => {
            return start()
                .then(() => dc.evaluateRequest({ expression: '1 + 1' }))
                .then(response => {
                assert(response.success);
                assert.equal(response.body.result, '2');
                assert.equal(response.body.variablesReference, 0);
            });
        });
        test('evaluates a global node thing', () => {
            return start()
                .then(() => dc.evaluateRequest({ expression: 'Object' }))
                .then(response => {
                assert(response.success);
                assert.equal(response.body.result, 'function Object() { … }');
                assert(response.body.variablesReference > 0);
            });
        });
        test('returns "not available" for a reference error', () => {
            return start()
                .then(() => dc.evaluateRequest({ expression: 'notDefinedThing' }))
                .catch(response => {
                assert.equal(response.message, 'not available');
            });
        });
        test('returns the error message for another error', () => {
            return start()
                .then(() => dc.evaluateRequest({ expression: 'throw new Error("fail")' }))
                .catch(response => {
                assert.equal(response.message, 'Error: fail');
            });
        });
        test('Shows object previews', () => {
            return start()
                .then(() => dc.evaluateRequest({ expression: 'x = {a: 1, b: [1], c: {a: 1}}' }))
                .then(response => {
                assert(response.success);
                assert(response.body.result === 'Object {a: 1, b: Array(1), c: Object}' ||
                    response.body.result === 'Object {a: 1, b: Array[1], c: Object}');
                assert(response.body.variablesReference > 0);
            });
        });
        test('Shows array previews', () => {
            return start()
                .then(() => dc.evaluateRequest({ expression: '[1, [1], {a: 3}]' }))
                .then(response => {
                assert(response.success);
                assert(response.body.result === 'Array[3] [1, Array[1], Object]' ||
                    response.body.result === 'Array(3) [1, Array(1), Object]');
                assert(response.body.variablesReference > 0);
            });
        });
    });
    suite('completions', () => {
        const PROGRAM = path.join(DATA_ROOT, 'programWithVariables.js');
        function start() {
            return Promise.all([
                dc.configurationSequence(),
                dc.launch({ program: PROGRAM }),
                dc.waitForEvent('initialized'),
                dc.waitForEvent('stopped')
            ]).then(() => { });
        }
        function testCompletions(text, column = text.length + 1, frameIdx = 0) {
            return start()
                .then(() => dc.stackTraceRequest())
                .then(stackTraceResponse => stackTraceResponse.body.stackFrames.map(frame => frame.id))
                .then(frameIds => dc.send('completions', { text, column, frameId: frameIds[frameIdx] }))
                .then((response) => response.body.targets);
        }
        function inCompletionsList(completions, ...labels) {
            return labels.every(label => completions.filter(target => target.label === label).length === 1);
        }
        test('returns global vars', () => {
            return testCompletions('')
                .then(completions => assert(inCompletionsList(completions, 'global')));
        });
        test('returns local vars', () => {
            return testCompletions('')
                .then(completions => assert(inCompletionsList(completions, 'num', 'str', 'arr', 'obj')));
        });
        test('returns methods', () => {
            return testCompletions('arr.')
                .then(completions => assert(inCompletionsList(completions, 'push', 'indexOf')));
        });
        test('returns object properties', () => {
            return testCompletions('obj.')
                .then(completions => assert(inCompletionsList(completions, 'a', 'b')));
        });
        test('multiple dots', () => {
            return testCompletions('obj.b.')
                .then(completions => assert(inCompletionsList(completions, 'startsWith', 'endsWith')));
        });
        test('returns from the correct column', () => {
            return testCompletions('obj.b.', /*column=*/ 6)
                .then(completions => assert(inCompletionsList(completions, 'a', 'b')));
        });
        test('returns from the correct frameId', () => {
            return testCompletions('obj', undefined, /*frameId=*/ 1)
                .then(completions => assert(!inCompletionsList(completions, 'obj')));
        });
        test('returns properties of string literals', () => {
            return testCompletions('"".')
                .then(completions => assert(inCompletionsList(completions, 'startsWith')));
        });
    });
    suite('hit condition bps', () => {
        const PROGRAM = path.join(DATA_ROOT, 'programWithFunction.js');
        function continueAndStop(line) {
            return dc.continueTo('breakpoint', { path: PROGRAM, line });
        }
        test('Works for =', () => {
            const noCondBpLine = 15;
            const condBpLine = 14;
            const bps = [
                { line: condBpLine, hitCondition: '=2' },
                { line: noCondBpLine }
            ];
            return Promise.all([
                ts.debugClient.setBreakpointOnStart(dc, bps, PROGRAM),
                dc.launch({ program: PROGRAM }),
                // Assert that it skips
                dc.assertStoppedLocation('breakpoint', { path: PROGRAM, line: noCondBpLine })
                    .then(() => continueAndStop(condBpLine))
                    .then(() => continueAndStop(noCondBpLine))
                    .then(() => continueAndStop(noCondBpLine))
            ]);
        });
        test('Works for %', () => {
            const noCondBpLine = 15;
            const condBpLine = 14;
            const bps = [
                { line: condBpLine, hitCondition: '%3' },
                { line: noCondBpLine }
            ];
            return Promise.all([
                ts.debugClient.setBreakpointOnStart(dc, bps, PROGRAM),
                dc.launch({ program: PROGRAM }),
                // Assert that it skips
                dc.assertStoppedLocation('breakpoint', { path: PROGRAM, line: noCondBpLine })
                    .then(() => continueAndStop(noCondBpLine))
                    .then(() => continueAndStop(condBpLine))
                    .then(() => continueAndStop(noCondBpLine))
            ]);
        });
        test('Does not bind when invalid', () => {
            const condBpLine = 14;
            const bps = [
                { line: condBpLine, hitCondition: 'lsdf' }
            ];
            return Promise.all([
                ts.debugClient.setBreakpointOnStart(dc, bps, PROGRAM, undefined, undefined, /*expVerified=*/ false),
                dc.launch({ program: PROGRAM })
            ]);
        });
    });
    suite('get loaded scripts', () => {
        function assertHasSource(loadedSources, expectedPath) {
            assert(loadedSources.find(source => source.path === expectedPath));
        }
        test('returns all scripts', () => __awaiter(this, void 0, void 0, function* () {
            const PROGRAM = path.join(DATA_ROOT, 'simple-eval/index.js');
            yield dc.hitBreakpoint({ program: PROGRAM }, { path: PROGRAM, line: 3 });
            const { sources } = yield dc.loadedSources({});
            assert(!!sources);
            assert(sources.length > 10);
            // Has the program
            assertHasSource(sources, PROGRAM);
            // Has some node_internals script
            const nodeInternalsScript = '<node_internals>/timers.js';
            assertHasSource(sources, nodeInternalsScript);
            // Has the eval script
            assert(sources.filter(source => source.path.match(/VM\d+/)).length >= 1);
        }));
    });
    suite('async callstacks', () => {
        function assertAsyncLabelCount(stackTrace, expectedAsyncLabels) {
            assert.equal(stackTrace.body.stackFrames.filter(frame => !frame.source).length, expectedAsyncLabels);
        }
        function assertStackFrame(stackTrace, i, sourcePath, line) {
            const frame = stackTrace.body.stackFrames[i];
            assert(!!frame);
            assert.equal(frame.source && frame.source.path, sourcePath);
            assert.equal(frame.line, line);
        }
        test('shows async stacks for promise resolution', () => __awaiter(this, void 0, void 0, function* () {
            const PROGRAM = path.join(DATA_ROOT, 'promise-chain/main.js');
            const breakpoints = [7, 13, 19, 25, 31].map(line => ({ line }));
            yield dc.hitBreakpoint({ program: PROGRAM, showAsyncStacks: true }, { path: PROGRAM, line: 45 });
            yield dc.setBreakpointsRequest({ source: { path: PROGRAM }, breakpoints });
            yield dc.continueAndStop();
            assertAsyncLabelCount(yield dc.stackTraceRequest(), 1);
            yield dc.continueAndStop();
            assertAsyncLabelCount(yield dc.stackTraceRequest(), 2);
            yield dc.continueAndStop();
            assertAsyncLabelCount(yield dc.stackTraceRequest(), 3);
            yield dc.continueAndStop();
            assertAsyncLabelCount(yield dc.stackTraceRequest(), 4);
            // Hit the limit of 4 async parents
            yield dc.continueAndStop();
            assertAsyncLabelCount(yield dc.stackTraceRequest(), 4);
        }));
        function stepOverNativeAwait(fromLine, afterBp = false) {
            return __awaiter(this, void 0, void 0, function* () {
                const toLine = fromLine + 1;
                if (utils.compareSemver(process.version, 'v8.0.0') < 0 || utils.compareSemver(process.version, 'v8.4.0') >= 0) {
                    // In pre-8, must always step twice over await lines
                    yield dc.nextTo('step', { line: fromLine });
                    yield dc.nextTo('step', { line: fromLine });
                }
                else if (!afterBp) {
                    // In 8, must step an extra time if a BP on this line didn't cause the break
                    yield dc.nextTo('step', { line: fromLine });
                }
                yield dc.nextTo('step', { line: toLine });
            });
        }
        test('shows async stacks and steps correctly for native async/await', () => __awaiter(this, void 0, void 0, function* () {
            if (utils.compareSemver(process.version, 'v7.6.0') < 0) {
                // Skip test if the node version doesn't support native async/await
                return Promise.resolve();
            }
            const PROGRAM = path.join(DATA_ROOT, 'native-async-await/main.js');
            yield dc.hitBreakpoint({ program: PROGRAM, showAsyncStacks: true }, { path: PROGRAM, line: 8 });
            yield stepOverNativeAwait(8, /*afterBp=*/ true);
            let stackTrace = yield dc.stepInTo('step', { line: 13 });
            assertStackFrame(stackTrace, 3, PROGRAM, 7);
            assertStackFrame(stackTrace, 4, PROGRAM, 40);
            assertAsyncLabelCount(stackTrace, 1);
            yield stepOverNativeAwait(13);
            stackTrace = yield dc.stepInTo('step', { line: 18 });
            assertStackFrame(stackTrace, 3, PROGRAM, 12);
            assertStackFrame(stackTrace, 4, PROGRAM, 9);
            assertAsyncLabelCount(stackTrace, 2);
            yield stepOverNativeAwait(18);
            stackTrace = yield dc.stepInTo('step', { line: 23 });
            assertStackFrame(stackTrace, 3, PROGRAM, 17);
            assertStackFrame(stackTrace, 4, PROGRAM, 14);
            assertAsyncLabelCount(stackTrace, 3);
            yield stepOverNativeAwait(23);
            stackTrace = yield dc.stepInTo('step', { line: 28 });
            assertStackFrame(stackTrace, 3, PROGRAM, 22);
            assertStackFrame(stackTrace, 4, PROGRAM, 19);
            assertAsyncLabelCount(stackTrace, 4);
        }));
    });
});

//# sourceMappingURL=adapter.test.js.map
