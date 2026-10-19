# Ölen oyuncu yeniden doğunca: yatağı/diriltici noktası yoksa (dünya doğuşu, eski lobi yeri) lobiye ışınlanır.
execute if data entity @s {Health:0.0f} run return 0
scoreboard players reset @s marsana_lobby.respawn
execute if data entity @s SpawnX run return 0
function marsana_lobby:teleport
