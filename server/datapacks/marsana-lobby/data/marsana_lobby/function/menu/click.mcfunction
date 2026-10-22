advancement revoke @s only marsana_lobby:menu
# Başkasının kutusuna eşyasız tıklayan için bir şey olmaz.
execute unless predicate marsana_lobby:menu_el run return 0
function marsana_lobby:menu/open
