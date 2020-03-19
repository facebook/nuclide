// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-invalid-this no-console
const chai_1 = require("chai");
const fs = require("fs-extra");
const os_1 = require("os");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("../../client/common/constants");
const stopWatch_1 = require("../../client/common/utils/stopWatch");
const AllowedIncreaseInActivationDelayInMS = 500;
suite('Activation Times', () => {
    if (process.env.ACTIVATION_TIMES_LOG_FILE_PATH) {
        const logFile = process.env.ACTIVATION_TIMES_LOG_FILE_PATH;
        const sampleCounter = fs.existsSync(logFile) ? fs.readFileSync(logFile, { encoding: 'utf8' }).toString().split(/\r?\n/g).length : 1;
        if (sampleCounter > 5) {
            return;
        }
        test(`Capture Extension Activation Times (Version: ${process.env.ACTIVATION_TIMES_EXT_VERSION}, sample: ${sampleCounter})`, () => __awaiter(this, void 0, void 0, function* () {
            const pythonExtension = vscode_1.extensions.getExtension(constants_1.PVSC_EXTENSION_ID);
            if (!pythonExtension) {
                throw new Error('Python Extension not found');
            }
            const stopWatch = new stopWatch_1.StopWatch();
            yield pythonExtension.activate();
            const elapsedTime = stopWatch.elapsedTime;
            if (elapsedTime > 10) {
                yield fs.ensureDir(path.dirname(logFile));
                yield fs.appendFile(logFile, `${elapsedTime}${os_1.EOL}`, { encoding: 'utf8' });
                console.log(`Loaded in ${elapsedTime}ms`);
            }
            vscode_1.commands.executeCommand('workbench.action.reloadWindow');
        }));
    }
    if (process.env.ACTIVATION_TIMES_DEV_LOG_FILE_PATHS &&
        process.env.ACTIVATION_TIMES_RELEASE_LOG_FILE_PATHS &&
        process.env.ACTIVATION_TIMES_DEV_LANGUAGE_SERVER_LOG_FILE_PATHS) {
        test('Test activation times of Dev vs Release Extension', () => __awaiter(this, void 0, void 0, function* () {
            function getActivationTimes(files) {
                const activationTimes = [];
                for (const file of files) {
                    fs.readFileSync(file, { encoding: 'utf8' }).toString()
                        .split(/\r?\n/g)
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .map(line => parseInt(line, 10))
                        .forEach(item => activationTimes.push(item));
                }
                return activationTimes;
            }
            const devActivationTimes = getActivationTimes(JSON.parse(process.env.ACTIVATION_TIMES_DEV_LOG_FILE_PATHS));
            const releaseActivationTimes = getActivationTimes(JSON.parse(process.env.ACTIVATION_TIMES_RELEASE_LOG_FILE_PATHS));
            const languageServerActivationTimes = getActivationTimes(JSON.parse(process.env.ACTIVATION_TIMES_DEV_LANGUAGE_SERVER_LOG_FILE_PATHS));
            const devActivationAvgTime = devActivationTimes.reduce((sum, item) => sum + item, 0) / devActivationTimes.length;
            const releaseActivationAvgTime = releaseActivationTimes.reduce((sum, item) => sum + item, 0) / releaseActivationTimes.length;
            const languageServerActivationAvgTime = languageServerActivationTimes.reduce((sum, item) => sum + item, 0) / languageServerActivationTimes.length;
            console.log(`Dev version loaded in ${devActivationAvgTime}ms`);
            console.log(`Release version loaded in ${releaseActivationAvgTime}ms`);
            console.log(`Language Server loaded in ${languageServerActivationAvgTime}ms`);
            chai_1.expect(devActivationAvgTime - releaseActivationAvgTime).to.be.lessThan(AllowedIncreaseInActivationDelayInMS, 'Activation times have increased above allowed threshold.');
        }));
    }
});
//# sourceMappingURL=load.perf.test.js.map