"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const fs = require("fs-extra");
const path = require("path");
const TypeMoq = require("typemoq");
const fileSystem_1 = require("../../../client/common/platform/fileSystem");
// tslint:disable-next-line:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
chai_1.use(assertArrays);
// tslint:disable-next-line:max-func-body-length
suite('FileSystem', () => {
    let platformService;
    let fileSystem;
    const fileToAppendTo = path.join(__dirname, 'created_for_testing_dummy.txt');
    setup(() => {
        platformService = TypeMoq.Mock.ofType();
        fileSystem = new fileSystem_1.FileSystem(platformService.object);
        cleanTestFiles();
    });
    teardown(cleanTestFiles);
    function cleanTestFiles() {
        if (fs.existsSync(fileToAppendTo)) {
            fs.unlinkSync(fileToAppendTo);
        }
    }
    test('ReadFile returns contents of a file', () => __awaiter(this, void 0, void 0, function* () {
        const file = __filename;
        const expectedContents = yield fs.readFile(file).then(buffer => buffer.toString());
        const content = yield fileSystem.readFile(file);
        chai_1.expect(content).to.be.equal(expectedContents);
    }));
    test('ReadFile throws an exception if file does not exist', () => __awaiter(this, void 0, void 0, function* () {
        const readPromise = fs.readFile('xyz', { encoding: 'utf8' });
        yield chai_1.expect(readPromise).to.be.rejectedWith();
    }));
    function caseSensitivityFileCheck(isWindows, isOsx, isLinux) {
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isOsx);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';
        const path3 = 'c:\\USERS\\Peter Smith\\my documents\\test.exe';
        if (isWindows) {
            chai_1.expect(fileSystem.arePathsSame(path1, path2)).to.be.equal(true, 'file paths do not match (windows)');
        }
        else {
            chai_1.expect(fileSystem.arePathsSame(path1, path2)).to.be.equal(false, 'file match (non windows)');
        }
        chai_1.expect(fileSystem.arePathsSame(path1, path1)).to.be.equal(true, '1. file paths do not match');
        chai_1.expect(fileSystem.arePathsSame(path2, path2)).to.be.equal(true, '2. file paths do not match');
        chai_1.expect(fileSystem.arePathsSame(path1, path3)).to.be.equal(false, '2. file paths do not match');
    }
    test('Case sensitivity is ignored when comparing file names on windows', () => __awaiter(this, void 0, void 0, function* () {
        caseSensitivityFileCheck(true, false, false);
    }));
    test('Case sensitivity is not ignored when comparing file names on osx', () => __awaiter(this, void 0, void 0, function* () {
        caseSensitivityFileCheck(false, true, false);
    }));
    test('Case sensitivity is not ignored when comparing file names on linux', () => __awaiter(this, void 0, void 0, function* () {
        caseSensitivityFileCheck(false, false, true);
    }));
    test('Check existence of files synchronously', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(fileSystem.fileExistsSync(__filename)).to.be.equal(true, 'file not found');
    }));
    test('Test appending to file', () => __awaiter(this, void 0, void 0, function* () {
        const dataToAppend = `Some Data\n${new Date().toString()}\nAnd another line`;
        fileSystem.appendFileSync(fileToAppendTo, dataToAppend);
        const fileContents = yield fileSystem.readFile(fileToAppendTo);
        chai_1.expect(fileContents).to.be.equal(dataToAppend);
    }));
    test('Test searching for files', () => __awaiter(this, void 0, void 0, function* () {
        const files = yield fileSystem.search(path.join(__dirname, '*.js'));
        chai_1.expect(files).to.be.array();
        chai_1.expect(files.length).to.be.at.least(1);
        const expectedFileName = __filename.replace(/\\/g, '/');
        const fileName = files[0].replace(/\\/g, '/');
        chai_1.expect(fileName).to.equal(expectedFileName);
    }));
    test('Ensure creating a temporary file results in a unique temp file path', () => __awaiter(this, void 0, void 0, function* () {
        const tempFile = yield fileSystem.createTemporaryFile('.tmp');
        const tempFile2 = yield fileSystem.createTemporaryFile('.tmp');
        chai_1.expect(tempFile.filePath).to.not.equal(tempFile2.filePath, 'Temp files must be unique, implementation of createTemporaryFile is off.');
    }));
    test('Ensure writing to a temp file is supported via file stream', () => __awaiter(this, void 0, void 0, function* () {
        yield fileSystem.createTemporaryFile('.tmp').then((tf) => {
            chai_1.expect(tf).to.not.equal(undefined, 'Error trying to create a temporary file');
            const writeStream = fileSystem.createWriteStream(tf.filePath);
            writeStream.write('hello', 'utf8', (err) => {
                chai_1.expect(err).to.equal(undefined, `Failed to write to a temp file, error is ${err}`);
            });
        }, (failReason) => {
            chai_1.expect(failReason).to.equal('No errors occured', `Failed to create a temporary file with error ${failReason}`);
        });
    }));
    test('Ensure chmod works against a temporary file', () => __awaiter(this, void 0, void 0, function* () {
        yield fileSystem.createTemporaryFile('.tmp').then((fl) => __awaiter(this, void 0, void 0, function* () {
            yield fileSystem.chmod(fl.filePath, '7777').then((success) => {
                // cannot check for success other than we got here, chmod in Windows won't have any effect on the file itself.
            }, (failReason) => {
                chai_1.expect(failReason).to.equal('There was no error using chmod', `Failed to perform chmod operation successfully, got error ${failReason}`);
            });
        }));
    }));
});
//# sourceMappingURL=filesystem.unit.test.js.map