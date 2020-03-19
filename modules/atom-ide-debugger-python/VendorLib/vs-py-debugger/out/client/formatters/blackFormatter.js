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
const vscode = require("vscode");
const productInstaller_1 = require("../common/installer/productInstaller");
const types_1 = require("../common/types");
const stopWatch_1 = require("../common/utils/stopWatch");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const baseFormatter_1 = require("./baseFormatter");
class BlackFormatter extends baseFormatter_1.BaseFormatter {
    constructor(serviceContainer) {
        super('black', productInstaller_1.Product.black, serviceContainer);
    }
    formatDocument(document, options, token, range) {
        const stopWatch = new stopWatch_1.StopWatch();
        const settings = this.serviceContainer.get(types_1.IConfigurationService).getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.blackArgs) && settings.formatting.blackArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;
        if (formatSelection) {
            const errorMessage = () => __awaiter(this, void 0, void 0, function* () {
                // Black does not support partial formatting on purpose.
                yield vscode.window.showErrorMessage('Black does not support the "Format Selection" command');
                return [];
            });
            return errorMessage();
        }
        const blackArgs = ['--diff', '--quiet'];
        const promise = super.provideDocumentFormattingEdits(document, options, token, blackArgs);
        telemetry_1.sendTelemetryWhenDone(constants_1.FORMAT, promise, stopWatch, { tool: 'black', hasCustomArgs, formatSelection });
        return promise;
    }
}
exports.BlackFormatter = BlackFormatter;
//# sourceMappingURL=blackFormatter.js.map