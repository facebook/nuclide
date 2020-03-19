"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uint64be = require("uint64be");
class SocketStream {
    constructor(socket, buffer) {
        this.bytesRead = 0;
        this.hasInsufficientDataForReading = false;
        this.buffer = buffer;
        this.socket = socket;
    }
    WriteInt32(num) {
        this.WriteInt64(num);
    }
    WriteInt64(num) {
        let buffer = uint64be.encode(num);
        this.socket.write(buffer);
    }
    WriteString(value) {
        let stringBuffer = new Buffer(value, "utf-8");
        this.WriteInt32(stringBuffer.length);
        if (stringBuffer.length > 0) {
            this.socket.write(stringBuffer);
        }
    }
    Write(buffer) {
        this.socket.write(buffer);
    }
    get Buffer() {
        return this.buffer;
    }
    BeginTransaction() {
        this.isInTransaction = true;
        this.bytesRead = 0;
        this.ClearErrors();
    }
    EndTransaction() {
        this.isInTransaction = false;
        this.buffer = this.buffer.slice(this.bytesRead);
        this.bytesRead = 0;
        this.ClearErrors();
    }
    RollBackTransaction() {
        this.isInTransaction = false;
        this.bytesRead = 0;
        this.ClearErrors();
    }
    ClearErrors() {
        this.hasInsufficientDataForReading = false;
    }
    get HasInsufficientDataForReading() {
        return this.hasInsufficientDataForReading;
    }
    toString() {
        return this.buffer.toString();
    }
    get Length() {
        return this.buffer.length;
    }
    Append(additionalData) {
        if (this.buffer.length === 0) {
            this.buffer = additionalData;
            return;
        }
        let newBuffer = new Buffer(this.buffer.length + additionalData.length);
        this.buffer.copy(newBuffer);
        additionalData.copy(newBuffer, this.buffer.length);
        this.buffer = newBuffer;
    }
    isSufficientDataAvailable(length) {
        if (this.buffer.length < (this.bytesRead + length)) {
            this.hasInsufficientDataForReading = true;
        }
        return !this.hasInsufficientDataForReading;
    }
    ReadByte() {
        if (!this.isSufficientDataAvailable(1)) {
            return null;
        }
        let value = this.buffer.slice(this.bytesRead, this.bytesRead + 1)[0];
        if (this.isInTransaction) {
            this.bytesRead++;
        }
        else {
            this.buffer = this.buffer.slice(1);
        }
        return value;
    }
    ReadString() {
        let byteRead = this.ReadByte();
        if (this.HasInsufficientDataForReading) {
            return null;
        }
        if (byteRead < 0) {
            throw new Error("IOException() - Socket.ReadString failed to read string type;");
        }
        let type = new Buffer([byteRead]).toString();
        let isUnicode = false;
        switch (type) {
            case "N": // null string
                return null;
            case "U":
                isUnicode = true;
                break;
            case "A": {
                isUnicode = false;
                break;
            }
            default: {
                throw new Error("IOException(); Socket.ReadString failed to parse unknown string type " + type);
            }
        }
        let len = this.ReadInt32();
        if (this.HasInsufficientDataForReading) {
            return null;
        }
        if (!this.isSufficientDataAvailable(len)) {
            return null;
        }
        let stringBuffer = this.buffer.slice(this.bytesRead, this.bytesRead + len);
        if (this.isInTransaction) {
            this.bytesRead = this.bytesRead + len;
        }
        else {
            this.buffer = this.buffer.slice(len);
        }
        let resp = isUnicode ? stringBuffer.toString("utf-8") : stringBuffer.toString();
        return resp;
    }
    ReadInt32() {
        return this.ReadInt64();
    }
    ReadInt64() {
        if (!this.isSufficientDataAvailable(8)) {
            return null;
        }
        let buf = this.buffer.slice(this.bytesRead, this.bytesRead + 8);
        if (this.isInTransaction) {
            this.bytesRead = this.bytesRead + 8;
        }
        else {
            this.buffer = this.buffer.slice(8);
        }
        let returnValue = uint64be.decode(buf);
        return returnValue;
    }
    ReadAsciiString(length) {
        if (!this.isSufficientDataAvailable(length)) {
            return null;
        }
        let stringBuffer = this.buffer.slice(this.bytesRead, this.bytesRead + length);
        if (this.isInTransaction) {
            this.bytesRead = this.bytesRead + length;
        }
        else {
            this.buffer = this.buffer.slice(length);
        }
        return stringBuffer.toString("ascii");
    }
    readValueInTransaction(dataType) {
        let startedTransaction = false;
        if (!this.isInTransaction) {
            this.BeginTransaction();
            startedTransaction = true;
        }
        let data;
        switch (dataType) {
            case DataType.string: {
                data = this.ReadString();
                break;
            }
            case DataType.int32: {
                data = this.ReadInt32();
                break;
            }
            case DataType.int64: {
                data = this.ReadInt64();
                break;
            }
        }
        if (this.HasInsufficientDataForReading) {
            if (startedTransaction) {
                this.RollBackTransaction();
            }
            return undefined;
        }
        if (startedTransaction) {
            this.EndTransaction();
        }
        return data;
    }
    readStringInTransaction() {
        return this.readValueInTransaction(DataType.string);
    }
    readInt32InTransaction() {
        return this.readValueInTransaction(DataType.int32);
    }
    readInt64InTransaction() {
        return this.readValueInTransaction(DataType.int64);
    }
}
exports.SocketStream = SocketStream;
var DataType;
(function (DataType) {
    DataType[DataType["string"] = 0] = "string";
    DataType[DataType["int32"] = 1] = "int32";
    DataType[DataType["int64"] = 2] = "int64";
})(DataType || (DataType = {}));
//# sourceMappingURL=SocketStream.js.map