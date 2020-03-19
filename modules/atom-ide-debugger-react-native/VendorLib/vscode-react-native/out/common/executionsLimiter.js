"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
/* This class can be used to limit how often can some code be executed e.g. Max once every 10 seconds */
class ExecutionsLimiter {
    constructor() {
        this.executionToLastTimestamp = {};
    }
    execute(id, limitInSeconds, lambda) {
        const now = new Date().getTime();
        const lastExecution = this.executionToLastTimestamp[id] || 0;
        if (now - lastExecution >= limitInSeconds * 1000) {
            this.executionToLastTimestamp[id] = now;
            lambda();
        }
    }
}
exports.ExecutionsLimiter = ExecutionsLimiter;
class ExecutionsFilterBeforeTimestamp {
    constructor(delayInSeconds) {
        this.sinceWhenToStopFiltering = this.now() + delayInSeconds * ExecutionsFilterBeforeTimestamp.MILLISECONDS_IN_ONE_SECOND;
    }
    execute(lambda) {
        if (this.now() >= this.sinceWhenToStopFiltering) {
            lambda();
        }
    }
    now() {
        return new Date().getTime();
    }
}
ExecutionsFilterBeforeTimestamp.MILLISECONDS_IN_ONE_SECOND = 1000;
exports.ExecutionsFilterBeforeTimestamp = ExecutionsFilterBeforeTimestamp;

//# sourceMappingURL=executionsLimiter.js.map
