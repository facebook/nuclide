// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const base_1 = require("./base");
class IgnoreDiagnosticCommand extends base_1.BaseDiagnosticCommand {
    constructor(diagnostic, serviceContainer, scope) {
        super(diagnostic);
        this.serviceContainer = serviceContainer;
        this.scope = scope;
    }
    invoke() {
        const filter = this.serviceContainer.get(types_1.IDiagnosticFilterService);
        return filter.ignoreDiagnostic(this.diagnostic.code, this.scope);
    }
}
exports.IgnoreDiagnosticCommand = IgnoreDiagnosticCommand;
//# sourceMappingURL=ignore.js.map