"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable-next-line:no-stateless-class
class ErrorUtils {
    static outputHasModuleNotInstalledError(moduleName, content) {
        return content && (content.indexOf(`No module named ${moduleName}`) > 0 || content.indexOf(`No module named '${moduleName}'`) > 0);
    }
}
exports.ErrorUtils = ErrorUtils;
//# sourceMappingURL=errorUtils.js.map