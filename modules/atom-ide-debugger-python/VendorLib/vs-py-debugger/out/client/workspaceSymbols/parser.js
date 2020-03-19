"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const fs_1 = require("../common/utils/fs");
// tslint:disable:no-require-imports no-var-requires no-suspicious-comment
// TODO: Turn these into imports.
const LineByLineReader = require('line-by-line');
const NamedRegexp = require('named-js-regexp');
const fuzzy = require('fuzzy');
const IsFileRegEx = /\tkind:file\tline:\d+$/g;
const LINE_REGEX = '(?<name>\\w+)\\t(?<file>.*)\\t\\/\\^(?<code>.*)\\$\\/;"\\tkind:(?<type>\\w+)\\tline:(?<line>\\d+)$';
function matchNamedRegEx(data, regex) {
    const compiledRegexp = NamedRegexp(regex, 'g');
    const rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return rawMatch.groups();
    }
    return null;
}
exports.matchNamedRegEx = matchNamedRegEx;
const CTagKinMapping = new Map();
CTagKinMapping.set('_array', vscode.SymbolKind.Array);
CTagKinMapping.set('_boolean', vscode.SymbolKind.Boolean);
CTagKinMapping.set('_class', vscode.SymbolKind.Class);
CTagKinMapping.set('_classes', vscode.SymbolKind.Class);
CTagKinMapping.set('_constant', vscode.SymbolKind.Constant);
CTagKinMapping.set('_constants', vscode.SymbolKind.Constant);
CTagKinMapping.set('_constructor', vscode.SymbolKind.Constructor);
CTagKinMapping.set('_enum', vscode.SymbolKind.Enum);
CTagKinMapping.set('_enums', vscode.SymbolKind.Enum);
CTagKinMapping.set('_enumeration', vscode.SymbolKind.Enum);
CTagKinMapping.set('_enumerations', vscode.SymbolKind.Enum);
CTagKinMapping.set('_field', vscode.SymbolKind.Field);
CTagKinMapping.set('_fields', vscode.SymbolKind.Field);
CTagKinMapping.set('_file', vscode.SymbolKind.File);
CTagKinMapping.set('_files', vscode.SymbolKind.File);
CTagKinMapping.set('_function', vscode.SymbolKind.Function);
CTagKinMapping.set('_functions', vscode.SymbolKind.Function);
CTagKinMapping.set('_member', vscode.SymbolKind.Function);
CTagKinMapping.set('_interface', vscode.SymbolKind.Interface);
CTagKinMapping.set('_interfaces', vscode.SymbolKind.Interface);
CTagKinMapping.set('_key', vscode.SymbolKind.Key);
CTagKinMapping.set('_keys', vscode.SymbolKind.Key);
CTagKinMapping.set('_method', vscode.SymbolKind.Method);
CTagKinMapping.set('_methods', vscode.SymbolKind.Method);
CTagKinMapping.set('_module', vscode.SymbolKind.Module);
CTagKinMapping.set('_modules', vscode.SymbolKind.Module);
CTagKinMapping.set('_namespace', vscode.SymbolKind.Namespace);
CTagKinMapping.set('_namespaces', vscode.SymbolKind.Namespace);
CTagKinMapping.set('_number', vscode.SymbolKind.Number);
CTagKinMapping.set('_numbers', vscode.SymbolKind.Number);
CTagKinMapping.set('_null', vscode.SymbolKind.Null);
CTagKinMapping.set('_object', vscode.SymbolKind.Object);
CTagKinMapping.set('_package', vscode.SymbolKind.Package);
CTagKinMapping.set('_packages', vscode.SymbolKind.Package);
CTagKinMapping.set('_property', vscode.SymbolKind.Property);
CTagKinMapping.set('_properties', vscode.SymbolKind.Property);
CTagKinMapping.set('_objects', vscode.SymbolKind.Object);
CTagKinMapping.set('_string', vscode.SymbolKind.String);
CTagKinMapping.set('_variable', vscode.SymbolKind.Variable);
CTagKinMapping.set('_variables', vscode.SymbolKind.Variable);
CTagKinMapping.set('_projects', vscode.SymbolKind.Package);
CTagKinMapping.set('_defines', vscode.SymbolKind.Module);
CTagKinMapping.set('_labels', vscode.SymbolKind.Interface);
CTagKinMapping.set('_macros', vscode.SymbolKind.Function);
CTagKinMapping.set('_types (structs and records)', vscode.SymbolKind.Class);
CTagKinMapping.set('_subroutine', vscode.SymbolKind.Method);
CTagKinMapping.set('_subroutines', vscode.SymbolKind.Method);
CTagKinMapping.set('_types', vscode.SymbolKind.Class);
CTagKinMapping.set('_programs', vscode.SymbolKind.Class);
CTagKinMapping.set('_Object\'s method', vscode.SymbolKind.Method);
CTagKinMapping.set('_Module or functor', vscode.SymbolKind.Module);
CTagKinMapping.set('_Global variable', vscode.SymbolKind.Variable);
CTagKinMapping.set('_Type name', vscode.SymbolKind.Class);
CTagKinMapping.set('_A function', vscode.SymbolKind.Function);
CTagKinMapping.set('_A constructor', vscode.SymbolKind.Constructor);
CTagKinMapping.set('_An exception', vscode.SymbolKind.Class);
CTagKinMapping.set('_A \'structure\' field', vscode.SymbolKind.Field);
CTagKinMapping.set('_procedure', vscode.SymbolKind.Function);
CTagKinMapping.set('_procedures', vscode.SymbolKind.Function);
CTagKinMapping.set('_constant definitions', vscode.SymbolKind.Constant);
CTagKinMapping.set('_javascript functions', vscode.SymbolKind.Function);
CTagKinMapping.set('_singleton methods', vscode.SymbolKind.Method);
const newValuesAndKeys = {};
CTagKinMapping.forEach((value, key) => {
    newValuesAndKeys[key.substring(1)] = value;
});
Object.keys(newValuesAndKeys).forEach(key => {
    CTagKinMapping.set(key, newValuesAndKeys[key]);
});
function parseTags(workspaceFolder, tagFile, query, token, maxItems = 200) {
    return fs_1.fsExistsAsync(tagFile).then(exists => {
        if (!exists) {
            return Promise.resolve([]);
        }
        return new Promise((resolve, reject) => {
            const lr = new LineByLineReader(tagFile);
            let lineNumber = 0;
            const tags = [];
            lr.on('error', (err) => {
                reject(err);
            });
            lr.on('line', (line) => {
                lineNumber = lineNumber + 1;
                if (token.isCancellationRequested) {
                    lr.close();
                    return;
                }
                const tag = parseTagsLine(workspaceFolder, line, query);
                if (tag) {
                    tags.push(tag);
                }
                if (tags.length >= 100) {
                    lr.close();
                }
            });
            lr.on('end', () => {
                resolve(tags);
            });
        });
    });
}
exports.parseTags = parseTags;
function parseTagsLine(workspaceFolder, line, searchPattern) {
    if (IsFileRegEx.test(line)) {
        return;
    }
    const match = matchNamedRegEx(line, LINE_REGEX);
    if (!match) {
        return;
    }
    if (!fuzzy.test(searchPattern, match.name)) {
        return;
    }
    let file = match.file;
    if (!path.isAbsolute(file)) {
        file = path.resolve(workspaceFolder, '.vscode', file);
    }
    const symbolKind = CTagKinMapping.get(match.type) || vscode.SymbolKind.Null;
    return {
        fileName: file,
        code: match.code,
        position: new vscode.Position(Number(match.line) - 1, 0),
        symbolName: match.name,
        symbolKind: symbolKind
    };
}
//# sourceMappingURL=parser.js.map