$execute unless data storage marsana_lobby:warps list[{id:$(id)}] run return run tellraw @s {"text":"Bu warp artık yok.","color":"red"}
$function marsana_lobby:warp/tp with storage marsana_lobby:warps list[{id:$(id)}]
