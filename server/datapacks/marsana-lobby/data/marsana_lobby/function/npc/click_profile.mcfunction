advancement revoke @s only marsana_lobby:npc/profile
# Oyun süresi: tick → toplam dakika → saat + dakika. Mesafe: cm → metre.
scoreboard players operation #min marsana_lobby.calc = @s marsana_lobby.play
scoreboard players operation #min marsana_lobby.calc /= #1200 marsana_lobby.calc
scoreboard players operation #h marsana_lobby.calc = #min marsana_lobby.calc
scoreboard players operation #h marsana_lobby.calc /= #60 marsana_lobby.calc
scoreboard players operation #m marsana_lobby.calc = #min marsana_lobby.calc
scoreboard players operation #m marsana_lobby.calc %= #60 marsana_lobby.calc
scoreboard players operation #dist marsana_lobby.calc = @s marsana_lobby.walk
scoreboard players operation #dist marsana_lobby.calc += @s marsana_lobby.sprint
scoreboard players operation #dist marsana_lobby.calc /= #100 marsana_lobby.calc
scoreboard players add @s marsana_lobby.deaths 0
scoreboard players add @s marsana_lobby.kills 0
scoreboard players add @s marsanaty 0
tellraw @s ["",{"text":"━━━━━ ","color":"dark_gray"},{"text":"Profil: ","color":"aqua","bold":true},{"selector":"@s","color":"yellow","bold":true},{"text":" ━━━━━","color":"dark_gray"}]
tellraw @s ["",{"text":" Oyun süresi: ","color":"gray"},{"score":{"name":"#h","objective":"marsana_lobby.calc"},"color":"white"},{"text":" sa ","color":"white"},{"score":{"name":"#m","objective":"marsana_lobby.calc"},"color":"white"},{"text":" dk","color":"white"}]
tellraw @s ["",{"text":" Ölüm: ","color":"gray"},{"score":{"name":"@s","objective":"marsana_lobby.deaths"},"color":"white"}]
tellraw @s ["",{"text":" Öldürülen yaratık: ","color":"gray"},{"score":{"name":"@s","objective":"marsana_lobby.kills"},"color":"white"}]
tellraw @s ["",{"text":" Yürünen mesafe: ","color":"gray"},{"score":{"name":"#dist","objective":"marsana_lobby.calc"},"color":"white"},{"text":" m","color":"white"}]
tellraw @s ["",{"text":" Marsanaty: ","color":"gray"},{"score":{"name":"@s","objective":"marsanaty"},"color":"gold"}]
tellraw @s {"text":" (İstatistikler lobi kurulduğundan beri sayılıyor.)","color":"dark_gray","italic":true}
