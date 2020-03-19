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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const types_1 = require("../../../common/application/types");
const types_2 = require("../../../common/platform/types");
const types_3 = require("../../../common/process/types");
const types_4 = require("../../../common/types");
const types_5 = require("../../../ioc/types");
const PSERVE_SCRIPT_FILE_NAME = 'pserve.py';
let ConfigurationProviderUtils = class ConfigurationProviderUtils {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.executionFactory = this.serviceContainer.get(types_3.IPythonExecutionFactory);
        this.fs = this.serviceContainer.get(types_2.IFileSystem);
        this.logger = this.serviceContainer.get(types_4.ILogger);
    }
    getPyramidStartupScriptFilePath(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const executionService = yield this.executionFactory.create({ resource });
                const output = yield executionService.exec(['-c', 'import pyramid;print(pyramid.__file__)'], { throwOnStdErr: true });
                const pserveFilePath = path.join(path.dirname(output.stdout.trim()), 'scripts', PSERVE_SCRIPT_FILE_NAME);
                return (yield this.fs.fileExists(pserveFilePath)) ? pserveFilePath : undefined;
            }
            catch (ex) {
                const message = 'Unable to locate \'pserve.py\' required for debugging of Pyramid applications.';
                this.logger.logError(message, ex);
                const app = this.serviceContainer.get(types_1.IApplicationShell);
                app.showErrorMessage(message);
                return;
            }
        });
    }
};
ConfigurationProviderUtils = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_5.IServiceContainer))
], ConfigurationProviderUtils);
exports.ConfigurationProviderUtils = ConfigurationProviderUtils;
//# sourceMappingURL=configurationProviderUtils.js.map