/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

- (id)initWithName:(NSString *)name {
  if ((self = [super init])) {
    _name = [name copy];

    _queue = dispatch_queue_create([name cStringUsingEncoding:NSUTF8StringEncoding], DISPATCH_QUEUE_SERIAL);

    _fileManager = [[NSFileManager alloc] init];

    if (![_fileManager fileExistsAtPath:@"test"]) {
      [_fileManager createDirectoryAtPath:@"test"
              withIntermediateDirectories:YES
                               attributes:nil error:nil];
    }
  }
  return self;
}
