"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../../common/types");
class BaseErrorHandler {
    constructor(product, outputChannel, serviceContainer) {
        this.product = product;
        this.outputChannel = outputChannel;
        this.serviceContainer = serviceContainer;
        this.logger = this.serviceContainer.get(types_1.ILogger);
        this.installer = this.serviceContainer.get(types_1.IInstaller);
    }
    get nextHandler() {
        return this.handler;
    }
    setNextHandler(handler) {
        this.handler = handler;
    }
}
exports.BaseErrorHandler = BaseErrorHandler;
//# sourceMappingURL=baseErrorHandler.js.map