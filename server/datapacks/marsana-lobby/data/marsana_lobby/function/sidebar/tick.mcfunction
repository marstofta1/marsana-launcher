# Klima SMP yan menüsü: saniyede bir saati ilerletir ve menüyü yeniden kurar.
scoreboard players add #tick marsana_lobby.saat 1
execute if score #tick marsana_lobby.saat matches 20.. run function marsana_lobby:sidebar/second
