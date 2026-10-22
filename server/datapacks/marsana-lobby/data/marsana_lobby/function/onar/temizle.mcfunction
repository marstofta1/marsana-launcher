# Geçici kopyayı (merkez +1024 x; ±49, -6..+30) 8 blokluk dilimlerle siler, chunk'ları bırakır.
# Lobi boyutunda merkez chunk'ı yüklü kalır (ışınlama merkez işaretçisini bulmalı).
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-49 ~-6 ~-49 ~-42 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-41 ~-6 ~-49 ~-34 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-33 ~-6 ~-49 ~-26 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-25 ~-6 ~-49 ~-18 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-17 ~-6 ~-49 ~-10 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-9 ~-6 ~-49 ~-2 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~-1 ~-6 ~-49 ~6 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~7 ~-6 ~-49 ~14 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~15 ~-6 ~-49 ~22 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~23 ~-6 ~-49 ~30 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~31 ~-6 ~-49 ~38 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~39 ~-6 ~-49 ~46 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run fill ~47 ~-6 ~-49 ~49 ~30 ~49 minecraft:air
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run kill @e[type=minecraft:item,distance=..80]
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run forceload remove ~-49 ~-49 ~49 ~49
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload remove ~-49 ~-49 ~49 ~49
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload add ~ ~
