"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const vscode_1 = require("vscode");
const configSettings_1 = require("../../../client/common/configSettings");
const decoder_1 = require("../../../client/common/process/decoder");
const proc_1 = require("../../../client/common/process/proc");
const async_1 = require("../../../client/common/utils/async");
const initialize_1 = require("./../../initialize");
chai_1.use(chaiAsPromised);
// tslint:disable-next-line:max-func-body-length
suite('ProcessService', () => {
    let pythonPath;
    suiteSetup(() => {
        pythonPath = configSettings_1.PythonSettings.getInstance().pythonPath;
        return initialize_1.initialize();
    });
    setup(initialize_1.initialize);
    teardown(initialize_1.initialize);
    test('execObservable should stream output with new lines', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(10000);
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(2)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(2)',
            'print("3")', 'sys.stdout.flush()', 'time.sleep(2)'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = ['1', '2', '3'];
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            // Ignore line breaks.
            if (output.out.trim().length === 0) {
                return;
            }
            const expectedValue = outputs.shift();
            if (expectedValue !== output.out.trim() && expectedValue === output.out) {
                done(`Received value ${output.out} is not same as the expectd value ${expectedValue}`);
            }
            if (output.source !== 'stdout') {
                done(`Source is not stdout. Value received is ${output.source}`);
            }
        }, done, done);
    });
    test('execObservable should stream output without new lines', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(10000);
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'sys.stdout.write("1")', 'sys.stdout.flush()', 'time.sleep(2)',
            'sys.stdout.write("2")', 'sys.stdout.flush()', 'time.sleep(2)',
            'sys.stdout.write("3")', 'sys.stdout.flush()', 'time.sleep(2)'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = ['1', '2', '3'];
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            // Ignore line breaks.
            if (output.out.trim().length === 0) {
                return;
            }
            const expectedValue = outputs.shift();
            if (expectedValue !== output.out) {
                done(`Received value ${output.out} is not same as the expectd value ${expectedValue}`);
            }
            if (output.source !== 'stdout') {
                done(`Source is not stdout. Value received is ${output.source}`);
            }
        }, done, done);
    });
    test('execObservable should end when cancellationToken is cancelled', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(10)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(2)'];
        const cancellationToken = new vscode_1.CancellationTokenSource();
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { token: cancellationToken.token });
        const def = async_1.createDeferred();
        def.promise.then(done).catch(done);
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            if (value === '1') {
                cancellationToken.cancel();
            }
            else {
                if (!def.completed) {
                    def.reject('Output received when we shouldn\'t have.');
                }
            }
        }, done, () => {
            if (def.completed) {
                return;
            }
            if (cancellationToken.token.isCancellationRequested) {
                def.resolve();
            }
            else {
                def.reject('Program terminated even before cancelling it.');
            }
        });
    });
    test('execObservable should end when process is killed', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(15000);
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(10)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(2)'];
        const cancellationToken = new vscode_1.CancellationTokenSource();
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { token: cancellationToken.token });
        let procKilled = false;
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            // Ignore line breaks.
            if (value.length === 0) {
                return;
            }
            if (value === '1') {
                procKilled = true;
                result.proc.kill();
            }
            else {
                done('Output received when we shouldn\'t have.');
            }
        }, done, () => {
            const errorMsg = procKilled ? undefined : 'Program terminated even before killing it.';
            done(errorMsg);
        });
    });
    test('execObservable should stream stdout and stderr separately', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(20000);
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(2)',
            'sys.stderr.write("a")', 'sys.stderr.flush()', 'time.sleep(2)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(2)',
            'sys.stderr.write("b")', 'sys.stderr.flush()', 'time.sleep(2)',
            'print("3")', 'sys.stdout.flush()', 'time.sleep(2)',
            'sys.stderr.write("c")', 'sys.stderr.flush()', 'time.sleep(2)'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')]);
        const outputs = [
            { out: '1', source: 'stdout' }, { out: 'a', source: 'stderr' },
            { out: '2', source: 'stdout' }, { out: 'b', source: 'stderr' },
            { out: '3', source: 'stdout' }, { out: 'c', source: 'stderr' }
        ];
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            // Ignore line breaks.
            if (value.length === 0) {
                return;
            }
            const expectedOutput = outputs.shift();
            chai_1.expect(value).to.be.equal(expectedOutput.out, 'Expected output is incorrect');
            chai_1.expect(output.source).to.be.equal(expectedOutput.source, 'Expected sopurce is incorrect');
        }, done, done);
    });
    test('execObservable should send stdout and stderr streams separately', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(7000);
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("a")', 'sys.stderr.flush()', 'time.sleep(1)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("b")', 'sys.stderr.flush()', 'time.sleep(1)',
            'print("3")', 'sys.stdout.flush()', 'time.sleep(1)',
            'sys.stderr.write("c")', 'sys.stderr.flush()', 'time.sleep(1)'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { mergeStdOutErr: true });
        const outputs = [
            { out: '1', source: 'stdout' }, { out: 'a', source: 'stderr' },
            { out: '2', source: 'stdout' }, { out: 'b', source: 'stderr' },
            { out: '3', source: 'stdout' }, { out: 'c', source: 'stderr' }
        ];
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(output => {
            const value = output.out.trim();
            // Ignore line breaks.
            if (value.length === 0) {
                return;
            }
            const expectedOutput = outputs.shift();
            chai_1.expect(value).to.be.equal(expectedOutput.out, 'Expected output is incorrect');
            chai_1.expect(output.source).to.be.equal(expectedOutput.source, 'Expected sopurce is incorrect');
        }, done, done);
    });
    test('execObservable should throw an error with stderr output', (done) => {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'sys.stderr.write("a")', 'sys.stderr.flush()'];
        const result = procService.execObservable(pythonPath, ['-c', pythonCode.join(';')], { throwOnStdErr: true });
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined.');
        result.out.subscribe(output => {
            done('Output received, when we\'re expecting an error to be thrown.');
        }, (ex) => {
            chai_1.expect(ex).to.have.property('message', 'a', 'Invalid error thrown');
            done();
        }, () => {
            done('Completed, when we\'re expecting an error to be thrown.');
        });
    });
    test('execObservable should throw an error when spawn file not found', (done) => {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const result = procService.execObservable(Date.now().toString(), []);
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined.');
        result.out.subscribe(output => {
            done('Output received, when we\'re expecting an error to be thrown.');
        }, ex => {
            chai_1.expect(ex).to.have.property('code', 'ENOENT', 'Invalid error code');
            done();
        }, () => {
            done('Completed, when we\'re expecting an error to be thrown.');
        });
    });
    test('execObservable should exit without no output', (done) => {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const result = procService.execObservable(pythonPath, ['-c', 'import sys', 'sys.exit()']);
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined.');
        result.out.subscribe(output => {
            done(`Output received, when we\'re not expecting any, ${JSON.stringify(output)}`);
        }, done, done);
    });
});
//# sourceMappingURL=proc.observable.test.js.map