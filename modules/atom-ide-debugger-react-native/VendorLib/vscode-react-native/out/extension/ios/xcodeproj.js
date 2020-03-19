"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fileSystem_1 = require("../../common/node/fileSystem");
class Xcodeproj {
    constructor({ nodeFileSystem = new fileSystem_1.FileSystem(), } = {}) {
        this.nodeFileSystem = nodeFileSystem;
    }
    findXcodeprojFile(projectRoot) {
        return this.nodeFileSystem
            .readDir(projectRoot)
            .then((files) => {
            const extensions = [".xcworkspace", ".xcodeproj"];
            const sorted = files.sort();
            const candidates = sorted.filter((file) => extensions.indexOf(path.extname(file)) !== -1).sort((a, b) => extensions.indexOf(path.extname(a)) - extensions.indexOf(path.extname(b)));
            if (candidates.length === 0) {
                throw new Error("Unable to find any xcodeproj or xcworkspace files.");
            }
            const bestCandidate = candidates[0];
            const fileName = path.join(projectRoot, bestCandidate);
            const fileType = path.extname(bestCandidate);
            const projectName = path.basename(bestCandidate, fileType);
            return {
                fileName,
                fileType,
                projectName,
            };
        });
    }
}
exports.Xcodeproj = Xcodeproj;

//# sourceMappingURL=xcodeproj.js.map
