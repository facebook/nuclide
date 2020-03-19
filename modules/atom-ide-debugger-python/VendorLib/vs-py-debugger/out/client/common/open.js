'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const childProcess = require("child_process");
function open(opts) {
    // opts = objectAssign({wait: true}, opts);
    if (!opts.hasOwnProperty("wait")) {
        opts.wait = true;
    }
    var cmd;
    var appArgs = [];
    var args = [];
    var cpOpts = {};
    if (opts.cwd && typeof opts.cwd === 'string' && opts.cwd.length > 0) {
        cpOpts.cwd = opts.cwd;
    }
    if (opts.env && Object.keys(opts.env).length > 0) {
        cpOpts.env = opts.env;
    }
    if (Array.isArray(opts.app)) {
        appArgs = opts.app.slice(1);
        opts.app = opts.app[0];
    }
    if (process.platform === 'darwin') {
        const sudoPrefix = opts.sudo === true ? 'sudo ' : '';
        cmd = 'osascript';
        args = ['-e', 'tell application "terminal"',
            '-e', 'activate',
            '-e', 'do script "' + sudoPrefix + [opts.app].concat(appArgs).join(" ") + '"',
            '-e', 'end tell'];
    }
    else if (process.platform === 'win32') {
        cmd = 'cmd';
        args.push('/c', 'start');
        if (opts.wait) {
            args.push('/wait');
        }
        if (opts.app) {
            args.push(opts.app);
        }
        if (appArgs.length > 0) {
            args = args.concat(appArgs);
        }
    }
    else {
        cmd = 'gnome-terminal';
        const sudoPrefix = opts.sudo === true ? 'sudo ' : '';
        args = ['-x', 'sh', '-c', `"${sudoPrefix}${opts.app}" ${appArgs.join(" ")}`];
    }
    var cp = childProcess.spawn(cmd, args, cpOpts);
    if (opts.wait) {
        return new Promise(function (resolve, reject) {
            cp.once('error', reject);
            cp.once('close', function (code) {
                if (code > 0) {
                    reject(new Error('Exited with code ' + code));
                    return;
                }
                resolve(cp);
            });
        });
    }
    cp.unref();
    return Promise.resolve(cp);
}
exports.open = open;
;
//# sourceMappingURL=open.js.map