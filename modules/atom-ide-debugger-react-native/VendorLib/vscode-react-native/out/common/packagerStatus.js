"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const request_1 = require("./node/request");
function ensurePackagerRunning(packagerAddress, packagerPort, error) {
    let statusURL = `http://${packagerAddress}:${packagerPort}/status`;
    return request_1.Request.request(statusURL, true)
        .then((body) => {
        return (body === "packager-status:running") ?
            Q.resolve(void 0) :
            Q.reject();
    })
        .catch(() => {
        return Q.reject(error);
    });
}
exports.ensurePackagerRunning = ensurePackagerRunning;

//# sourceMappingURL=packagerStatus.js.map
