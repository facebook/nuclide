// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:max-classes-per-file
const path = require("path");
const constants_1 = require("../../../common/constants");
class NoDebugLauncherScriptProvider {
    getLauncherFilePath() {
        return path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
    }
}
exports.NoDebugLauncherScriptProvider = NoDebugLauncherScriptProvider;
class DebuggerLauncherScriptProvider {
    getLauncherFilePath() {
        return path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
    }
}
exports.DebuggerLauncherScriptProvider = DebuggerLauncherScriptProvider;
//# sourceMappingURL=launcherProvider.js.map