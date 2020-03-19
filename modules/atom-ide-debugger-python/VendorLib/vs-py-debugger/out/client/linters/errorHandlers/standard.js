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
const vscode_1 = require("vscode");
const types_1 = require("../types");
const baseErrorHandler_1 = require("./baseErrorHandler");
class StandardErrorHandler extends baseErrorHandler_1.BaseErrorHandler {
    constructor(product, outputChannel, serviceContainer) {
        super(product, outputChannel, serviceContainer);
    }
    handleError(error, resource, execInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof error === 'string' && error.indexOf('OSError: [Errno 2] No such file or directory: \'/') > 0) {
                return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : Promise.resolve(false);
            }
            const linterManager = this.serviceContainer.get(types_1.ILinterManager);
            const info = linterManager.getLinterInfo(execInfo.product);
            this.logger.logError(`There was an error in running the linter ${info.id}`, error);
            this.outputChannel.appendLine(`Linting with ${info.id} failed.`);
            this.outputChannel.appendLine(error.toString());
            this.displayLinterError(info.id, resource);
            return true;
        });
    }
    displayLinterError(linterId, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = `There was an error in running the linter '${linterId}'`;
            yield vscode_1.window.showErrorMessage(message, 'View Errors');
            this.outputChannel.show();
        });
    }
}
exports.StandardErrorHandler = StandardErrorHandler;
//# sourceMappingURL=standard.js.map