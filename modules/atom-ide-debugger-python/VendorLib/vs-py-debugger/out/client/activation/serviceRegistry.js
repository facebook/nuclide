// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../common/nuget/types");
const types_2 = require("../common/types");
const dataScienceSurveyBanner_1 = require("../datascience/dataScienceSurveyBanner");
const languageServerSurveyBanner_1 = require("../languageServices/languageServerSurveyBanner");
const proposeLanguageServerBanner_1 = require("../languageServices/proposeLanguageServerBanner");
const activationService_1 = require("./activationService");
const downloadChannelRules_1 = require("./downloadChannelRules");
const jedi_1 = require("./jedi");
const languageServer_1 = require("./languageServer/languageServer");
const languageServerFolderService_1 = require("./languageServer/languageServerFolderService");
const languageServerPackageRepository_1 = require("./languageServer/languageServerPackageRepository");
const languageServerPackageService_1 = require("./languageServer/languageServerPackageService");
const types_3 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_3.IExtensionActivationService, activationService_1.ExtensionActivationService);
    serviceManager.add(types_3.IExtensionActivator, jedi_1.JediExtensionActivator, types_3.ExtensionActivators.Jedi);
    serviceManager.add(types_3.IExtensionActivator, languageServer_1.LanguageServerExtensionActivator, types_3.ExtensionActivators.DotNet);
    serviceManager.addSingleton(types_2.IPythonExtensionBanner, languageServerSurveyBanner_1.LanguageServerSurveyBanner, types_2.BANNER_NAME_LS_SURVEY);
    serviceManager.addSingleton(types_2.IPythonExtensionBanner, proposeLanguageServerBanner_1.ProposeLanguageServerBanner, types_2.BANNER_NAME_PROPOSE_LS);
    serviceManager.addSingleton(types_2.IPythonExtensionBanner, dataScienceSurveyBanner_1.DataScienceSurveyBanner, types_2.BANNER_NAME_DS_SURVEY);
    serviceManager.addSingleton(types_3.ILanguageServerFolderService, languageServerFolderService_1.LanguageServerFolderService);
    serviceManager.addSingleton(types_3.ILanguageServerPackageService, languageServerPackageService_1.LanguageServerPackageService);
    serviceManager.addSingleton(types_1.INugetRepository, languageServerPackageRepository_1.StableLanguageServerPackageRepository, languageServerPackageRepository_1.LanguageServerDownloadChannel.stable);
    serviceManager.addSingleton(types_1.INugetRepository, languageServerPackageRepository_1.BetaLanguageServerPackageRepository, languageServerPackageRepository_1.LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton(types_1.INugetRepository, languageServerPackageRepository_1.DailyLanguageServerPackageRepository, languageServerPackageRepository_1.LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton(types_3.IDownloadChannelRule, downloadChannelRules_1.DownloadDailyChannelRule, languageServerPackageRepository_1.LanguageServerDownloadChannel.daily);
    serviceManager.addSingleton(types_3.IDownloadChannelRule, downloadChannelRules_1.DownloadBetaChannelRule, languageServerPackageRepository_1.LanguageServerDownloadChannel.beta);
    serviceManager.addSingleton(types_3.IDownloadChannelRule, downloadChannelRules_1.DownloadStableChannelRule, languageServerPackageRepository_1.LanguageServerDownloadChannel.stable);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map