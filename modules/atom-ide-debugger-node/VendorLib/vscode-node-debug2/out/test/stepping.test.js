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
const testSetup = require("./testSetup");
suite('Stepping', () => {
    const DATA_ROOT = testSetup.DATA_ROOT;
    let dc;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        dc = yield testSetup.setup();
    }));
    teardown(() => {
        return testSetup.teardown();
    });
    suite('basic', () => {
        const PROGRAM = path.join(DATA_ROOT, 'program.js');
        function start() {
            return dc.hitBreakpoint({ program: PROGRAM }, { path: PROGRAM, line: 1 });
        }
        test('returns the same frameIDs between steps', () => __awaiter(this, void 0, void 0, function* () {
            let firstFrameIDs;
            yield start();
            yield dc.nextAndStop();
            const stackTraceResponse = yield dc.stackTraceRequest();
            firstFrameIDs = stackTraceResponse.body.stackFrames.map(frame => frame.id);
            yield dc.nextAndStop();
            const stackTraceResponse2 = yield dc.stackTraceRequest();
            const secondFrameIDs = stackTraceResponse2.body.stackFrames.map(frame => frame.id);
            assert.deepEqual(firstFrameIDs, secondFrameIDs);
        }));
        test('smart stepping steps over unmapped files', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'sourcemaps-with-and-without/out/mapped.js');
            const programSource = path.join(DATA_ROOT, 'sourcemaps-with-and-without/src/mapped.ts');
            yield dc.hitBreakpoint({ program, smartStep: true, sourceMaps: true }, { path: programSource, line: 7 });
            yield dc.stepInAndStop();
            const stackTraceResponse = yield dc.stackTraceRequest();
            const firstFrame = stackTraceResponse.body.stackFrames[0];
            assert.equal(firstFrame.source.path, programSource);
            assert.equal(firstFrame.line, 4);
        }));
        test('smart stepping stops on exceptions in unmapped files', () => {
            const PROGRAM = path.join(DATA_ROOT, 'programWithException.js');
            const EXCEPTION_LINE = 6;
            return Promise.all([
                dc.waitForEvent('initialized').then(event => {
                    return dc.setExceptionBreakpointsRequest({
                        filters: ['all']
                    });
                }).then(response => {
                    return dc.configurationDoneRequest();
                }),
                dc.launch({ program: PROGRAM, sourceMaps: true, smartStep: true }),
                dc.assertStoppedLocation('exception', { path: PROGRAM, line: EXCEPTION_LINE })
            ]);
        });
    });
    suite('skipFiles', () => {
        test('steps through un-sourcemapped file', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'sourcemaps-with-and-without/out/mapped.js');
            const programSource = path.join(DATA_ROOT, 'sourcemaps-with-and-without/src/mapped.ts');
            const skipFiles = ['unmapped'];
            yield dc.hitBreakpoint({ program, sourceMaps: true, skipFiles }, { path: programSource, line: 7 });
            yield dc.stepInAndStop();
            const stackTraceResponse = yield dc.stackTraceRequest();
            const firstFrame = stackTraceResponse.body.stackFrames[0];
            assert.equal(firstFrame.source.path, programSource);
            assert.equal(firstFrame.line, 4);
        }));
        test('steps through sourcemapped file', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceA.js');
            const programSource = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/src/sourceA.ts');
            const skipFiles = ['calls-between-sourcemapped-*/*B'];
            yield dc.hitBreakpoint({ program, sourceMaps: true, skipFiles }, { path: programSource, line: 8 });
            yield dc.stepInAndStop();
            const stackTraceResponse = yield dc.stackTraceRequest();
            const firstFrame = stackTraceResponse.body.stackFrames[0];
            assert.equal(firstFrame.source.path, programSource);
            assert.equal(firstFrame.line, 4);
        }));
        test('steps over exception in skipped file', () => {
            const program = path.join(DATA_ROOT, 'calls-between-files-with-exception/out/sourceA.js');
            const programSource = path.join(DATA_ROOT, 'calls-between-files-with-exception/src/sourceA.ts');
            const skipFiles = ['calls-between-files-*/*B'];
            return Promise.all([
                dc.waitForEvent('initialized').then(event => {
                    return dc.setExceptionBreakpointsRequest({
                        filters: ['all']
                    });
                })
                    .then(() => dc.setBreakpointsRequest({ source: { path: programSource }, breakpoints: [{ line: 7 }] }))
                    .then(() => dc.configurationDoneRequest()),
                dc.launch({ program, sourceMaps: true, skipFiles }),
                dc.assertStoppedLocation('breakpoint', { path: programSource, line: 7 })
            ]).then(() => dc.nextTo('step', { path: programSource, line: 8 }));
        });
        test('still stops at breakpoint in skipped file', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceA.js');
            const programASource = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/src/sourceA.ts');
            const programBSource = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/src/sourceB.ts');
            const skipFiles = ['calls-between-sourcemapped-*/*B'];
            const bpLineB = 2;
            yield dc.hitBreakpoint({ program, sourceMaps: true, skipFiles }, { path: programASource, line: 8 });
            yield dc.setBreakpointsRequest({ source: { path: programBSource }, breakpoints: [{ line: bpLineB }] });
            yield dc.stepInTo('breakpoint', { path: programBSource, line: bpLineB });
        }));
        test('can toggle skipping on and off', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceA.js');
            const programASource = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/src/sourceA.ts');
            const programBSource = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/src/sourceB.ts');
            const bpLineA = 8;
            yield Promise.all([
                dc.waitForEvent('initialized').then(event => {
                    return dc.setExceptionBreakpointsRequest({
                        filters: ['all']
                    });
                })
                    .then(() => dc.setBreakpointsRequest({ source: { path: programASource }, breakpoints: [{ line: bpLineA }] }))
                    .then(() => dc.configurationDoneRequest()),
                dc.launch({ program, sourceMaps: true }),
                dc.assertStoppedLocation('breakpoint', { path: programASource, line: bpLineA })
            ]);
            // Step into sourceB, set it to be skipped
            yield dc.stepInTo('step', { path: programBSource, line: 2 });
            yield dc.toggleSkipFileStatus(programBSource);
            // Continue back to sourceA, step through B, back to A
            yield dc.continueTo('breakpoint', { path: programASource, line: bpLineA });
            yield dc.stepInTo('step', { path: programASource, line: 4 });
            // Toggle B back to not being skipped, continue to A, step in to B
            yield dc.toggleSkipFileStatus(programBSource);
            yield dc.continueTo('breakpoint', { path: programASource, line: bpLineA });
            yield dc.stepInTo('step', { path: programBSource, line: 2 });
        }));
        test('when generated script is skipped via regex, the source can be un-skipped', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'calls-between-merged-files/out/sourceA.js');
            const sourceA = path.join(DATA_ROOT, 'calls-between-merged-files/sourceA.ts');
            const sourceB2 = path.join(DATA_ROOT, 'calls-between-merged-files/sourceB2.ts');
            // Skip the full B generated script via launch config
            const skipFiles = ['**/out/sourceB1.js'];
            const bpLineA = 8;
            yield dc.hitBreakpoint({ program, sourceMaps: true, skipFiles }, { path: sourceA, line: bpLineA });
            // Step in, verify B sources are skipped
            yield dc.stepInTo('step', { path: sourceA, line: 4 });
            yield dc.toggleSkipFileStatus(sourceB2);
            // Continue back to sourceA, step in, should skip B1 and land on B2
            yield dc.continueTo('breakpoint', { path: sourceA, line: bpLineA });
            yield dc.stepInTo('step', { path: sourceB2, line: 2 });
        }));
        test('when a non-sourcemapped script is skipped via regex, it can be unskipped', () => __awaiter(this, void 0, void 0, function* () {
            // Using this program, but run with sourcemaps disabled
            const program = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceA.js');
            const sourceB = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceB.js');
            // Skip the full B generated script via launch config
            const skipFiles = ['sourceB.js'];
            const bpLineA = 7;
            yield dc.hitBreakpoint({ program, sourceMaps: false, skipFiles }, { path: program, line: bpLineA });
            // Step in, verify B sources are skipped
            yield dc.stepInTo('step', { path: program, line: 4 });
            yield dc.toggleSkipFileStatus(sourceB);
            // Continue back to A, step in, should land in B
            yield dc.continueTo('breakpoint', { path: program, line: bpLineA });
            yield dc.stepInTo('step', { path: sourceB, line: 3 });
        }));
        test('can toggle skipping a non-sourcemapped file', () => __awaiter(this, void 0, void 0, function* () {
            // Using this program, but run with sourcemaps disabled
            const program = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceA.js');
            const sourceB = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceB.js');
            // Skip the full B generated script via launch config
            const bpLineA = 7;
            const stepLineB = 3;
            yield dc.hitBreakpoint({ program, sourceMaps: false }, { path: program, line: bpLineA });
            // Step in, verify B sources are not skipped
            yield dc.stepInTo('step', { path: sourceB, line: stepLineB });
            yield dc.toggleSkipFileStatus(sourceB);
            // Continue back to sourceA, step in, should skip B
            yield dc.continueTo('breakpoint', { path: program, line: bpLineA });
            yield dc.stepInTo('step', { path: program, line: 4 });
            yield dc.toggleSkipFileStatus(sourceB);
            // Continue back to A, step in, should not skip B
            yield dc.continueTo('breakpoint', { path: program, line: bpLineA });
            yield dc.stepInTo('step', { path: sourceB, line: stepLineB });
        }));
        test('when multiple generated scripts are skipped via one regex, one source can be un-skipped and re-skipped', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'calls-between-multiple-files/sourceA.ts');
            const sourceB2 = path.join(DATA_ROOT, 'calls-between-multiple-files/sourceB2.ts');
            // Skip both B scripts
            const bpLineA = 8;
            const skipFiles = ['sourceB*.js'];
            const outFiles = [path.join(DATA_ROOT, 'calls-between-multiple-files/out/**/*.js')];
            yield dc.hitBreakpoint({ program, skipFiles, outFiles }, { path: program, line: bpLineA });
            // Step in, verify B sources are skipped
            yield dc.stepInTo('step', { path: program, line: 4 });
            yield dc.toggleSkipFileStatus(sourceB2);
            // Continue back to A, step in, should land in B2, B1 still is skipped
            yield dc.continueTo('breakpoint', { path: program, line: bpLineA });
            yield dc.stepInTo('step', { path: sourceB2, line: 2 });
            // Re-skip B2
            yield dc.toggleSkipFileStatus(sourceB2);
            yield dc.continueTo('breakpoint', { path: program, line: bpLineA });
            yield dc.stepInTo('step', { path: program, line: 4 });
        }));
        test('can skip node internal files using <node_internals>', () => __awaiter(this, void 0, void 0, function* () {
            const program = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/out/sourceA.js');
            const programSource = path.join(DATA_ROOT, 'calls-between-sourcemapped-files/src/sourceA.ts');
            const timersSource = '<node_internals>/timers.js';
            const skipFiles = ['<node_internals>/*'];
            yield dc.hitBreakpoint({ program, skipFiles }, { path: programSource, line: 8 });
            const stackTraceResponse = yield dc.stackTraceRequest();
            // Assert that there are at least a few frames with paths marked with <node_internals>, and they are deemphasized
            const internalsFrames = stackTraceResponse.body.stackFrames.filter(frame => frame.source.path.startsWith('<node_internals>/'));
            assert(internalsFrames.length > 1);
            internalsFrames.forEach(frame => assert.equal(frame.source.presentationHint, 'deemphasize'));
            yield dc.stepOutTo('breakpoint', { path: programSource, line: 8 });
            // Unskip a node_internals file
            yield dc.toggleSkipFileStatus(timersSource);
            yield dc.stepOutTo('step', { path: timersSource });
        }));
    });
});

//# sourceMappingURL=stepping.test.js.map
