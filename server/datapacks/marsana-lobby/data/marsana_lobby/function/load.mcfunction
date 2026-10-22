# Lobi merkezini bir marker işaretler; "gen" puanı yalnızca son kurulan lobinin geçerli olmasını sağlar.
# Oyuncularda aynı puan, girişte geçen süreyi (tick) sayar.
# Sunucu geneli: ateş yayılmaz, blokları yakmaz (TNT de tick.mcfunction'da kapatılır).
gamerule doFireTick false
# Sohbet temiz kalsın: komut bloğu çıktısı, "oyun modun değişti" gibi komut geri bildirimleri ve
# op'lara giden "[Server: ...]" kayıtları gösterilmez (sunucu günlüğüne yine yazılır).
gamerule commandBlockOutput false
gamerule sendCommandFeedback false
gamerule logAdminCommands false
scoreboard objectives add marsana_lobby dummy
scoreboard objectives add marsana_lobby.left minecraft.custom:minecraft.leave_game
scoreboard objectives add lobi trigger
scoreboard objectives add ayarlar trigger
scoreboard objectives add magaza trigger
scoreboard objectives add warp trigger
# Işınlanma Menüsü eşyası: menüdeki seçim, menü bekleme süresi (tick), menü eşyasıyla asılan üretim planı (eski tablo sayacı silinir).
scoreboard objectives add isinlan trigger
scoreboard objectives add marsana_lobby.menucd dummy
scoreboard objectives remove marsana_lobby.tablo
scoreboard objectives add marsana_lobby.plan minecraft.used:create.crafting_blueprint
# End City NPC'sinin ışınladığı şehir (Klima SMP dünyasında 0 0'a en yakın End City); npc/endcity_ayarla ile değişir.
execute unless data storage marsana_lobby:ayar endcity run data modify storage marsana_lobby:ayar endcity set value {x:-576,z:-928}
# Oyun içi para. Yalnızca etkinliklerden kazanılır (para/ver, para/herkese), gerçek parayla satılmaz.
scoreboard objectives add marsanaty dummy "Marsanaty"
# Create Dünyası NPC'si için son survival konumu (x/z x10, y x100; boyut: -1 nether, 0 overworld, 1 end).
scoreboard objectives add marsana_lobby.px dummy
scoreboard objectives add marsana_lobby.py dummy
scoreboard objectives add marsana_lobby.pz dummy
scoreboard objectives add marsana_lobby.pd dummy
scoreboard objectives add marsana_lobby.ph dummy
# Create Dünyası 2 (düz dünya) NPC'si için oradaki son konum (aynı ölçek; d2h 1 = kayıtlı).
scoreboard objectives add marsana_lobby.d2x dummy
scoreboard objectives add marsana_lobby.d2y dummy
scoreboard objectives add marsana_lobby.d2z dummy
scoreboard objectives add marsana_lobby.d2h dummy
# AFK köylüsü: AFK'ya girilen konum (x10).
scoreboard objectives add marsana_lobby.ax dummy
scoreboard objectives add marsana_lobby.ay dummy
scoreboard objectives add marsana_lobby.az dummy
# Ranklar: herkes Oyuncu, Shop'tan alınan Moderatör (marsana.rank.mod etiketi). Ön ek sohbette ve TAB listesinde görünür.
team add marsana.oyuncu "Oyuncu"
team modify marsana.oyuncu prefix {"text":"[Oyuncu] ","color":"gray"}
team modify marsana.oyuncu color white
team add marsana.mod "Moderatör"
team modify marsana.mod prefix {"text":"[Moderatör] ","color":"aqua","bold":true}
team modify marsana.mod color aqua
# Claim mesajı: oyuncu kimliği (tıklama kutusunu oyuncuya bağlar) ve mesaj bekleme süresi (tick).
scoreboard objectives add marsana_lobby.pid dummy
scoreboard objectives add marsana_lobby.claimcd dummy
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
# Klima SMP yan menüsü: Türkiye saati, çevrimiçi oyuncular ve Marsanaty bakiyeleri.
scoreboard objectives add marsana_lobby.saat dummy
scoreboard objectives add marsana_lobby.sb dummy
scoreboard objectives modify marsana_lobby.sb displayname {"text":"KLIMA SMP","color":"aqua","bold":true}
scoreboard objectives modify marsana_lobby.sb numberformat styled {"color":"gold"}
scoreboard objectives setdisplay sidebar marsana_lobby.sb
scoreboard players set #60 marsana_lobby.saat 60
scoreboard players set #10 marsana_lobby.saat 10
scoreboard players set #3600 marsana_lobby.saat 3600
# Sunucu kapalıyken geçen süre bilinemez: açılışta saat ayarlanmamış sayılır (op: saat/ayarla).
scoreboard players set #sync marsana_lobby.saat 0
# Ölüp yatak noktası olmadan doğan oyuncu lobiye döner (respawn.mcfunction).
scoreboard objectives add marsana_lobby.respawn deathCount
