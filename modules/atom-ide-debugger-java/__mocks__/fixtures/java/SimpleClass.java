public class SimpleClass {
  private String name;
  private int id;

  public static void main(String[] args) {
    String name = "Not Aman Agarwal";
    int id = 1234567890;
    SimpleClass tc = new SimpleClass(name, id);
    tc.print();
    tc.setName("Definitely Not Aman Agarwal");
    tc.print();
    tc.setName("You got me, it's Aman Agarwal");
    tc.print();
  }

  public SimpleClass(String name, int id) {
    this.name = name;
    this.id = id;
  }

  public SimpleClass setName(String newName) {
    name = newName;
    return this;
  }

  public void print() {
    System.out.println("Name: " + name + " with id: " + id);
  }
}
