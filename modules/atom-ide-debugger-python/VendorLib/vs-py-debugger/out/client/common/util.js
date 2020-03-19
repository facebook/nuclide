// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
// tslint:disable-next-line: no-suspicious-comment
// TODO: Usage of these should be replaced by OSInfo.* or
// IPlatformService.* (from src/client/common/platform).
exports.IS_WINDOWS = /^win/.test(process.platform);
exports.Is_64Bit = os.arch() === 'x64';
//# sourceMappingURL=util.js.map