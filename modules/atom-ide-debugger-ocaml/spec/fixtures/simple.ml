(** Add a lot of fields to make sure that the watch window/identifier hovering
    don't truncate fields. *)
type t = {
  name : string;
  id : int;
  field1: string;
  field2: string;
  field3: string;
  field4: string;
  field5: string;
}

let print_t (my_t: t) =
  Printf.printf "{name=\"%s\"; id=%d}\n" my_t.name my_t.id

let main () =
  let my_thing = {
    name = "My t";
    id = 1349;
    field1 = "Field 1";
    field2 = "Field 2";
    field3 = "Field 3";
    field4 = "Field 4";
    field5 = "Field 5"
  } in (
  print_t my_thing;
  print_t { my_thing with name = "My different t" };
  print_t { my_thing with name = "My very different t" };
  print_t { my_thing with name = "My extremely different t" })

let () =
  main ()
