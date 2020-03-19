// flow-typed signature: 648842eba230bb7a0960d21a0dc2fe5e
// flow-typed version: d94fd329cc/xterm_v3.x.x/flow_>=v0.56.x

declare module "xterm" {
  declare export type FontWeight =
    | "normal"
    | "bold"
    | "100"
    | "200"
    | "300"
    | "400"
    | "500"
    | "600"
    | "700"
    | "800"
    | "900";

  declare export type Theme = $Shape<{
    foreground: string,
    background: string,
    cursor: string,
    cursorAccent: string,
    selection: string,
    black: string,
    red: string,
    green: string,
    yellow: string,
    blue: string,
    magenta: string,
    cyan: string,
    white: string,
    brightBlack: string,
    brightRed: string,
    brightGreen: string,
    brightYellow: string,
    brightBlue: string,
    brightMagenta: string,
    brightCyan: string,
    brightWhite: string
  }>;

  declare export type TerminalOptions = $Shape<{
    allowTransparency: boolean,
    bellSound: string,
    bellStyle: "none" | "sound",
    cols: number,
    cursorBlink: boolean,
    cursorStyle: "block" | "underline" | "bar",
    disableStdin: boolean,
    enableBold: boolean,
    fontSize: number,
    fontFamily: string,
    fontWeight: FontWeight,
    fontWeightBold: FontWeight,
    letterSpacing: number,
    lineHeight: number,
    macOptionIsMeta: boolean,
    rightClickSelectsWord: boolean,
    rows: number,
    screenReaderMode: boolean,
    scrollback: number,
    tabStopWidth: number,
    theme: Theme,
  }>;

  declare export type LinkMatcherOptions = $Shape<{
    matchIndex: number,
    validationCallback: (
      uri: string,
      callback: (isValid: boolean) => void
    ) => void,
    tooltipCallback: (event: MouseEvent, uri: string) => boolean | void,
    leaveCallback: (event: MouseEvent, uri: string) => boolean | void,
    priority: number,
    willLinkActivate: (event: MouseEvent, uri: string) => boolean
  }>;

  declare export type Disposable = {|
    dispose(): void
  |};

  declare export type Marker = {|
    ...Disposable,
    +id: number,
    +isDisposed: boolean,
    +line: number
  |};

  declare export type LocalizableStrings = {|
    blankLine: string,
    promptLabel: string,
    tooMuchOutput: string
  |};

  declare export class Terminal {
    element: HTMLElement;
    textarea: HTMLTextAreaElement;
    rows: number;
    cols: number;
    markers: Marker[];
    static strings: LocalizableStrings;
    constructor(options?: TerminalOptions): Terminal;
    blur(): void;
    focus(): void;
    on(
      type: "blur" | "focus" | "linefeed" | "selection",
      listener: () => void
    ): void;
    on(type: "data", listener: (...args: any[]) => void): void;
    on(
      type: "key",
      listener: (key?: string, event?: KeyboardEvent) => void
    ): void;
    on(
      type: "keypress" | "keydown",
      listener: (event?: KeyboardEvent) => void
    ): void;
    on(
      type: "refresh",
      listener: (data?: { start: number, end: number }) => void
    ): void;
    on(
      type: "resize",
      listener: (data?: { cols: number, rows: number }) => void
    ): void;
    on(type: "scroll", listener: (ydisp?: number) => void): void;
    on(type: "title", listener: (title?: string) => void): void;
    on(type: string, listener: (...args: any[]) => void): void;
    off(
      type: | "blur"
      | "focus"
      | "linefeed"
      | "selection"
      | "data"
      | "key"
      | "keypress"
      | "keydown"
      | "refresh"
      | "resize"
      | "scroll"
      | "title"
      | string,
      listener: (...args: any[]) => void
    ): void;
    emit(type: string, data?: any): void;
    addDisposableListener(
      type: string,
      handler: (...args: any[]) => void
    ): Disposable;
    resize(columns: number, rows: number): void;
    writeln(data: string): void;
    open(parent: HTMLElement): void;
    attachCustomKeyEventHandler(
      customKeyEventHandler: (event: KeyboardEvent) => boolean
    ): void;
    registerLinkMatcher(
      regex: RegExp,
      handler: (event: MouseEvent, uri: string) => void,
      options?: LinkMatcherOptions
    ): number;
    deregisterLinkMatcher(matcherId: number): void;
    addMarker(cursorYOffset: number): Marker;
    hasSelection(): boolean;
    getSelection(): string;
    clearSelection(): void;
    selectAll(): void;
    selectLines(start: number, end: number): void;
    destroy(): void;
    scrollLines(amount: number): void;
    scrollPages(pageCount: number): void;
    scrollToTop(): void;
    scrollToBottom(): void;
    scrollToLine(line: number): void;
    clear(): void;
    write(data: string): void;
    getOption(
      key: | "bellSound"
      | "bellStyle"
      | "cursorStyle"
      | "fontFamily"
      | "fontWeight"
      | "fontWeightBold"
      | "termName"
    ): string;
    getOption(
      key: | "allowTransparency"
      | "cancelEvents"
      | "convertEol"
      | "cursorBlink"
      | "debug"
      | "disableStdin"
      | "enableBold"
      | "macOptionIsMeta"
      | "rightClickSelectsWord"
      | "popOnBell"
      | "screenKeys"
      | "useFlowControl"
      | "visualBell"
    ): boolean;
    getOption(key: "colors"): Array<string>;
    getOption(
      key: | "cols"
      | "fontSize"
      | "letterSpacing"
      | "lineHeight"
      | "rows"
      | "tabStopWidth"
      | "scrollback"
    ): number;
    getOption(key: "handler"): (data: string) => void;
    getOption(key: string): any;
    setOption(
      key: "fontFamily" | "termName" | "bellSound",
      value: string
    ): void;
    setOption(key: "fontWeight" | "fontWeightBold", value: ?FontWeight): void;
    setOption(
      key: "bellStyle",
      value: null | "none" | "visual" | "sound" | "both"
    ): void;
    setOption(
      key: "cursorStyle",
      value: null | "block" | "underline" | "bar"
    ): void;
    setOption(
      key: | "allowTransparency"
      | "cancelEvents"
      | "convertEol"
      | "cursorBlink"
      | "debug"
      | "disableStdin"
      | "enableBold"
      | "macOptionIsMeta"
      | "popOnBell"
      | "rightClickSelectsWord"
      | "screenKeys"
      | "useFlowControl"
      | "visualBell",
      value: boolean
    ): void;
    setOption(key: "colors", value: Array<string>): void;
    setOption(
      key: | "fontSize"
      | "letterSpacing"
      | "lineHeight"
      | "tabStopWidth"
      | "scrollback",
      value: number
    ): void;
    setOption(key: "handler", value: (data: string) => void): void;
    setOption(key: "theme", value: Theme): void;
    setOption(key: "cols" | "rows", value: number): void;
    setOption(key: string, value: any): void;
    refresh(start: number, end: number): void;
    reset(): void;
    static applyAddon(addon: any): void;
  }
}
