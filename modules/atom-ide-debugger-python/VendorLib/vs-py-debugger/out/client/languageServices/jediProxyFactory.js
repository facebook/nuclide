"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const jediProxy_1 = require("../providers/jediProxy");
class JediFactory {
    constructor(extensionRootPath, serviceContainer) {
        this.extensionRootPath = extensionRootPath;
        this.serviceContainer = serviceContainer;
        this.disposables = [];
        this.jediProxyHandlers = new Map();
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
    getJediProxyHandler(resource) {
        const workspaceFolder = resource ? vscode_1.workspace.getWorkspaceFolder(resource) : undefined;
        let workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
        if (!workspacePath) {
            if (Array.isArray(vscode_1.workspace.workspaceFolders) && vscode_1.workspace.workspaceFolders.length > 0) {
                workspacePath = vscode_1.workspace.workspaceFolders[0].uri.fsPath;
            }
            else {
                workspacePath = __dirname;
            }
        }
        if (!this.jediProxyHandlers.has(workspacePath)) {
            const jediProxy = new jediProxy_1.JediProxy(this.extensionRootPath, workspacePath, this.serviceContainer);
            const jediProxyHandler = new jediProxy_1.JediProxyHandler(jediProxy);
            this.disposables.push(jediProxy, jediProxyHandler);
            this.jediProxyHandlers.set(workspacePath, jediProxyHandler);
        }
        // tslint:disable-next-line:no-non-null-assertion
        return this.jediProxyHandlers.get(workspacePath);
    }
}
exports.JediFactory = JediFactory;
//# sourceMappingURL=jediProxyFactory.js.map