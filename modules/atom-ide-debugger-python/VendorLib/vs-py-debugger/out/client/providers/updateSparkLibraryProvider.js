'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../common/constants");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
function activateUpdateSparkLibraryProvider() {
    return vscode.commands.registerCommand(constants_1.Commands.Update_SparkLibrary, updateSparkLibrary);
}
exports.activateUpdateSparkLibraryProvider = activateUpdateSparkLibraryProvider;
function updateSparkLibrary() {
    const pythonConfig = vscode.workspace.getConfiguration('python');
    const extraLibPath = 'autoComplete.extraPaths';
    // tslint:disable-next-line:no-invalid-template-strings
    const sparkHomePath = '${env:SPARK_HOME}';
    pythonConfig.update(extraLibPath, [path.join(sparkHomePath, 'python'),
        path.join(sparkHomePath, 'python/pyspark')]).then(() => {
        //Done
    }, reason => {
        vscode.window.showErrorMessage(`Failed to update ${extraLibPath}. Error: ${reason.message}`);
        console.error(reason);
    });
    vscode.window.showInformationMessage('Make sure you have SPARK_HOME environment variable set to the root path of the local spark installation!');
    telemetry_1.sendTelemetryEvent(constants_2.UPDATE_PYSPARK_LIBRARY);
}
//# sourceMappingURL=updateSparkLibraryProvider.js.map