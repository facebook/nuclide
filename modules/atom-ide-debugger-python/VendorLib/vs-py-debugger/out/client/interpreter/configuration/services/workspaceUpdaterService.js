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
const path = require("path");
class WorkspacePythonPathUpdaterService {
    constructor(workspace, workspaceService) {
        this.workspace = workspace;
        this.workspaceService = workspaceService;
    }
    updatePythonPath(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonConfig = this.workspaceService.getConfiguration('python', this.workspace);
            const pythonPathValue = pythonConfig.inspect('pythonPath');
            if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
                return;
            }
            if (pythonPath.startsWith(this.workspace.fsPath)) {
                pythonPath = path.relative(this.workspace.fsPath, pythonPath);
            }
            yield pythonConfig.update('pythonPath', pythonPath, false);
        });
    }
}
exports.WorkspacePythonPathUpdaterService = WorkspacePythonPathUpdaterService;
//# sourceMappingURL=workspaceUpdaterService.js.map