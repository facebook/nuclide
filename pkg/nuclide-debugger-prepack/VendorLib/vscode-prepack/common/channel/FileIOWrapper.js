"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileIOWrapper = undefined;

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _MessagePackager = require("./MessagePackager.js");

var _invariant = require("../invariant.js");

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class FileIOWrapper {
  constructor(isAdapter, inFilePath, outFilePath) {
    this._inFilePath = inFilePath;
    this._outFilePath = outFilePath;
    if (!_fs2.default.existsSync(this._inFilePath)) _fs2.default.openSync(this._inFilePath, "w");
    if (!_fs2.default.existsSync(this._outFilePath)) _fs2.default.openSync(this._outFilePath, "w");
    this._packager = new _MessagePackager.MessagePackager(isAdapter);
    this._isAdapter = isAdapter;
  }


  // Read in a message from the input asynchronously
  readIn(errorHandler, messageProcessor) {
    _fs2.default.readFile(this._inFilePath, { encoding: "utf8" }, (err, contents) => {
      if (err) {
        errorHandler(err);
        return;
      }
      let message = this._packager.unpackage(contents);
      if (message === null) {
        this.readIn(errorHandler, messageProcessor);
        return;
      }
      //clear the file
      _fs2.default.writeFileSync(this._inFilePath, "");
      //process the message
      messageProcessor(message);
    });
  }

  // Read in a message from the input synchronously
  readInSync() {
    let message = null;
    while (true) {
      let contents = _fs2.default.readFileSync(this._inFilePath, "utf8");
      message = this._packager.unpackage(contents);
      if (message === null) continue;
      break;
    }
    // loop should not break when message is still null
    (0, _invariant2.default)(message !== null);
    //clear the file
    _fs2.default.writeFileSync(this._inFilePath, "");
    return message;
  }

  // Read in a message from the input synchronously only once
  readInSyncOnce() {
    let contents = _fs2.default.readFileSync(this._inFilePath, "utf8");
    let message = this._packager.unpackage(contents);
    return message;
  }

  // Write out a message to the output synchronously
  writeOutSync(contents) {
    _fs2.default.writeFileSync(this._outFilePath, this._packager.package(contents));
  }

  clearInFile() {
    _fs2.default.writeFileSync(this._inFilePath, "");
  }

  clearOutFile() {
    _fs2.default.writeFileSync(this._outFilePath, "");
  }
}
exports.FileIOWrapper = FileIOWrapper; /**
                                        * Copyright (c) 2017-present, Facebook, Inc.
                                        * All rights reserved.
                                        *
                                        * This source code is licensed under the BSD-style license found in the
                                        * LICENSE file in the root directory of this source tree. An additional grant
                                        * of patent rights can be found in the PATENTS file in the same directory.
                                        */

/*  strict */
//# sourceMappingURL=FileIOWrapper.js.map