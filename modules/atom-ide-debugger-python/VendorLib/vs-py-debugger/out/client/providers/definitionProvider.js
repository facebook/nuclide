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
class PythonDefinitionProvider {
    constructor(jediFactory) {
        this.jediFactory = jediFactory;
    }
    static parseData(data, possibleWord) {
        if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
            const definitions = data.definitions.filter(d => d.text === possibleWord);
            const definition = definitions.length > 0 ? definitions[0] : data.definitions[data.definitions.length - 1];
            const definitionResource = vscode.Uri.file(definition.fileName);
            const range = new vscode.Range(definition.range.startLine, definition.range.startColumn, definition.range.endLine, definition.range.endColumn);
            return new vscode.Location(definitionResource, range);
        }
        return null;
    }
    provideDefinition(document, position, token) {
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
            command: proxy.CommandType.Definitions,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        const possibleWord = document.getText(range);
        return this.jediFactory.getJediProxyHandler(document.uri).sendCommand(cmd, token).then(data => {
            return PythonDefinitionProvider.parseData(data, possibleWord);
        });
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.DEFINITION)
], PythonDefinitionProvider.prototype, "provideDefinition", null);
exports.PythonDefinitionProvider = PythonDefinitionProvider;
//# sourceMappingURL=definitionProvider.js.map