# 0,1 blok adımlarla ilerle; varlıklara vurma menzili 3 blok olduğundan en fazla 3,1 blok.
scoreboard players add #steps marsana_lobby.calc 1
execute unless block ~ ~ ~ #marsana_lobby:ray_pass run return run function marsana_lobby:claim/hit
execute if score #steps marsana_lobby.calc matches ..31 positioned ^ ^ ^0.1 run function marsana_lobby:claim/ray
