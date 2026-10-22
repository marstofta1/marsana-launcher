scoreboard players operation #chz marsana_lobby.calc = #z0 marsana_lobby.calc
function marsana_lobby:onar/z
scoreboard players add #chx marsana_lobby.calc 16
execute if score #chx marsana_lobby.calc <= #xhi marsana_lobby.calc run function marsana_lobby:onar/x
