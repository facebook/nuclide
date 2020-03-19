"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const pathModule = require("path");
const Q = require("q");
const fileSystem_1 = require("./fileSystem");
class Package {
    constructor(path, { fileSystem = new fileSystem_1.FileSystem() } = {}) {
        this.INFORMATION_PACKAGE_FILENAME = "package.json";
        this.DEPENDENCIES_SUBFOLDER = "node_modules";
        this._path = path;
        this.fileSystem = fileSystem;
    }
    parsePackageInformation() {
        return this.fileSystem.readFile(this.informationJsonFilePath(), "utf8")
            .then(data => JSON.parse(data));
    }
    name() {
        return this.parseProperty("name");
    }
    dependencies() {
        return this.parseProperty("dependencies");
    }
    version() {
        return this.parseProperty("version").then(version => typeof version === "string"
            ? version
            : Q.reject(`Couldn't parse the version component of the package at ${this.informationJsonFilePath()}: version = ${version}`));
    }
    setMainFile(value) {
        return this.parsePackageInformation()
            .then(packageInformation => {
            packageInformation.main = value;
            return this.fileSystem.writeFile(this.informationJsonFilePath(), JSON.stringify(packageInformation));
        });
    }
    dependencyPath(dependencyName) {
        return pathModule.resolve(this._path, this.DEPENDENCIES_SUBFOLDER, dependencyName);
    }
    dependencyPackage(dependencyName) {
        return new Package(this.dependencyPath(dependencyName), { fileSystem: this.fileSystem });
    }
    informationJsonFilePath() {
        return pathModule.resolve(this._path, this.INFORMATION_PACKAGE_FILENAME);
    }
    parseProperty(name) {
        return this.parsePackageInformation()
            .then(packageInformation => packageInformation[name]);
    }
}
exports.Package = Package;

//# sourceMappingURL=package.js.map
