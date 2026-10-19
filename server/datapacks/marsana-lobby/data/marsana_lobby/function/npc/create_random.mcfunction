# Kayıtlı konumu olmayan (yeni) oyuncu: Create dünyasında, lobinin koordinatları çevresinde 300 blok içinde rastgele güvenli bir nokta.
# Nokta lobinin (merkezden ±48) içine düşerse 10 denemeye kadar yeniden seçilir.
scoreboard players set #try marsana_lobby.calc 0
function marsana_lobby:npc/create_random_try
tellraw @s {"text":"[Marsana] Create dünyasına hoş geldin! Lobiye dönmek için: /trigger lobi","color":"gold"}
