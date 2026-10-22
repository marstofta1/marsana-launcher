# Chunk'ın lobi alanıyla kesişimi: xa..xb, za..zb (merkezden ±48 ile kırpılmış). Kaynak: aynı yer +1024 x.
scoreboard players operation #xa marsana_lobby.calc = #chx marsana_lobby.calc
scoreboard players operation #xa marsana_lobby.calc > #xlo marsana_lobby.calc
scoreboard players operation #xb marsana_lobby.calc = #chx marsana_lobby.calc
scoreboard players add #xb marsana_lobby.calc 15
scoreboard players operation #xb marsana_lobby.calc < #xhi marsana_lobby.calc
scoreboard players operation #za marsana_lobby.calc = #chz marsana_lobby.calc
scoreboard players operation #za marsana_lobby.calc > #zlo marsana_lobby.calc
scoreboard players operation #zb marsana_lobby.calc = #chz marsana_lobby.calc
scoreboard players add #zb marsana_lobby.calc 15
scoreboard players operation #zb marsana_lobby.calc < #zhi marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.xa int 1 run scoreboard players get #xa marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.xb int 1 run scoreboard players get #xb marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.za int 1 run scoreboard players get #za marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.zb int 1 run scoreboard players get #zb marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.y0 int 1 run scoreboard players get #y0 marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.y1 int 1 run scoreboard players get #y1 marsana_lobby.calc
scoreboard players add #xa marsana_lobby.calc 1024
scoreboard players add #xb marsana_lobby.calc 1024
execute store result storage marsana_lobby:tmp o.sxa int 1 run scoreboard players get #xa marsana_lobby.calc
execute store result storage marsana_lobby:tmp o.sxb int 1 run scoreboard players get #xb marsana_lobby.calc
function marsana_lobby:onar/chunk with storage marsana_lobby:tmp o
scoreboard players add #chz marsana_lobby.calc 16
execute if score #chz marsana_lobby.calc <= #zhi marsana_lobby.calc run function marsana_lobby:onar/z
