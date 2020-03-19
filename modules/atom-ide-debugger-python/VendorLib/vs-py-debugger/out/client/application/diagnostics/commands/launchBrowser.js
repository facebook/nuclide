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
const types_1 = require("../../../common/types");
const base_1 = require("./base");
class LaunchBrowserCommand extends base_1.BaseDiagnosticCommand {
    constructor(diagnostic, serviceContainer, url) {
        super(diagnostic);
        this.serviceContainer = serviceContainer;
        this.url = url;
    }
    invoke() {
        return __awaiter(this, void 0, void 0, function* () {
            const browser = this.serviceContainer.get(types_1.IBrowserService);
            return browser.launch(this.url);
        });
    }
}
exports.LaunchBrowserCommand = LaunchBrowserCommand;
//# sourceMappingURL=launchBrowser.js.map