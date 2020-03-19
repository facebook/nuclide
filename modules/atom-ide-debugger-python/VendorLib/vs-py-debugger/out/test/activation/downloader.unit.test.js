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
// tslint:disable:no-any
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const downloader_1 = require("../../client/activation/downloader");
const platformData_1 = require("../../client/activation/platformData");
const types_1 = require("../../client/activation/types");
const constants_1 = require("../../client/common/constants");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/types");
suite('Activation - Downloader', () => {
    let languageServerDownloader;
    let platformService;
    let container;
    let folderService;
    setup(() => {
        container = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        folderService = TypeMoq.Mock.ofType();
        const fs = TypeMoq.Mock.ofType();
        const output = TypeMoq.Mock.ofType();
        const platformData = new platformData_1.PlatformData(platformService.object, fs.object);
        container.setup(a => a.get(TypeMoq.It.isValue(types_3.IOutputChannel), TypeMoq.It.isValue(constants_1.STANDARD_OUTPUT_CHANNEL))).returns(() => output.object);
        container.setup(a => a.get(TypeMoq.It.isValue(types_2.IFileSystem))).returns(() => fs.object);
        container.setup(a => a.get(TypeMoq.It.isValue(types_1.ILanguageServerFolderService))).returns(() => folderService.object);
        languageServerDownloader = new downloader_1.LanguageServerDownloader(platformData, '', container.object);
    });
    test('Get download uri', () => __awaiter(this, void 0, void 0, function* () {
        const pkg = { uri: 'xyz' };
        folderService
            .setup(f => f.getLatestLanguageServerVersion())
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());
        const info = yield languageServerDownloader.getDownloadInfo();
        folderService.verifyAll();
        chai_1.expect(info).to.deep.equal(pkg);
    }));
});
//# sourceMappingURL=downloader.unit.test.js.map