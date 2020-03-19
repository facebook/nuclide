struct ProcessWatcherMessage{
  1: string kind,
  2: string data,
  3: i8 exitCode,
  4: string signal,
}

service ThriftProcessWatcherService {
  void unsubscribe(1: i32 processId);
  list<ProcessWatcherMessage> nextMessages(1: i32 processId, 2: i32 waitTimeSec);
  // the return value is an id used to retrieve messages and unsubscribe
  // but is not an actual unix PID
  i32 watchProcess(1: string command, 2: list<string> cmdArgs);
}
