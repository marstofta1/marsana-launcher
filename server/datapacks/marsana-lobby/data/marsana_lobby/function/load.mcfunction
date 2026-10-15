# Lobi merkezini bir marker işaretler; "gen" puanı yalnızca son kurulan lobinin geçerli olmasını sağlar.
# Oyuncularda aynı puan, girişte geçen süreyi (tick) sayar.
scoreboard objectives add marsana_lobby dummy
scoreboard objectives add marsana_lobby.left minecraft.custom:minecraft.leave_game
scoreboard objectives add lobi trigger
schedule function marsana_lobby:mobs 20t replace
