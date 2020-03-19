// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../../common/types");
const types_2 = require("../../ioc/types");
const codewatcher_1 = require("./codewatcher");
let DataScienceCodeLensProvider = class DataScienceCodeLensProvider {
    constructor(serviceContainer, configuration) {
        this.serviceContainer = serviceContainer;
        this.configuration = configuration;
        this.activeCodeWatchers = [];
    }
    // CodeLensProvider interface
    // Some implementation based on DonJayamanne's jupyter extension work
    provideCodeLenses(document, token) {
        // Don't provide any code lenses if we have not enabled data science
        const settings = this.configuration.getSettings();
        if (!settings.datascience.enabled) {
            // Clear out any existing code watchers, providecodelenses is called on settings change
            // so we don't need to watch the settings change specifically here
            if (this.activeCodeWatchers.length > 0) {
                this.activeCodeWatchers = [];
            }
            return [];
        }
        // See if we already have a watcher for this file and version
        const codeWatcher = this.matchWatcher(document.fileName, document.version);
        if (codeWatcher) {
            return codeWatcher.getCodeLenses();
        }
        // Create a new watcher for this file
        const newCodeWatcher = new codewatcher_1.CodeWatcher(this.serviceContainer, document);
        this.activeCodeWatchers.push(newCodeWatcher);
        return newCodeWatcher.getCodeLenses();
    }
    // IDataScienceCodeLensProvider interface
    getCodeWatcher(document) {
        return this.matchWatcher(document.fileName, document.version);
    }
    matchWatcher(fileName, version) {
        const index = this.activeCodeWatchers.findIndex(item => item.getFileName() === fileName);
        if (index >= 0) {
            const item = this.activeCodeWatchers[index];
            if (item.getVersion() === version) {
                return item;
            }
            // If we have an old version remove it from the active list
            this.activeCodeWatchers.splice(index, 1);
        }
        return undefined;
    }
};
DataScienceCodeLensProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer)),
    __param(1, inversify_1.inject(types_1.IConfigurationService))
], DataScienceCodeLensProvider);
exports.DataScienceCodeLensProvider = DataScienceCodeLensProvider;
//# sourceMappingURL=codelensprovider.js.map