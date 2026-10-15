# Lobi merkezini bir marker işaretler; "gen" puanı yalnızca son kurulan lobinin geçerli olmasını sağlar.
# Oyuncularda aynı puan, girişte geçen süreyi (tick) sayar.
scoreboard objectives add marsana_lobby dummy
scoreboard objectives add marsana_lobby.left minecraft.custom:minecraft.leave_game
scoreboard objectives add lobi trigger
scoreboard objectives add ayarlar trigger
scoreboard objectives add magaza trigger
# Oyun içi para. Yalnızca etkinliklerden kazanılır (para/ver, para/herkese), gerçek parayla satılmaz.
scoreboard objectives add marsanaty dummy "Marsanaty"
# Create Dünyası NPC'si için son survival konumu (x/z x10, y x100; boyut: -1 nether, 0 overworld, 1 end).
scoreboard objectives add marsana_lobby.px dummy
scoreboard objectives add marsana_lobby.py dummy
scoreboard objectives add marsana_lobby.pz dummy
scoreboard objectives add marsana_lobby.pd dummy
scoreboard objectives add marsana_lobby.ph dummy
# Profil NPC'si istatistikleri (objective oluşturulduğu andan itibaren sayar).
scoreboard objectives add marsana_lobby.play minecraft.custom:minecraft.play_time
scoreboard objectives add marsana_lobby.deaths deathCount
scoreboard objectives add marsana_lobby.kills minecraft.custom:minecraft.mob_kills
scoreboard objectives add marsana_lobby.walk minecraft.custom:minecraft.walk_one_cm
scoreboard objectives add marsana_lobby.sprint minecraft.custom:minecraft.sprint_one_cm
scoreboard objectives add marsana_lobby.calc dummy
scoreboard players set #60 marsana_lobby.calc 60
scoreboard players set #100 marsana_lobby.calc 100
scoreboard players set #1200 marsana_lobby.calc 1200
schedule function marsana_lobby:mobs 20t replace
