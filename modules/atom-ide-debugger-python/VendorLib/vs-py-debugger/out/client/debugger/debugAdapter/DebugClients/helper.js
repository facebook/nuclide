"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class DebugClientHelper {
    constructor(envParser, pathUtils, process) {
        this.envParser = envParser;
        this.pathUtils = pathUtils;
        this.process = process;
    }
    getEnvironmentVariables(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const pathVariableName = this.pathUtils.getPathVariableName();
            // Merge variables from both .env file and env json variables.
            const envFileVars = yield this.envParser.parseFile(args.envFile);
            // tslint:disable-next-line:no-any
            const debugLaunchEnvVars = (args.env && Object.keys(args.env).length > 0) ? Object.assign({}, args.env) : {};
            const env = envFileVars ? Object.assign({}, envFileVars) : {};
            this.envParser.mergeVariables(debugLaunchEnvVars, env);
            // Append the PYTHONPATH and PATH variables.
            this.envParser.appendPath(env, debugLaunchEnvVars[pathVariableName]);
            this.envParser.appendPythonPath(env, debugLaunchEnvVars.PYTHONPATH);
            if (typeof env[pathVariableName] === 'string' && env[pathVariableName].length > 0) {
                // Now merge this path with the current system path.
                // We need to do this to ensure the PATH variable always has the system PATHs as well.
                this.envParser.appendPath(env, this.process.env[pathVariableName]);
            }
            if (typeof env.PYTHONPATH === 'string' && env.PYTHONPATH.length > 0) {
                // We didn't have a value for PATH earlier and now we do.
                // Now merge this path with the current system path.
                // We need to do this to ensure the PATH variable always has the system PATHs as well.
                this.envParser.appendPythonPath(env, this.process.env.PYTHONPATH);
            }
            if (typeof args.console !== 'string' || args.console === 'none') {
                // For debugging, when not using any terminal, then we need to provide all env variables.
                // As we're spawning the process, we need to ensure all env variables are passed.
                // Including those from the current process (i.e. everything, not just custom vars).
                this.envParser.mergeVariables(this.process.env, env);
                if (env[pathVariableName] === undefined && typeof this.process.env[pathVariableName] === 'string') {
                    env[pathVariableName] = this.process.env[pathVariableName];
                }
                if (env.PYTHONPATH === undefined && typeof this.process.env.PYTHONPATH === 'string') {
                    env.PYTHONPATH = this.process.env.PYTHONPATH;
                }
            }
            if (!env.hasOwnProperty('PYTHONIOENCODING')) {
                env.PYTHONIOENCODING = 'UTF-8';
            }
            if (!env.hasOwnProperty('PYTHONUNBUFFERED')) {
                env.PYTHONUNBUFFERED = '1';
            }
            if (args.gevent) {
                env.GEVENT_SUPPORT = 'True'; // this is read in pydevd_constants.py
            }
            return env;
        });
    }
}
exports.DebugClientHelper = DebugClientHelper;
//# sourceMappingURL=helper.js.map