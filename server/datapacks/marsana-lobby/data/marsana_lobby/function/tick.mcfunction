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
# Parkur düşme: alan merkezden x -42..-18, z -40..-20 (KB köşesi). Zemin y 0, başlangıç platformu y 1, atlamalar y 2..9.
# İlk atlama bloğuna çıkan (ayak y>=2, hitbox başlangıç platformundakinin üstünde) "parkurda" sayılır;
# parkurdayken ilk atlamanın altına (ayak y<1.7: zemin, çit, duvar üstü) inen başa döner; başlangıç platformuna
# (ayak y 1) dönen yalnızca parkurdan çıkar. Alandan çıkan parkurdan sayılmaz.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-42 ~2.9 ~-40 run tag @a[dx=24,dy=10,dz=20,tag=!marsana_lobby.parkur_cd] add marsana_lobby.parkur
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-21 ~0.5 ~-23 run tag @a[tag=marsana_lobby.parkur,dx=2,dy=0,dz=2] remove marsana_lobby.parkur
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-42 ~-0.5 ~-40 as @a[tag=marsana_lobby.parkur,dx=24,dy=1.2,dz=20] run function marsana_lobby:parkur/fall
execute as @a[tag=marsana_lobby.parkur] at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-42 ~-2 ~-40 unless entity @s[dx=24,dy=14,dz=20] run tag @s remove marsana_lobby.parkur

# Sunucu geneli: TNT patlamaları kapalı. Ateşlenen TNT ve ateşlenmiş TNT'li vagon patlamadan silinir.
kill @e[type=minecraft:tnt]
kill @e[type=minecraft:tnt_minecart,nbt=!{TNTFuse:-1}]
# Creeper patlaması kapalı: patlama yarıçapı 0 (bloklara ve oyunculara zarar vermez).
execute as @e[type=minecraft:creeper,tag=!marsana.safe] run data merge entity @s {ExplosionRadius:0b,Tags:["marsana.safe"]}
# End Crystal: End dışında ve End'de ejderha adası (merkezden 200 blok) dışında koyulan kristal silinir, eşyası geri düşer.
execute as @e[type=minecraft:end_crystal] at @s unless dimension minecraft:the_end run function marsana_lobby:guvenlik/crystal
execute as @e[type=minecraft:end_crystal] at @s if dimension minecraft:the_end unless entity @s[x=0,y=64,z=0,distance=..200] run function marsana_lobby:guvenlik/crystal
# Yatak (Nether/End) ve diriltici (Overworld/End) patlamaları data/minecraft/dimension_type ile kapalı; ikisi de her boyutta doğma noktası olur.

# Lobi kutusu: merkezden yatayda ±49 (97x97 genişletilmiş lobi), dikeyde -10..+30 blok.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-49 ~-10 ~-49 run tag @a[dx=98,dy=40,dz=98] add marsana_lobby.in
# End lobisi: ana adanın ortasında (0 62 0) kurulu bina, x -10..10, y 52..82, z -10..10. Aynı koruma (macera modu, hasar yok).
execute in minecraft:the_end positioned -10 52 -10 run tag @a[dx=20,dy=30,dz=20] add marsana_lobby.in
# End lobisi adminler için de claim'li: endlobi etiketi bir sonraki tick'e kadar kalır (claim/attack tick arasında okur).
tag @a remove marsana_lobby.endlobi
execute in minecraft:the_end positioned -10 52 -10 run tag @a[dx=20,dy=30,dz=20] add marsana_lobby.endlobi
execute as @a[tag=marsana_lobby.in] run function marsana_lobby:inside
# Lobi boyutunda lobi kutusunun dışına çıkan (boşluğa düşen) admin olmayan oyuncu merkeze döner; adminler yalnız y<-64'te.
# Login System'in bekleme alanındaki oyuncuya dokunulmaz; yoksa her tick bekleme alanı ile merkez arasında
# ışınlanır, chunk'lar yüklenemez ve lobi yarım görünür.
execute as @a[tag=!marsana_lobby.in,tag=!marsana.admin,tag=!marsana_lobby.waiting] at @s if dimension marsana_lobby:lobi run function marsana_lobby:teleport
execute as @a[tag=marsana.admin] at @s if dimension marsana_lobby:lobi if entity @s[y=-400,dy=335] run function marsana_lobby:teleport
execute as @a[scores={marsana_lobby.respawn=1..}] run function marsana_lobby:respawn
execute as @a[tag=!marsana_lobby.in,tag=marsana_lobby.adv,tag=!marsana_lobby.pending] run function marsana_lobby:outside
# Lobi dışında (Create dünyası, Nether, End) admin olmayanlar creative'dedir; girişte bekleyenlere dokunulmaz.
execute as @a[tag=!marsana_lobby.in,tag=!marsana.admin,tag=!marsana_lobby.pending,gamemode=!creative,gamemode=!spectator] run gamemode creative @s
tag @a remove marsana_lobby.in
# Claim mesajı: macera modunda blok kırma denemesi sunucuya gelmez. Korumalı oyuncunun baktığı bloğa görünmez
# bir tıklama kutusu (interaction) konur; sol tık kutuya gider ve claim advancement'ı mesajı verir.
tag @e[type=minecraft:interaction,tag=marsana_lobby.claimbox] add marsana_lobby.stale
execute as @a[tag=marsana_lobby.adv,tag=!marsana.admin,gamemode=adventure] at @s anchored eyes positioned ^ ^ ^ run function marsana_lobby:claim/player
execute as @a[tag=marsana_lobby.endlobi,tag=marsana.admin,gamemode=adventure] at @s anchored eyes positioned ^ ^ ^ run function marsana_lobby:claim/player
kill @e[type=minecraft:interaction,tag=marsana_lobby.stale]
scoreboard players remove @a[scores={marsana_lobby.claimcd=1..}] marsana_lobby.claimcd 1

# Klima SMP yan menüsü (saniyede bir yenilenir).
function marsana_lobby:sidebar/tick
