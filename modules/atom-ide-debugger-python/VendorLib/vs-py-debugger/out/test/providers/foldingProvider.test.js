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
const path = require("path");
const vscode_1 = require("vscode");
const docStringFoldingProvider_1 = require("../../client/providers/docStringFoldingProvider");
const pythonFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'folding');
// tslint:disable-next-line:max-func-body-length
suite('Provider - Folding Provider', () => {
    const docStringFileAndExpectedFoldingRanges = [
        {
            file: path.join(pythonFilesPath, 'attach_server.py'), ranges: [
                new vscode_1.FoldingRange(0, 14), new vscode_1.FoldingRange(44, 73, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(95, 143), new vscode_1.FoldingRange(149, 150, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(305, 313), new vscode_1.FoldingRange(320, 322)
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_ipython_repl.py'), ranges: [
                new vscode_1.FoldingRange(0, 14), new vscode_1.FoldingRange(78, 79, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(81, 82, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(92, 93, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(108, 109, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(139, 140, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(169, 170, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(275, 277, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(319, 320, vscode_1.FoldingRangeKind.Comment)
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_py_debugger.py'), ranges: [
                new vscode_1.FoldingRange(0, 15, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(22, 25, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(47, 48, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(69, 70, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(96, 97, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(105, 106, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(141, 142, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(149, 162, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(165, 166, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(207, 208, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(235, 237, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(240, 241, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(300, 301, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(334, 335, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(346, 348, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(499, 500, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(558, 559, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(602, 604, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(608, 609, vscode_1.FoldingRangeKind.Comment), new vscode_1.FoldingRange(612, 614, vscode_1.FoldingRangeKind.Comment),
                new vscode_1.FoldingRange(637, 638, vscode_1.FoldingRangeKind.Comment)
            ]
        },
        {
            file: path.join(pythonFilesPath, 'visualstudio_py_repl.py'), ranges: []
        }
    ];
    docStringFileAndExpectedFoldingRanges.forEach(item => {
        test(`Test Docstring folding regions '${path.basename(item.file)}'`, () => __awaiter(this, void 0, void 0, function* () {
            const document = yield vscode_1.workspace.openTextDocument(item.file);
            const provider = new docStringFoldingProvider_1.DocStringFoldingProvider();
            const ranges = yield provider.provideFoldingRanges(document, {}, new vscode_1.CancellationTokenSource().token);
            chai_1.expect(ranges).to.be.lengthOf(item.ranges.length);
            ranges.forEach(range => {
                const index = item.ranges
                    .findIndex(searchItem => searchItem.start === range.start &&
                    searchItem.end === range.end);
                chai_1.expect(index).to.be.greaterThan(-1, `${range.start}, ${range.end} not found`);
            });
        }));
    });
});
//# sourceMappingURL=foldingProvider.test.js.map