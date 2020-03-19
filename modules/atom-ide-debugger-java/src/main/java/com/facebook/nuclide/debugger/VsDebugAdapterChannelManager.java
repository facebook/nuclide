/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONObject;

public class VsDebugAdapterChannelManager extends NotificationChannel {
  private JavaDebuggerServer debuggerServer;
  public static final String TWO_CRLF = "\r\n\r\n";
  public static final String ContentLengthPrefix = "Content-Length: ";
  public static final int ContentLengthBufferSize = 100;

  public OutputStream outputStream() {
    return debuggerServer.outputStream();
  }

  public InputStream inputStream() {
    return debuggerServer.inputStream();
  }

  public void start(JavaDebuggerServer debuggerServer) {
    this.debuggerServer = debuggerServer;
    enable();
    boolean shouldContinue = true;
    while (shouldContinue) {
      shouldContinue = parseOneMessage();
    }
  }

  public boolean parseOneMessage() {
    boolean contentLengthPrefixParsed = parseContentLengthPrefix();
    if (!contentLengthPrefixParsed) {
      return false;
    }

    int contentLength = parseContentLength();
    if (contentLength == -1) {
      return false;
    }

    String message = parseContent(contentLength);
    if (message.isEmpty()) {
      return false;
    }

    return onMessage(message);
  }

  public boolean parseContentLengthPrefix() {
    try {
      byte[] byteBufferForContentLengthPrefix = new byte[ContentLengthPrefix.length()];
      inputStream().read(byteBufferForContentLengthPrefix);
    } catch (IOException ex) {
      System.err.println(ex.toString());
      return false;
    }
    return true;
  }

  public int parseContentLength() {
    try {
      byte[] byteBufferForContentLength = new byte[ContentLengthBufferSize];
      inputStream().read(byteBufferForContentLength, 0, TWO_CRLF.length());
      for (int pos = TWO_CRLF.length(); pos < ContentLengthBufferSize; pos++) {
        inputStream().read(byteBufferForContentLength, pos, 1);
        if (((char) byteBufferForContentLength[pos] == TWO_CRLF.charAt(3))
            && ((char) byteBufferForContentLength[pos - 3] == TWO_CRLF.charAt(0))
            && ((char) byteBufferForContentLength[pos - 2] == TWO_CRLF.charAt(1))
            && ((char) byteBufferForContentLength[pos - 1] == TWO_CRLF.charAt(2))) {
          // now make int out of byteBufferForContentLength[0:pos - 3)
          return Integer.parseInt(new String(byteBufferForContentLength, 0, pos - 3));
        }
      }
    } catch (IOException ex) {
      System.err.println(ex.toString());
      return -1;
    }
    return -1;
  }

  public String parseContent(int contentLength) {
    try {
      byte[] byteBufferForContent = new byte[contentLength];
      inputStream().read(byteBufferForContent);
      return new String(byteBufferForContent);
    } catch (IOException ex) {
      System.err.println(ex.toString());
      return "";
    }
  }

  public boolean onMessage(String message) {
    return debuggerServer.handleMessage(message);
  }

  public void send(String message) {
    JSONObject json = new JSONObject(message);
    debuggerServer.receivedEvent(json);
  }

  public void sendProtocolMessage(base$ProtocolMessage message) {
    String messageContent = message.toJSON().toString();
    super.send(messageContent);
  }

  // the following method must be synchronized, otherwise we risk interleaving JSON messages and
  //   this can result in all sorts of confusing behavior
  public synchronized void sendHelper(String messageContent) {
    try {
      byte[] byteBufferForMessageContent = messageContent.getBytes();
      String messagePrefix = "Content-Length: " + byteBufferForMessageContent.length + TWO_CRLF;
      byte[] byteBufferForMessagePrefix = messagePrefix.getBytes();
      outputStream().write(byteBufferForMessagePrefix);
      outputStream().write(byteBufferForMessageContent);
    } catch (IOException ex) {
      System.err.println(ex.toString());
    }
  }
}
