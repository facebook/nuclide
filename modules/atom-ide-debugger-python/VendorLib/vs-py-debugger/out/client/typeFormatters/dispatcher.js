// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class OnTypeFormattingDispatcher {
    constructor(providers) {
        this.providers = providers;
    }
    provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken) {
        const provider = this.providers[ch];
        if (provider) {
            return provider.provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken);
        }
        return [];
    }
    getTriggerCharacters() {
        const keys = Object.keys(this.providers);
        keys.sort(); // Make output deterministic
        const first = keys.shift();
        if (first) {
            return {
                first: first,
                more: keys
            };
        }
        return undefined;
    }
}
exports.OnTypeFormattingDispatcher = OnTypeFormattingDispatcher;
//# sourceMappingURL=dispatcher.js.map