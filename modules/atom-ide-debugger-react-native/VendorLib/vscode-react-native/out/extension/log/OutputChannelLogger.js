"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
// END MODIFIED BY PELMERS
const LogHelper_1 = require("./LogHelper");
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const channels = {};
// BEGIN MODIFIED BY PELMERS
const ConsoleChannel = {
    name: "console",
    append(value) {
        vscode_chrome_debug_core_1.logger.log(value.trim());
    },
    appendLine(value) {
        vscode_chrome_debug_core_1.logger.log(value.trim());
    },
    clear() {
    },
    show(_column, _preserveFocus) {
    },
    hide() {
    },
    dispose() {
    },
};
// END MODIFIED BY PELMERS
class OutputChannelLogger {
    constructor(channelName, lazy = false, preserveFocus = false) {
        this.channelName = channelName;
        this.preserveFocus = preserveFocus;
        if (!lazy) {
            // BEGIN MODIFIED BY PELMERS
            this.channel = ConsoleChannel;
            // END MODIFIED BY PELMERS
            this.channel.show(this.preserveFocus);
        }
    }
    static disposeChannel(channelName) {
        if (channels[channelName]) {
            channels[channelName].getOutputChannel().dispose();
            delete channels[channelName];
        }
    }
    static getMainChannel() {
        return this.getChannel(this.MAIN_CHANNEL_NAME, true);
    }
    static getChannel(channelName, lazy, preserveFocus) {
        if (!channels[channelName]) {
            channels[channelName] = new OutputChannelLogger(channelName, lazy, preserveFocus);
        }
        return channels[channelName];
    }
    log(message, level) {
        if (LogHelper_1.LogHelper.LOG_LEVEL === LogHelper_1.LogLevel.None) {
            return;
        }
        if (level >= LogHelper_1.LogHelper.LOG_LEVEL) {
            message = OutputChannelLogger.getFormattedMessage(message, level);
            this.channel.appendLine(message);
        }
    }
    info(message) {
        this.log(message, LogHelper_1.LogLevel.Info);
    }
    warning(message, logStack = false) {
        this.log(message.toString(), LogHelper_1.LogLevel.Warning);
    }
    error(errorMessage, error, logStack = true) {
        this.channel.appendLine(OutputChannelLogger.getFormattedMessage(errorMessage, LogHelper_1.LogLevel.Error));
        // Print the error stack if necessary
        if (logStack && error && error.stack) {
            this.channel.appendLine(`Stack: ${error.stack}`);
        }
    }
    debug(message) {
        this.log(message, LogHelper_1.LogLevel.Debug);
    }
    logStream(data) {
        this.channel.append(data.toString());
    }
    setFocusOnLogChannel() {
        this.channel.show(false);
    }
    static getFormattedMessage(message, level) {
        return `[${LogHelper_1.LogLevel[level]}] ${message}\n`;
    }
    getOutputChannel() {
        return this.channel;
    }
    clear() {
        this.channel.clear();
    }
    get channel() {
        if (this.outputChannel) {
            return this.outputChannel;
        }
        else {
            // BEGIN MODIFIED BY PELMERS
            this.outputChannel = ConsoleChannel;
            // END MODIFIED BY PELMERS
            this.outputChannel.show(this.preserveFocus);
            return this.outputChannel;
        }
    }
    set channel(channel) {
        this.outputChannel = channel;
    }
}
OutputChannelLogger.MAIN_CHANNEL_NAME = "React Native";
exports.OutputChannelLogger = OutputChannelLogger;

//# sourceMappingURL=OutputChannelLogger.js.map
