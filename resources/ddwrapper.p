block-level on error undo, throw.

using Progress.Json.ObjectModel.JsonObject.
using Progress.Json.ObjectModel.ObjectModelParser.

define variable cfgFile as character         no-undo.
define variable parser  as ObjectModelParser no-undo.
define variable config  as JsonObject        no-undo.

cfgFile = session:parameter.
parser  = new ObjectModelParser().
config  = cast(parser:ParseFile(cfgFile), JsonObject).

log-manager:logfile-name = config:GetCharacter("clientLog").
log-manager:write-message(substitute("Using config file: &1", cfgFile)).
log-manager:write-message(string(config:GetJsonText())).

message num-dbs skip propath view-as alert-box.

finally:
  os-delete value(cfgFile).
  log-manager:close-log().
  quit.
end finally.
