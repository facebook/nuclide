// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.IExtensionActivationService = Symbol('IExtensionActivationService');
var ExtensionActivators;
(function (ExtensionActivators) {
    ExtensionActivators["Jedi"] = "Jedi";
    ExtensionActivators["DotNet"] = "DotNet";
})(ExtensionActivators = exports.ExtensionActivators || (exports.ExtensionActivators = {}));
exports.IExtensionActivator = Symbol('IExtensionActivator');
exports.IHttpClient = Symbol('IHttpClient');
exports.ILanguageServerFolderService = Symbol('ILanguageServerFolderService');
exports.ILanguageServerDownloader = Symbol('ILanguageServerDownloader');
exports.ILanguageServerPackageService = Symbol('ILanguageServerPackageService');
exports.MajorLanguageServerVersion = Symbol('MajorLanguageServerVersion');
exports.IDownloadChannelRule = Symbol('IDownloadChannelRule');
//# sourceMappingURL=types.js.map