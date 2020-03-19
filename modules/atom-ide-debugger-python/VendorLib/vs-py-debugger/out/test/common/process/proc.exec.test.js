// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const vscode_1 = require("vscode");
const configSettings_1 = require("../../../client/common/configSettings");
const decoder_1 = require("../../../client/common/process/decoder");
const proc_1 = require("../../../client/common/process/proc");
const types_1 = require("../../../client/common/process/types");
const platform_1 = require("../../../client/common/utils/platform");
const common_1 = require("../../common");
const initialize_1 = require("./../../initialize");
chai_1.use(chaiAsPromised);
// tslint:disable-next-line:max-func-body-length
suite('ProcessService Observable', () => {
    let pythonPath;
    suiteSetup(() => {
        pythonPath = configSettings_1.PythonSettings.getInstance().pythonPath;
        return initialize_1.initialize();
    });
    setup(initialize_1.initialize);
    teardown(initialize_1.initialize);
    test('exec should output print statements', () => __awaiter(this, void 0, void 0, function* () {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const printOutput = '1234';
        const result = yield procService.exec(pythonPath, ['-c', `print("${printOutput}")`]);
        chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
        chai_1.expect(result.stdout.trim()).to.be.equal(printOutput, 'Invalid output');
        chai_1.expect(result.stderr).to.equal(undefined, 'stderr not undefined');
    }));
    test('exec should output print unicode characters', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 2.7 under
            // Windows. Tracked by #2546. (unicode under Py2.7 is tough!)
            if (common_1.isOs(platform_1.OSType.Windows) && (yield common_1.isPythonVersion('2.7'))) {
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            const printOutput = 'öä';
            const result = yield procService.exec(pythonPath, ['-c', `print("${printOutput}")`]);
            chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
            chai_1.expect(result.stdout.trim()).to.be.equal(printOutput, 'Invalid output');
            chai_1.expect(result.stderr).to.equal(undefined, 'stderr not undefined');
        });
    });
    test('exec should wait for completion of program with new lines', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(5000);
            const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            const pythonCode = ['import sys', 'import time',
                'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
                'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
                'print("3")'];
            const result = yield procService.exec(pythonPath, ['-c', pythonCode.join(';')]);
            const outputs = ['1', '2', '3'];
            chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
            const values = result.stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            chai_1.expect(values).to.deep.equal(outputs, 'Output values are incorrect');
            chai_1.expect(result.stderr).to.equal(undefined, 'stderr not undefined');
        });
    });
    test('exec should wait for completion of program without new lines', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(5000);
            const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            const pythonCode = ['import sys', 'import time',
                'sys.stdout.write("1")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stdout.write("2")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stdout.write("3")'];
            const result = yield procService.exec(pythonPath, ['-c', pythonCode.join(';')]);
            const outputs = ['123'];
            chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
            const values = result.stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            chai_1.expect(values).to.deep.equal(outputs, 'Output values are incorrect');
            chai_1.expect(result.stderr).to.equal(undefined, 'stderr not undefined');
        });
    });
    test('exec should end when cancellationToken is cancelled', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(15000);
            const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            const pythonCode = ['import sys', 'import time',
                'print("1")', 'sys.stdout.flush()', 'time.sleep(10)',
                'print("2")', 'sys.stdout.flush()'];
            const cancellationToken = new vscode_1.CancellationTokenSource();
            setTimeout(() => cancellationToken.cancel(), 3000);
            const result = yield procService.exec(pythonPath, ['-c', pythonCode.join(';')], { token: cancellationToken.token });
            chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
            const values = result.stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            chai_1.expect(values).to.deep.equal(['1'], 'Output values are incorrect');
            chai_1.expect(result.stderr).to.equal(undefined, 'stderr not undefined');
        });
    });
    test('exec should stream stdout and stderr separately', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(7000);
            const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            const pythonCode = ['import sys', 'import time',
                'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stderr.write("a")', 'sys.stderr.flush()', 'time.sleep(1)',
                'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stderr.write("b")', 'sys.stderr.flush()', 'time.sleep(1)',
                'print("3")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stderr.write("c")', 'sys.stderr.flush()'];
            const result = yield procService.exec(pythonPath, ['-c', pythonCode.join(';')]);
            const expectedStdout = ['1', '2', '3'];
            const expectedStderr = ['abc'];
            chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
            const stdouts = result.stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            chai_1.expect(stdouts).to.deep.equal(expectedStdout, 'stdout values are incorrect');
            const stderrs = result.stderr.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            chai_1.expect(stderrs).to.deep.equal(expectedStderr, 'stderr values are incorrect');
        });
    });
    test('exec should merge stdout and stderr streams', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(7000);
            const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            const pythonCode = ['import sys', 'import time',
                'sys.stdout.write("1")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stderr.write("a")', 'sys.stderr.flush()', 'time.sleep(1)',
                'sys.stdout.write("2")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stderr.write("b")', 'sys.stderr.flush()', 'time.sleep(1)',
                'sys.stdout.write("3")', 'sys.stdout.flush()', 'time.sleep(1)',
                'sys.stderr.write("c")', 'sys.stderr.flush()'];
            const result = yield procService.exec(pythonPath, ['-c', pythonCode.join(';')], { mergeStdOutErr: true });
            const expectedOutput = ['1a2b3c'];
            chai_1.expect(result).not.to.be.an('undefined', 'result is undefined');
            const outputs = result.stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
            chai_1.expect(outputs).to.deep.equal(expectedOutput, 'Output values are incorrect');
        });
    });
    test('exec should throw an error with stderr output', () => __awaiter(this, void 0, void 0, function* () {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const pythonCode = ['import sys', 'sys.stderr.write("a")', 'sys.stderr.flush()'];
        const result = procService.exec(pythonPath, ['-c', pythonCode.join(';')], { throwOnStdErr: true });
        yield chai_1.expect(result).to.eventually.be.rejectedWith(types_1.StdErrError, 'a', 'Expected error to be thrown');
    }));
    test('exec should throw an error when spawn file not found', () => __awaiter(this, void 0, void 0, function* () {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const result = procService.exec(Date.now().toString(), []);
        yield chai_1.expect(result).to.eventually.be.rejected.and.to.have.property('code', 'ENOENT', 'Invalid error code');
    }));
    test('exec should exit without no output', () => __awaiter(this, void 0, void 0, function* () {
        const procService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        const result = yield procService.exec(pythonPath, ['-c', 'import sys', 'sys.exit()']);
        chai_1.expect(result.stdout).equals('', 'stdout is invalid');
        chai_1.expect(result.stderr).equals(undefined, 'stderr is invalid');
    }));
});
//# sourceMappingURL=proc.exec.test.js.map