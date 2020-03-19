let loop_forever () =
let rec loop_forever_helper num =
  loop_forever_helper (num + 1) in
loop_forever_helper 0

let () =
  loop_forever ()
