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
const fs = require("fs-extra");
const path = require("path");
const restTextConverter_1 = require("../../client/common/markdown/restTextConverter");
const textUtils_1 = require("../textUtils");
const srcPythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'markdown');
function testConversion(fileName) {
    return __awaiter(this, void 0, void 0, function* () {
        const cvt = new restTextConverter_1.RestTextConverter();
        const file = path.join(srcPythoFilesPath, fileName);
        const source = yield fs.readFile(`${file}.pydoc`, 'utf8');
        const actual = cvt.toMarkdown(source);
        const expected = yield fs.readFile(`${file}.md`, 'utf8');
        textUtils_1.compareFiles(expected, actual);
    });
}
// tslint:disable-next-line:max-func-body-length
suite('Hover - RestTextConverter', () => {
    test('scipy', () => __awaiter(this, void 0, void 0, function* () { return yield testConversion('scipy'); }));
    test('scipy.spatial', () => __awaiter(this, void 0, void 0, function* () { return yield testConversion('scipy.spatial'); }));
    test('scipy.spatial.distance', () => __awaiter(this, void 0, void 0, function* () { return yield testConversion('scipy.spatial.distance'); }));
    test('anydbm', () => __awaiter(this, void 0, void 0, function* () { return yield testConversion('anydbm'); }));
    test('aifc', () => __awaiter(this, void 0, void 0, function* () { return yield testConversion('aifc'); }));
    test('astroid', () => __awaiter(this, void 0, void 0, function* () { return yield testConversion('astroid'); }));
});
//# sourceMappingURL=restTextConverter.test.js.map