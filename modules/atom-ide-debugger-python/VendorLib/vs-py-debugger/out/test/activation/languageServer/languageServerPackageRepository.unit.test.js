// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const typeMoq = require("typemoq");
const languageServerPackageRepository_1 = require("../../../client/activation/languageServer/languageServerPackageRepository");
suite('Language Server Download Channels', () => {
    let serviceContainer;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
    });
    function getPackageInfo(channel) {
        let classToCreate = languageServerPackageRepository_1.StableLanguageServerPackageRepository;
        switch (channel) {
            case languageServerPackageRepository_1.LanguageServerDownloadChannel.stable: {
                classToCreate = languageServerPackageRepository_1.StableLanguageServerPackageRepository;
                break;
            }
            case languageServerPackageRepository_1.LanguageServerDownloadChannel.beta: {
                classToCreate = languageServerPackageRepository_1.BetaLanguageServerPackageRepository;
                break;
            }
            case languageServerPackageRepository_1.LanguageServerDownloadChannel.daily: {
                classToCreate = languageServerPackageRepository_1.DailyLanguageServerPackageRepository;
                break;
            }
            default: {
                throw new Error('Unknown download channel');
            }
        }
        const instance = new class extends classToCreate {
            constructor() { super(serviceContainer.object); }
            get storageAccount() { return this.azureCDNBlobStorageAccount; }
            get storageContainer() { return this.azureBlobStorageContainer; }
        }();
        return [instance.storageAccount, instance.storageContainer];
    }
    test('Stable', () => {
        chai_1.expect(getPackageInfo(languageServerPackageRepository_1.LanguageServerDownloadChannel.stable)).to.be.deep.equal(['https://pvsc.azureedge.net', 'python-language-server-stable']);
    });
    test('Beta', () => {
        chai_1.expect(getPackageInfo(languageServerPackageRepository_1.LanguageServerDownloadChannel.beta)).to.be.deep.equal(['https://pvsc.azureedge.net', 'python-language-server-beta']);
    });
    test('Daily', () => {
        chai_1.expect(getPackageInfo(languageServerPackageRepository_1.LanguageServerDownloadChannel.daily)).to.be.deep.equal(['https://pvsc.azureedge.net', 'python-language-server-daily']);
    });
});
//# sourceMappingURL=languageServerPackageRepository.unit.test.js.map