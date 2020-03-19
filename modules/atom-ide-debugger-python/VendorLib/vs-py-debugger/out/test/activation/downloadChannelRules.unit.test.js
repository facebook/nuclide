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
const path = require("path");
const semver_1 = require("semver");
const typeMoq = require("typemoq");
const downloadChannelRules_1 = require("../../client/activation/downloadChannelRules");
const types_1 = require("../../client/common/types");
suite('Language Server Download Channel Rules', () => {
    [undefined, path.join('a', 'b')].forEach(currentFolderPath => {
        const currentFolder = currentFolderPath ? { path: currentFolderPath, version: new semver_1.SemVer('0.0.0') } : undefined;
        const testSuffix = ` (${currentFolderPath ? 'with' : 'without'} an existing Language Server Folder`;
        test(`Daily channel should always download ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const rule = new downloadChannelRules_1.DownloadDailyChannelRule();
            chai_1.expect(yield rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(true, 'invalid value');
        }));
        test(`Stable channel should be download only if folder doesn't exist ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const rule = new downloadChannelRules_1.DownloadStableChannelRule();
            const hasExistingLSFolder = currentFolderPath ? false : true;
            chai_1.expect(yield rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(hasExistingLSFolder, 'invalid value');
        }));
        suite('Betal channel', () => {
            let serviceContainer;
            let stateFactory;
            let state;
            setup(() => {
                serviceContainer = typeMoq.Mock.ofType();
                stateFactory = typeMoq.Mock.ofType();
                state = typeMoq.Mock.ofType();
                stateFactory
                    .setup(s => s.createGlobalPersistentState(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns(() => state.object)
                    .verifiable(typeMoq.Times.once());
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IPersistentStateFactory)))
                    .returns(() => stateFactory.object);
            });
            function setupStateValue(value) {
                state.setup(s => s.value)
                    .returns(() => value)
                    .verifiable(typeMoq.Times.atLeastOnce());
            }
            test(`Should be download only if not checked previously ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const rule = new downloadChannelRules_1.DownloadBetaChannelRule(serviceContainer.object);
                setupStateValue(true);
                chai_1.expect(yield rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(true, 'invalid value');
            }));
            test(`Should be download only if checked previously ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const rule = new downloadChannelRules_1.DownloadBetaChannelRule(serviceContainer.object);
                setupStateValue(false);
                const shouldDownload = currentFolderPath ? false : true;
                chai_1.expect(yield rule.shouldLookForNewLanguageServer(currentFolder)).to.be.equal(shouldDownload, 'invalid value');
            }));
        });
    });
});
//# sourceMappingURL=downloadChannelRules.unit.test.js.map