declare module "double-ended-queue" {
  declare export default class Deque<T> {
    length: number,

    constructor<T>(capacity?: number | Array<mixed> | void): Deque<T>,

    toArray: () => Array<T>,
    push: (item: T) => number,
    pop: () => ?T,
    shift: () => ?T,
    unshift: (item: T) => number,
    peekBack: () => ?T,
    peekFront: () => ?T,
    get: (index: number) => ?T,
    isEmpty: () => boolean,
    clear: () => void,
    toString: () => string,

    // aliases
    valueOf: () => string, // toString
    removeFront: () => ?T, // shift
    removeBack: () => ?T, // pop
    insertFront: (item: T) => number, // unshift
    insertBack: (item: T) => number, // push
    enqueue: (item: T) => number, // push
    dequeue: () => ?T, // shift
    toJSON: () => Array<T> // toArray
  }
}
