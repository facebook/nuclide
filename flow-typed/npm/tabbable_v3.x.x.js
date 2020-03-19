// flow-typed signature: 1ab336c579b3b3d661207ff1f9f28311
// flow-typed version: a0c55e127f/tabbable_v3.x.x/flow_>=v0.54.x

declare module 'tabbable' {
  declare type TabbableOptions = {|
    includeContainer?: ?boolean,
  |};

  declare interface UntouchabilityChecker {
    hasDisplayNone(node: Node, nodeComputedStyle: any): boolean;
    isUntouchable(node: Node): boolean;
  }

  declare module.exports: {
    (el: Node, options?: ?TabbableOptions): Array<Node>,
    isTabbable(node: Node, untouchabilityChecker?: ?UntouchabilityChecker): boolean,
    isFocusable(node: Node, untouchabilityChecker?: ?UntouchabilityChecker): boolean,
  };
}
