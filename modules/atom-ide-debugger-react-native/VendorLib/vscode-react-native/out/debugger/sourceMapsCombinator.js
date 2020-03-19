"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="./../typings/debugger/sourceMapsCombinator.d.ts" />
const fs = require("fs");
const path = require("path");
const source_map_1 = require("source-map");
const sourceMapResolve = require("source-map-resolve");
const DISK_LETTER_RE = /^(?:[a-z]{2,}:\/\/\/)?[a-z]:/i;
class SourceMapsCombinator {
    convert(rawBundleSourcemap) {
        // Find user files from bundle files list
        const consumers = rawBundleSourcemap.sources
            .reduce((result, file) => {
            // Skip files inside node_modules
            if (file.indexOf("node_modules") >= 0)
                return result;
            try {
                let consumer = this.getSourceMapConsumerFrom(file);
                if (consumer)
                    result[file] = consumer;
            }
            finally {
                return result;
            }
        }, {});
        if (Object.keys(consumers).length === 0) {
            // Sourcemaps not found, so return original bundle sourcemap
            return rawBundleSourcemap;
        }
        const generator = new source_map_1.SourceMapGenerator();
        const bundleConsumer = new source_map_1.SourceMapConsumer(rawBundleSourcemap);
        bundleConsumer.eachMapping((item) => {
            if (item.source === null) {
                // Some mappings in react native bundle have no sources
                return;
            }
            // Copy mappings
            let mapping = {
                generated: { line: item.generatedLine, column: item.generatedColumn },
                original: { line: item.originalLine, column: item.originalColumn },
                source: item.source,
                name: item.name,
            };
            if (consumers[item.source]) {
                let jsPosition = { line: item.originalLine, column: item.originalColumn };
                let tsPosition = consumers[item.source].originalPositionFor(jsPosition);
                if (tsPosition.source === null) {
                    // Some positions from react native generated bundle can not translate to TS source positions
                    // skip them
                    return;
                }
                // Resolve TS source path to absolute because it might be relative to generated JS
                // (this depends on whether "sourceRoot" option is specified in tsconfig.json)
                if (!tsPosition.source.match(DISK_LETTER_RE)) {
                    tsPosition.source = path.resolve(rawBundleSourcemap.sourceRoot, path.dirname(item.source), tsPosition.source);
                }
                // Update mapping w/ mapped position values
                mapping.source = tsPosition.source;
                mapping.name = tsPosition.name || mapping.name;
                if (tsPosition.line !== null && tsPosition.column !== null) {
                    mapping.original = { line: tsPosition.line, column: tsPosition.column };
                }
            }
            try {
                generator.addMapping(mapping);
            }
            catch (err) {
            }
        });
        return generator.toJSON();
    }
    getSourceMapConsumerFrom(generatedFile) {
        let code = fs.readFileSync(generatedFile);
        let consumer = this.readSourcemap(generatedFile, code.toString());
        return consumer;
    }
    readSourcemap(file, code) {
        let result = sourceMapResolve.resolveSync(code, file, readFileSync.bind(null, getDiskLetter(file)));
        if (result === null) {
            return null;
        }
        return new source_map_1.SourceMapConsumer(result.map);
    }
}
exports.SourceMapsCombinator = SourceMapsCombinator;
// Hack for source-map-resolve and cutted disk letter
// https://github.com/lydell/source-map-resolve/issues/9
function readFileSync(diskLetter, filePath) {
    if (filePath.match(DISK_LETTER_RE)) {
        return fs.readFileSync(filePath);
    }
    else {
        return fs.readFileSync(`${diskLetter}${filePath}`);
    }
}
function getDiskLetter(filePath) {
    const matched = filePath.match(DISK_LETTER_RE);
    return matched ? matched[0] : "";
}

//# sourceMappingURL=sourceMapsCombinator.js.map
