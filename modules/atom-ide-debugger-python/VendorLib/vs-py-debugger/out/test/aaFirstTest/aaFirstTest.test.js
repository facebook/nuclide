"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const vscode_1 = require("vscode");
const constants_1 = require("../../client/common/constants");
const initialize_1 = require("../initialize");
// NOTE:
// We need this to be run first, as this ensures the extension activates.
// Sometimes it can take more than 25 seconds to complete (as the extension looks for interpeters, and the like).
// So lets wait for a max of 1 minute for the extension to activate (note, subsequent load times are faster).
suite('Activate Extension', () => {
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(60000);
            yield initialize_1.initialize();
        });
    });
    test('Python extension has activated', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(vscode_1.extensions.getExtension(constants_1.PVSC_EXTENSION_ID).isActive).to.equal(true, 'Extension has not been activated');
    }));
});
//# sourceMappingURL=aaFirstTest.test.js.map