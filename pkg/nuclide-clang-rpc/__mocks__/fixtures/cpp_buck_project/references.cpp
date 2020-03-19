#define RETURN(x) return x
int references_test(int var1) {
  int var2 = var1 * var1, var3;
  references_test(++var1 + 1);
  var1 = var2 + 1;
  // A different var1!
  for (int var1 = 0; -var1 < 10; var1++) {
    RETURN(var1);
  }
  RETURN(var1 * var1);
}
