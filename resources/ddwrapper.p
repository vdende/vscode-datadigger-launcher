block-level on error undo, throw.

define variable ddpath as character no-undo.

ddpath = os-getenv("DD_PATH").

file-info:file-name = ddpath.
if file-info:file-type eq ? or not file-info:file-type matches "*D*" then do:
  message substitute("ERROR: Unable to locate DataDigger path: &1", ddpath) view-as alert-box error.
  quit.
end.

propath = substitute("&1,&2", ddpath, propath).
run DataDigger.p.

finally:
  quit.
end finally.
