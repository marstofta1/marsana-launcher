# Girişte lobiye ışınlama: ilk kez görülen ya da oyundan çıkıp geri gelen oyuncu "bekliyor" olur.
tag @a[tag=!marsana_lobby.seen] add marsana_lobby.pending
tag @a[tag=!marsana_lobby.seen] add marsana_lobby.seen
tag @a[scores={marsana_lobby.left=1..}] add marsana_lobby.pending
scoreboard players reset @a[scores={marsana_lobby.left=1..}] marsana_lobby.left
execute as @a[tag=marsana_lobby.pending] run function marsana_lobby:join_wait

# /trigger lobi — herkes lobiye dönebilir. /trigger ayarlar — Ayarlar NPC'sinin menüsü. /trigger magaza — Shop.
scoreboard players enable @a lobi
scoreboard players enable @a ayarlar
scoreboard players enable @a magaza
scoreboard players enable @a warp
execute as @a[scores={lobi=1..}] run function marsana_lobby:lobi
execute as @a[scores={ayarlar=1..}] run function marsana_lobby:npc/settings_trigger
execute as @a[scores={magaza=1..}] run function marsana_lobby:shop/trigger
execute as @a[scores={warp=1..}] run function marsana_lobby:warp/trigger

# AFK köylüsü: AFK oyuncu kayıtlı konumundan uzaklaşınca AFK biter.
execute as @a[tag=marsana_lobby.afk] run function marsana_lobby:afk/check

# Ranklar: etiketi olan Moderatör, diğer herkes Oyuncu takımında.
team join marsana.mod @a[tag=marsana.rank.mod,team=!marsana.mod]
team join marsana.oyuncu @a[tag=!marsana.rank.mod,team=!marsana.oyuncu]

# Parkur: bitiş platformuna (merkezden -21 +9 -33) ulaşan oyuncu; uzaklaşınca tekrar sayılabilir.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-21 ~9 ~-33 as @a[distance=..1.6,tag=!marsana_lobby.parkur_cd] run function marsana_lobby:parkur/finish
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-21 ~9 ~-33 run tag @a[tag=marsana_lobby.parkur_cd,distance=4..] remove marsana_lobby.parkur_cd

# Sunucu geneli: TNT patlamaları kapalı. Ateşlenen TNT ve ateşlenmiş TNT'li vagon patlamadan silinir.
kill @e[type=minecraft:tnt]
kill @e[type=minecraft:tnt_minecart,nbt=!{TNTFuse:-1}]

# Lobi kutusu: merkezden yatayda ±49 (97x97 genişletilmiş lobi), dikeyde -10..+30 blok.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-49 ~-10 ~-49 run tag @a[dx=98,dy=40,dz=98] add marsana_lobby.in
execute as @a[tag=marsana_lobby.in] run function marsana_lobby:inside
execute as @a[tag=!marsana_lobby.in,tag=marsana_lobby.adv] run function marsana_lobby:outside
# Lobi dışında (Create dünyası, Nether, End) admin olmayanlar creative'dedir; girişte bekleyenlere dokunulmaz.
execute as @a[tag=!marsana_lobby.in,tag=!marsana.admin,tag=!marsana_lobby.pending,gamemode=!creative,gamemode=!spectator] run gamemode creative @s
tag @a remove marsana_lobby.in
# Claim mesajı: macera modunda blok kırma denemesi sunucuya gelmez. Korumalı oyuncunun baktığı bloğa görünmez
# bir tıklama kutusu (interaction) konur; sol tık kutuya gider ve claim advancement'ı mesajı verir.
tag @e[type=minecraft:interaction,tag=marsana_lobby.claimbox] add marsana_lobby.stale
execute as @a[tag=marsana_lobby.adv,tag=!marsana.admin,gamemode=adventure] at @s anchored eyes positioned ^ ^ ^ run function marsana_lobby:claim/player
kill @e[type=minecraft:interaction,tag=marsana_lobby.stale]
scoreboard players remove @a[scores={marsana_lobby.claimcd=1..}] marsana_lobby.claimcd 1
