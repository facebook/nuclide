"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const fileSystem_1 = require("../../common/node/fileSystem");
const Q = require("q");
const path = require("path");
class PackageNameResolver {
    constructor(applicationName) {
        this.applicationName = applicationName;
    }
    /**
     * Tries to find the package name in AndroidManifest.xml. If not found, it returns the default package name,
     * which is the application name prefixed with the default prefix.
     */
    resolvePackageName(projectRoot) {
        let expectedAndroidManifestPath = path.join.apply(this, [projectRoot].concat(PackageNameResolver.DefaultManifestLocation));
        return this.readPackageName(expectedAndroidManifestPath);
    }
    /**
     * Given a manifest file path, it parses the file and returns the package name.
     * If the package name cannot be parsed, the default packge name is returned.
     */
    readPackageName(manifestPath) {
        if (manifestPath) {
            let fs = new fileSystem_1.FileSystem();
            return fs.exists(manifestPath).then(exists => {
                if (exists) {
                    return fs.readFile(manifestPath)
                        .then(manifestContent => {
                        let packageName = this.parsePackageName(manifestContent);
                        if (!packageName) {
                            packageName = this.getDefaultPackageName(this.applicationName);
                        }
                        return packageName;
                    });
                }
                else {
                    return this.getDefaultPackageName(this.applicationName);
                }
            });
        }
        else {
            return Q.resolve(this.getDefaultPackageName(this.applicationName));
        }
    }
    /**
     * Gets the default package name, based on the application name.
     */
    getDefaultPackageName(applicationName) {
        return (PackageNameResolver.DefaultPackagePrefix + applicationName).toLowerCase();
    }
    /**
     * Parses the application package name from the contents of an Android manifest file.
     * If a match was found, it is returned. Otherwise null is returned.
     */
    parsePackageName(manifestContents) {
        // first we remove all the comments from the file
        let match = manifestContents.match(PackageNameResolver.PackageNameRegexp);
        return match ? match[1] : null;
    }
}
PackageNameResolver.PackageNameRegexp = /package="(.+?)"/;
PackageNameResolver.ManifestName = "AndroidManifest.xml";
PackageNameResolver.DefaultPackagePrefix = "com.";
PackageNameResolver.SourceRootRelPath = ["android", "app", "src", "main"];
PackageNameResolver.DefaultManifestLocation = PackageNameResolver.SourceRootRelPath.concat(PackageNameResolver.ManifestName);
exports.PackageNameResolver = PackageNameResolver;

//# sourceMappingURL=packageNameResolver.js.map
