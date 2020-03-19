// SYNTAX TEST "text.html.hack"
<?hh

$r = $a == $b;
//      ^^ keyword.operator.comparison.php
$r = $a === $b;
//      ^^^ keyword.operator.comparison.php
$r = $a -> $b;
//      ^^ keyword.operator.class.php
$r = dict[$a => $b];
//           ^^ keyword.operator.key.php
$r = $a ==> $b;
//      ^^^ keyword.operator.lambda.php
$r = $a |> $b;
//      ^^ keyword.operator.pipe.php
$r = $a is int;
//      ^^ keyword.operator.type.php
$r = $a as int;
//      ^^ keyword.operator.type.php
