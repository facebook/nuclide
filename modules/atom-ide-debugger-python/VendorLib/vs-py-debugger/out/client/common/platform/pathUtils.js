"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const types_1 = require("../types");
const constants_1 = require("./constants");
// tslint:disable-next-line:no-var-requires no-require-imports
const untildify = require('untildify');
let PathUtils = class PathUtils {
    constructor(isWindows) {
        this.isWindows = isWindows;
        this.home = '';
        this.home = untildify('~');
    }
    get delimiter() {
        return path.delimiter;
    }
    // TO DO: Deprecate in favor of IPlatformService
    getPathVariableName() {
        return this.isWindows ? constants_1.WINDOWS_PATH_VARIABLE_NAME : constants_1.NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    basename(pathValue, ext) {
        return path.basename(pathValue, ext);
    }
    getDisplayName(pathValue, cwd) {
        if (cwd && pathValue.startsWith(cwd)) {
            return `.${path.sep}${path.relative(cwd, pathValue)}`;
        }
        else if (pathValue.startsWith(this.home)) {
            return `~${path.sep}${path.relative(this.home, pathValue)}`;
        }
        else {
            return pathValue;
        }
    }
};
PathUtils = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IsWindows))
], PathUtils);
exports.PathUtils = PathUtils;
//# sourceMappingURL=pathUtils.js.map