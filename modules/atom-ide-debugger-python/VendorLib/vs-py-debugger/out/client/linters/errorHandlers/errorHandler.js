"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notInstalled_1 = require("./notInstalled");
const standard_1 = require("./standard");
class ErrorHandler {
    constructor(product, outputChannel, serviceContainer) {
        // Create chain of handlers.
        const standardErrorHandler = new standard_1.StandardErrorHandler(product, outputChannel, serviceContainer);
        this.handler = new notInstalled_1.NotInstalledErrorHandler(product, outputChannel, serviceContainer);
        this.handler.setNextHandler(standardErrorHandler);
    }
    handleError(error, resource, execInfo) {
        return this.handler.handleError(error, resource, execInfo);
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=errorHandler.js.map