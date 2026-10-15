# Fiyatları değiştirirken buy_*.mcfunction içindeki fiyatı da güncelle.
scoreboard players add @s marsanaty 0
tellraw @s ["",{"text":"━━━━━ ","color":"dark_gray"},{"text":"Shop","color":"green","bold":true},{"text":" ━━━━━ ","color":"dark_gray"},{"text":"(satın almak için tıkla)","color":"dark_gray","italic":true}]
tellraw @s ["",{"text":" Bakiyen: ","color":"gray"},{"score":{"name":"@s","objective":"marsanaty"},"color":"gold","bold":true},{"text":" Marsanaty","color":"gold"}]
tellraw @s ["",{"text":" Komut bloğu x1 ","color":"white"},{"text":"— 300 Marsanaty ","color":"gold"},{"text":"[SATIN AL]","color":"green","bold":true,"clickEvent":{"action":"run_command","value":"/trigger magaza set 1"},"hoverEvent":{"action":"show_text","contents":"300 Marsanaty öde.\nNot: Komut bloğunu yalnızca op'lar yere koyabilir."}}]
tellraw @s ["",{"text":" Bariyer x1 ","color":"white"},{"text":"— 1000 Marsanaty ","color":"gold"},{"text":"[SATIN AL]","color":"green","bold":true,"clickEvent":{"action":"run_command","value":"/trigger magaza set 2"},"hoverEvent":{"action":"show_text","contents":"1000 Marsanaty öde.\nBariyer survival'da kırılamaz."}}]
tellraw @s {"text":" Marsanaty yalnızca etkinliklerden kazanılır, gerçek parayla satılmaz.","color":"dark_gray","italic":true}
