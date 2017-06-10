/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

export type AslLevel = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';

export type AslRecord = {
  ASLMessageID: string,
  Time: string,
  TimeNanoSec: string,
  Level: AslLevel,
  PID: string,
  UID: string,
  GID: string,
  ReadGID: string,
  Host: string,
  Sender: string,
  Facility: string,
  Message: string,
  ASLSHIM: string,
  SenderMachUUID: string,
};
