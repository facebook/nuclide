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
require("../../common/extensions");
const fs = require("fs-extra");
const path = require("path");
const vscode_1 = require("vscode");
const localize = require("../../common/utils/localize");
const types_1 = require("../types");
class WebPanel {
    constructor(serviceContainer, listener, title, mainScriptPath, embeddedCss) {
        this.disposableRegistry = serviceContainer.get(types_1.IDisposableRegistry);
        this.listener = listener;
        this.rootPath = path.dirname(mainScriptPath);
        this.panel = vscode_1.window.createWebviewPanel(title.toLowerCase().replace(' ', ''), title, { viewColumn: vscode_1.ViewColumn.Two, preserveFocus: true }, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode_1.Uri.file(this.rootPath)]
        });
        this.loadPromise = this.load(mainScriptPath, embeddedCss);
    }
    show() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadPromise;
            if (this.panel) {
                this.panel.reveal(vscode_1.ViewColumn.Two, true);
            }
        });
    }
    isVisible() {
        return this.panel ? this.panel.visible : false;
    }
    postMessage(message) {
        if (this.panel && this.panel.webview) {
            this.panel.webview.postMessage(message);
        }
    }
    load(mainScriptPath, embeddedCss) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.panel) {
                if (yield fs.pathExists(mainScriptPath)) {
                    // Call our special function that sticks this script inside of an html page
                    // and translates all of the paths to vscode-resource URIs
                    this.panel.webview.html = this.generateReactHtml(mainScriptPath, embeddedCss);
                    // Reset when the current panel is closed
                    this.disposableRegistry.push(this.panel.onDidDispose(() => {
                        this.panel = undefined;
                        this.listener.dispose();
                    }));
                    this.disposableRegistry.push(this.panel.webview.onDidReceiveMessage(message => {
                        // Pass the message onto our listener
                        this.listener.onMessage(message.type, message.payload);
                    }));
                }
                else {
                    // Indicate that we can't load the file path
                    const badPanelString = localize.DataScience.badWebPanelFormatString();
                    this.panel.webview.html = badPanelString.format(mainScriptPath);
                }
            }
        });
    }
    generateReactHtml(mainScriptPath, embeddedCss) {
        const uriBasePath = vscode_1.Uri.file(`${path.dirname(mainScriptPath)}/`);
        const uriPath = vscode_1.Uri.file(mainScriptPath);
        const uriBase = uriBasePath.with({ scheme: 'vscode-resource' });
        const uri = uriPath.with({ scheme: 'vscode-resource' });
        const locDatabase = JSON.stringify(localize.getCollection());
        const style = embeddedCss ? embeddedCss : '';
        return `<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta name="theme-color" content="#000000">
                <title>React App</title>
                <base href="${uriBase}"/>
                <style type="text/css">
                ${style}
                </style>
            </head>
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
                <script type="text/javascript">
                    function resolvePath(relativePath) {
                        if (relativePath && relativePath[0] == '.' && relativePath[1] != '.') {
                            return "${uriBase}" + relativePath.substring(1);
                        }

                        return "${uriBase}" + relativePath;
                    }
                    function getLocStrings() {
                        return ${locDatabase};
                    }
                </script>
            <script type="text/javascript" src="${uri}"></script></body>
        </html>`;
    }
}
exports.WebPanel = WebPanel;
//# sourceMappingURL=webPanel.js.map