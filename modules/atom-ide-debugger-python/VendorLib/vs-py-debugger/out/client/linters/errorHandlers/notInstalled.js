"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../../common/process/types");
const types_2 = require("../types");
const baseErrorHandler_1 = require("./baseErrorHandler");
class NotInstalledErrorHandler extends baseErrorHandler_1.BaseErrorHandler {
    constructor(product, outputChannel, serviceContainer) {
        super(product, outputChannel, serviceContainer);
    }
    handleError(error, resource, execInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonExecutionService = yield this.serviceContainer.get(types_1.IPythonExecutionFactory).create({ resource });
            const isModuleInstalled = yield pythonExecutionService.isModuleInstalled(execInfo.moduleName);
            if (isModuleInstalled) {
                return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : false;
            }
            this.installer.promptToInstall(this.product, resource)
                .catch(this.logger.logError.bind(this, 'NotInstalledErrorHandler.promptToInstall'));
            const linterManager = this.serviceContainer.get(types_2.ILinterManager);
            const info = linterManager.getLinterInfo(execInfo.product);
            const customError = `Linter '${info.id}' is not installed. Please install it or select another linter".`;
            this.outputChannel.appendLine(`\n${customError}\n${error}`);
            this.logger.logWarning(customError, error);
            return true;
        });
    }
}
exports.NotInstalledErrorHandler = NotInstalledErrorHandler;
//# sourceMappingURL=notInstalled.js.map