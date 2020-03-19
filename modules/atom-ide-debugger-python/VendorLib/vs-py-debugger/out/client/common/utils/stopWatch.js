// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class StopWatch {
    constructor() {
        this.started = Date.now();
    }
    get elapsedTime() {
        return Date.now() - this.started;
    }
    reset() {
        this.started = Date.now();
    }
}
exports.StopWatch = StopWatch;
//# sourceMappingURL=stopWatch.js.map