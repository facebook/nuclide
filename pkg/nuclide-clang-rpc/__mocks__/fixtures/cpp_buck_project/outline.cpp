int global_var;

namespace test_namespace {
namespace {
#pragma mark - before function
void function(const int, bool param) {
}
#pragma mark - after function
}
}

template<typename T>
int templated_function(T x) {
  return 0;
}

class TestClass {
  template<typename T>
  void method(T param) {
  }
  #pragma mark - inside TestClass
  void partialMethod();
  static int partialVar;
};

int TestClass::partialVar;

void TestClass::partialMethod() {
}
  #pragma mark Section 2
template<typename Ty>
class TemplateClass {
};

enum TestEnum {
  ENUM_VALUE_1,
  ENUM_VALUE_2,
};

#define TEST_F(x, y) 1

TEST_F ( a , b ) {}

//MARK: Section 3
// MARK:Section 4
// MARK: Section 5
// MARK: - Section 5
//MARK: -Section 6
#pragma mark - Section 7
#pragma mark //MARK: Section8
#pragma mark // MARK: Section9
// MARK: #pragma mark - Section 10

#pragma mark - end of file
