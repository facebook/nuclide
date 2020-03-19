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
const configSettings_1 = require("../../client/common/configSettings");
function enableDisableWorkspaceSymbols(resource, enabled, configTarget) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = vscode_1.workspace.getConfiguration('python', resource);
        yield settings.update('workspaceSymbols.enabled', enabled, configTarget);
        configSettings_1.PythonSettings.dispose();
    });
}
exports.enableDisableWorkspaceSymbols = enableDisableWorkspaceSymbols;
//# sourceMappingURL=common.js.map