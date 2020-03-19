// SYNTAX TEST "text.html.hack"
<?hh

function example(): Awaitable<SomeType, bool> {
  //              ^ punctuation.definition.type.php
  //                     ^ support.class.php
  //                            ^ support.class.php
  //                                     ^ storage.type.php
  //                                          ^ punctuation.section.scope.begin.php
}

interface ISomething {

  function example(): void;
  //                ^ punctuation.definition.type.php
  //                   ^ support.class.php
  //                      ^ punctuation.terminator.expression.php
  function example2(): void;
  //                 ^ punctuation.definition.type.php
  //                    ^ support.class.php
  //                       ^ punctuation.terminator.expression.php
}

function exampleWithDefaultParameters(
  URI $href_uri,
  ?Something $filter = null,
  // ^ support.class.php
  //                 ^ keyword.operator.assignment.php
  //                   ^^^^ constant.language.php
  //                       ^ meta.function.arguments.php
  bool $notfilter = false,
  // ^ storage.type.php
  //              ^ keyword.operator.assignment.php
  //                ^^^^^ constant.language.php
  //                     ^ meta.function.arguments.php
  SomeEnum $mode = SomeEnum::NORMAL,
  // ^ support.class.php
  //             ^ keyword.operator.assignment.php
  //               ^^^^^^^^  support.class.php
  //                         ^^^^^^ constant.other.class.php
  //                               ^ meta.function.arguments.php
): void {

}

function f($x) {
  //       ^ punctuation.definition.variable
  //        ^ variable.other.php
}

function f($x = 5) {
  //          ^ keyword.operator.assignment
  //            ^ constant.numeric.php
}

function f($x = []) {
  //          ^ keyword.operator.assignment
  //            ^ punctuation.section.array.begin
  //             ^ punctuation.section.array.end
}

function f(int $x = 5) {
  //              ^ keyword.operator.assignment
  //                ^ constant.numeric.php
}

function f(array $x = []) {
  //                ^ keyword.operator.assignment
  //                  ^ punctuation.section.array.begin
  //                   ^ punctuation.section.array.end
}

function f($x, $y) {
  //       ^ punctuation.definition.variable
  //        ^ variable.other.php
  //           ^ punctuation.definition.variable
  //            ^ variable.other.php
}

function f(array $x): void {
  //       ^^^^^ storage.type.array.php
}

function f( array $x): void {
  //        ^^^^^ storage.type.array.php
}

function f(array $x, array $y): void {
  //       ^^^^^ storage.type.array.php
}

function f(int $x): void {
  //       ^^^ storage.type.php
}

function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
  //       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.function.arguments.php
}

function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
  //               ^^^^^^^^^^^^^^^^^^ storage.type.shape.php
}

function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
  //                     ^ punctuation.definition.string.begin.php
  //                      ^^ meta.string-contents.quoted.single.php
  //                        ^ punctuation.definition.string.end.php
  //                          ^^ .keyword.operator.key.php
  //                             ^^^ .storage.type.php
}

function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
  //                                  ^ punctuation.definition.variable
  //                                   ^ variable.other.php
}

function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
  //                                       ^^^^^^^^^^^^^^^^^^ storage.type.shape.php
}

function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
  //                                             ^ punctuation.definition.string.begin.php
  //                                              ^^ meta.string-contents.quoted.single.php
  //                                                ^ punctuation.definition.string.end.php
  //                                                  ^^ .keyword.operator.key.php
  //                                                     ^^^ .storage.type.php
}

function f(): shape('vc' => shape('vc' => int)) {
  //                        ^^^^^^^^^^^^^^^^^^ storage.type.shape.php
  //                              ^ punctuation.definition.string.begin.php
  //                               ^^ meta.string-contents.quoted.single.php
  //                                 ^ punctuation.definition.string.end.php
  //                                   ^^ .keyword.operator.key.php
  //                                      ^^^ .storage.type.php
}

function f(): {
    $n = Foo\bar($test);
    //   ^^^ entity.name.type.namespace.php
    //      ^ punctuation.separator.inheritance.php
    //       ^^^ entity.name.function.php

    $n = Foo\Bar\Test\fn($t);
    //   ^^^ entity.name.type.namespace.php
    //      ^ punctuation.separator.inheritance.php
    //       ^^^ entity.name.type.namespace.php
    //          ^ punctuation.separator.inheritance.php
    //           ^^^^ entity.name.type.namespace.php
    //               ^ punctuation.separator.inheritance.php
    //                ^^ entity.name.function.php
}

function f(): shape(...) {
  //          ^^^^^^^^^^ storage.type.shape.php
}

class Something {
  public static function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
    //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.function.arguments.php
  }

  public static function f(int $x, shape('vc' => int) $y): shape('vc' => int) {
    //                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.function.arguments.php
  }
}

function f(int $x, dict<int, ?int> $y): void {
  //               ^^^^ support.class.php
}

function f((bool, int, ?int) $y): void {
  //        ^^^^ storage.type.php
  //                         ^ punctuation.definition.variable
  //                          ^ variable.other.php
}

function f(int $x, (int, ?int) $y): void {
  //                ^^^ storage.type.php
  //                      ^^^ storage.type.php
  //                           ^ punctuation.definition.variable
  //                            ^ variable.other.php
}

function f(int $x, dict<int, (int, ?int)> $y): void {
  //               ^^^^ support.class.php
  //                          ^^^ storage.type.php
  //                                ^^^ storage.type.php
  //                                      ^ punctuation.definition.variable
  //                                       ^ variable.other.php
}

function f(int $a, arraykey $b, keyarray $c, ints $d, lint $e): void {
  //       ^^^ storage.type.php
  //               ^^^^^^^^ support.class.php
  //                            ^^^^^^^^ support.class.php
  //                                         ^^^^ support.class.php
  //                                                  ^^^^ support.class.php
}

function f(array<int> $a, array<lint> $b, keyarray<int> $c, arrays<ints> $d): void {
  //       ^^^^^ storage.type.array.php
  //             ^^^ storage.type.php
  //                      ^^^^^ storage.type.array.php
  //                            ^^^^ support.class.php
  //                                      ^^^^^^^^ support.class.php
  //                                               ^^^ storage.type.php
  //                                                        ^^^^^^ support.class.php
  //                                                               ^^^^ support.class.php
}
