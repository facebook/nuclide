"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const hostPlatform_1 = require("./hostPlatform");
const crypto_1 = require("./node/crypto");
class MessagingHelper {
    static getPath(projectRootPath) {
        /* We need to use a different value for each VS Code window so the pipe names won't clash.
           We create the pipe path hashing the user id + project root path so both client and server
           will generate the same path, yet it's unique for each vs code instance */
        const userID = hostPlatform_1.HostPlatform.getUserID();
        const normalizedRootPath = projectRootPath.toLowerCase();
        const uniqueSeed = `${userID}:${normalizedRootPath}`;
        const hash = new crypto_1.Crypto().hash(uniqueSeed);
        return hostPlatform_1.HostPlatform.getPipePath(`vscode-reactnative-${hash}`);
    }
}
exports.MessagingHelper = MessagingHelper;

//# sourceMappingURL=extensionMessaging.js.map
