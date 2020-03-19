// SYNTAX TEST "text.html.hack"
<?hh

function example() {
  return (
    <MyComponent myAttr={123} anotherAttr="test">
    // ^ entity.name.tag.open.xhp
    //              ^ entity.other.attribute-name.xhp
    //                  ^ meta.embedded.expression.php punctuation.section.embedded.begin.xhp
    //                    ^ constant.numeric
    //                            ^ entity.other.attribute-name.xhp
    //                                      ^ string.quoted.double.php
      <AnotherComponent
        attr={"double"}
        //       ^ string.quoted.double.php
        attr={'single'}
        //       ^ string.quoted.single.php
        attr={$phpVar}
        //       ^ variable.other.php
      />
      // <- punctuation.definition.tag.xhp
      <!-- HTML
      // <- comment.block.html punctuation.definition.comment.html
           COMMENT -->
      //            ^ comment.block.html punctuation.definition.comment.html

    </MyComponent>
    // ^ entity.name.tag.close.xhp
  );
}

function exampleLiteralCollections() {
  return (
    return <Test myAttr={Vector{1, 2, 3}} />
    //                     ^ support.class.php
    //                         ^ punctuation.section.array.begin.php
    //                                 ^ punctuation.section.array.end.php
    //                                  ^ punctuation.section.embedded.end.xhp
  );
}

function exampleXHPBracketHighlighting() {
  return (
    <Test>
    {
//  ^ punctuation.section.embedded.begin.xhp

      if (true) {}
//              ^ punctuation.section.scope.begin.php
//               ^ punctuation.section.scope.end.php
    }
//  ^ punctuation.section.embedded.end.xhp
    </Test>
  )
}

function exampleXHPComments() {
  return (
    <ui:foo
      <!--attr={'test'}-->
//    ^ comment.block.html punctuation.definition.comment.html
    />
    if (true) {
//            ^ punctuation.section.scope.begin.php
    }
  )
}
