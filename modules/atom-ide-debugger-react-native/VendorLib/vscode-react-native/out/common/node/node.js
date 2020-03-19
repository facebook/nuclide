"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const childProcess = require("./childProcess");
const file = require("./fileSystem");
var Node;
(function (Node) {
    Node.ChildProcess = childProcess.ChildProcess;
    Node.FileSystem = file.FileSystem;
})(Node = exports.Node || (exports.Node = {}));

//# sourceMappingURL=node.js.map
