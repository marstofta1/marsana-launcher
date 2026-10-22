# Kullanım (op): /function marsana_lobby:warp/sil {ad:"Parkur"}
$execute unless data storage marsana_lobby:warps list[{ad:"$(ad)"}] run return run tellraw @s {"text":"[Klima] \"$(ad)\" adında warp yok.","color":"red"}
$data remove storage marsana_lobby:warps list[{ad:"$(ad)"}]
$tellraw @s {"text":"[Klima] \"$(ad)\" warpı silindi.","color":"yellow"}
