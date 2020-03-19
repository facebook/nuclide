'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const vscode_1 = require("vscode");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const proxy = require("./jediProxy");
const providerUtilities_1 = require("./providerUtilities");
const DOCSTRING_PARAM_PATTERNS = [
    '\\s*:type\\s*PARAMNAME:\\s*([^\\n, ]+)',
    '\\s*:param\\s*(\\w?)\\s*PARAMNAME:[^\\n]+',
    '\\s*@type\\s*PARAMNAME:\\s*([^\\n, ]+)' // Epydoc
];
/**
 * Extract the documentation for parameters from a given docstring.
 * @param {string} paramName Name of the parameter
 * @param {string} docString The docstring for the function
 * @returns {string} Docstring for the parameter
 */
function extractParamDocString(paramName, docString) {
    let paramDocString = '';
    // In docstring the '*' is escaped with a backslash
    paramName = paramName.replace(new RegExp('\\*', 'g'), '\\\\\\*');
    DOCSTRING_PARAM_PATTERNS.forEach(pattern => {
        if (paramDocString.length > 0) {
            return;
        }
        pattern = pattern.replace('PARAMNAME', paramName);
        const regExp = new RegExp(pattern);
        const matches = regExp.exec(docString);
        if (matches && matches.length > 0) {
            paramDocString = matches[0];
            if (paramDocString.indexOf(':') >= 0) {
                paramDocString = paramDocString.substring(paramDocString.indexOf(':') + 1);
            }
            if (paramDocString.indexOf(':') >= 0) {
                paramDocString = paramDocString.substring(paramDocString.indexOf(':') + 1);
            }
        }
    });
    return paramDocString.trim();
}
class PythonSignatureProvider {
    constructor(jediFactory) {
        this.jediFactory = jediFactory;
    }
    static parseData(data) {
        if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
            const signature = new vscode_1.SignatureHelp();
            signature.activeSignature = 0;
            data.definitions.forEach(def => {
                signature.activeParameter = def.paramindex;
                // Don't display the documentation, as vs code doesn't format the documentation.
                // i.e. line feeds are not respected, long content is stripped.
                // Some functions do not come with parameter docs
                let label;
                let documentation;
                const validParamInfo = def.params && def.params.length > 0 && def.docstring && def.docstring.startsWith(`${def.name}(`);
                if (validParamInfo) {
                    const docLines = def.docstring.splitLines();
                    label = docLines.shift().trim();
                    documentation = docLines.join(os_1.EOL).trim();
                }
                else {
                    if (def.params && def.params.length > 0) {
                        label = `${def.name}(${def.params.map(p => p.name).join(', ')})`;
                        documentation = def.docstring;
                    }
                    else {
                        label = def.description;
                        documentation = def.docstring;
                    }
                }
                // tslint:disable-next-line:no-object-literal-type-assertion
                const sig = {
                    label,
                    documentation,
                    parameters: []
                };
                if (def.params && def.params.length) {
                    sig.parameters = def.params.map(arg => {
                        if (arg.docstring.length === 0) {
                            arg.docstring = extractParamDocString(arg.name, def.docstring);
                        }
                        // tslint:disable-next-line:no-object-literal-type-assertion
                        return {
                            documentation: arg.docstring.length > 0 ? arg.docstring : arg.description,
                            label: arg.name.trim()
                        };
                    });
                }
                signature.signatures.push(sig);
            });
            return signature;
        }
        return new vscode_1.SignatureHelp();
    }
    provideSignatureHelp(document, position, token) {
        // early exit if we're in a string or comment (or in an undefined position)
        if (position.character <= 0 ||
            providerUtilities_1.isPositionInsideStringOrComment(document, position)) {
            return Promise.resolve(new vscode_1.SignatureHelp());
        }
        const cmd = {
            command: proxy.CommandType.Arguments,
            fileName: document.fileName,
            columnIndex: position.character,
            lineIndex: position.line,
            source: document.getText()
        };
        return this.jediFactory.getJediProxyHandler(document.uri).sendCommand(cmd, token).then(data => {
            return data ? PythonSignatureProvider.parseData(data) : new vscode_1.SignatureHelp();
        });
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.SIGNATURE)
], PythonSignatureProvider.prototype, "provideSignatureHelp", null);
exports.PythonSignatureProvider = PythonSignatureProvider;
//# sourceMappingURL=signatureProvider.js.map