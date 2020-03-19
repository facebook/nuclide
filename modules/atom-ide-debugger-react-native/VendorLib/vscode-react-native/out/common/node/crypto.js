"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
class Crypto {
    hash(data) {
        const hasher = crypto.createHash("sha256");
        hasher.update(data);
        return hasher.digest("hex");
    }
}
exports.Crypto = Crypto;

//# sourceMappingURL=crypto.js.map
