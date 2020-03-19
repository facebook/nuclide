'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const proxy = require("./jediProxy");
class PythonReferenceProvider {
    constructor(jediFactory) {
        this.jediFactory = jediFactory;
    }
    static parseData(data) {
        if (data && data.references.length > 0) {
            // tslint:disable-next-line:no-unnecessary-local-variable
            const references = data.references.filter(ref => {
                if (!ref || typeof ref.columnIndex !== 'number' || typeof ref.lineIndex !== 'number'
                    || typeof ref.fileName !== 'string' || ref.columnIndex === -1 || ref.lineIndex === -1 || ref.fileName.length === 0) {
                    return false;
                }
                return true;
            }).map(ref => {
                const definitionResource = vscode.Uri.file(ref.fileName);
                const range = new vscode.Range(ref.lineIndex, ref.columnIndex, ref.lineIndex, ref.columnIndex);
                return new vscode.Location(definitionResource, range);
            });
            return references;
        }
        return [];
    }
    provideReferences(document, position, context, token) {
        const filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return Promise.resolve(null);
        }
        if (position.character <= 0) {
            return Promise.resolve(null);
        }
        const range = document.getWordRangeAtPosition(position);
        const columnIndex = range.isEmpty ? position.character : range.end.character;
        const cmd = {
            command: proxy.CommandType.Usages,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        return this.jediFactory.getJediProxyHandler(document.uri).sendCommand(cmd, token).then(data => {
            return PythonReferenceProvider.parseData(data);
        });
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.REFERENCE)
], PythonReferenceProvider.prototype, "provideReferences", null);
exports.PythonReferenceProvider = PythonReferenceProvider;
//# sourceMappingURL=referenceProvider.js.map