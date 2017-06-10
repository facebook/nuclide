// flow-typed signature: 8a4e38b655e562703b86cbc18c5748ed
// flow-typed version: 3c94680f9f/log4js_v1.x.x/flow_>=v0.34.x

type log4js$Logger = {
  level: string,
  setLevel(level: string): void,
  removeLevel(): void,
  isLevelEnabled(level: string): boolean,

  log(...args: Array<any>): void,
  trace(...args: Array<any>): void,
  debug(...args: Array<any>): void,
  info(...args: Array<any>): void,
  warn(...args: Array<any>): void,
  error(...args: Array<any>): void,
  fatal(...args: Array<any>): void,
  mark(...args: Array<any>): void,
}

type log4js$Appender = {
  type: string,
}

type log4js$Config = {
  appenders?: Array<log4js$Appender>,
  levels?: {[name: string]: string},
}

declare module 'log4js' {
  declare module.exports: {
    getLogger(category?: string): log4js$Logger,

    configure(
      configurationFileOrObject: string | log4js$Config,
      options?: Object,
    ): void,

    shutdown(callback: () => mixed): void,

    connectLogger(logger: log4js$Logger, options?: Object): any,

    levels: Object,
  }
}
