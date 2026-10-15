package com.marsana.lobbyclaim;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.GameType;
import net.minecraft.world.phys.HitResult;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.item.ItemTossEvent;
import net.neoforged.neoforge.event.entity.player.AttackEntityEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.tick.PlayerTickEvent;

/**
 * Lobide blok kırmaya çalışana "Burası claim'li" mesajı.
 *
 * Lobi koruması marsana-lobby datapack'inde: admin olmayanlar lobide macera modundadır. Macera modunda
 * istemci blok kırma isteğini sunucuya hiç göndermez; sunucuya yalnızca kol sallama ulaşır. Bu yüzden
 * kol sallayan oyuncunun baktığı yerde menzil içinde bir blok varsa mesaj verilir. Sağ tık, varlığa vurma
 * ve eşya atma da kol sallattığı için bu eylemlerden hemen sonraki sallamalar sayılmaz.
 */
@Mod(LobbyClaim.MOD_ID)
public final class LobbyClaim {
    public static final String MOD_ID = "marsana_lobby_claim";

    // Datapack etiketleri: marsana_lobby.adv = lobide macera moduna alınmış oyuncu, marsana.admin = admin.
    private static final String TAG_LOBBY = "marsana_lobby.adv";
    private static final String TAG_ADMIN = "marsana.admin";
    private static final int ACTION_GRACE_TICKS = 2;
    private static final int MESSAGE_COOLDOWN_TICKS = 40;

    private static final Map<UUID, Integer> lastAction = new HashMap<>();
    private static final Map<UUID, Integer> lastMessage = new HashMap<>();

    public LobbyClaim() {
        NeoForge.EVENT_BUS.register(LobbyClaim.class);
    }

    private static boolean isProtected(ServerPlayer player) {
        return player.gameMode.getGameModeForPlayer() == GameType.ADVENTURE
                && player.getTags().contains(TAG_LOBBY)
                && !player.getTags().contains(TAG_ADMIN);
    }

    private static void markAction(Player player) {
        if (player instanceof ServerPlayer sp) {
            lastAction.put(sp.getUUID(), sp.server.getTickCount());
        }
    }

    @SubscribeEvent
    public static void onRightClickBlock(PlayerInteractEvent.RightClickBlock event) { markAction(event.getEntity()); }

    @SubscribeEvent
    public static void onRightClickItem(PlayerInteractEvent.RightClickItem event) { markAction(event.getEntity()); }

    @SubscribeEvent
    public static void onEntityInteract(PlayerInteractEvent.EntityInteract event) { markAction(event.getEntity()); }

    @SubscribeEvent
    public static void onEntityInteractSpecific(PlayerInteractEvent.EntityInteractSpecific event) { markAction(event.getEntity()); }

    @SubscribeEvent
    public static void onAttackEntity(AttackEntityEvent event) { markAction(event.getEntity()); }

    @SubscribeEvent
    public static void onItemToss(ItemTossEvent event) { markAction(event.getPlayer()); }

    @SubscribeEvent
    public static void onPlayerTick(PlayerTickEvent.Post event) {
        if (!(event.getEntity() instanceof ServerPlayer player)) return;
        // swing() swingTime'ı -1 yapar, sonraki tick'te 0 olur: yeni bir kol sallama.
        if (!player.swinging || player.swingTime != 0) return;
        if (!isProtected(player)) return;

        int now = player.server.getTickCount();
        UUID id = player.getUUID();
        Integer action = lastAction.get(id);
        if (action != null && now - action <= ACTION_GRACE_TICKS) return;

        HitResult hit = player.pick(player.blockInteractionRange(), 1.0F, false);
        if (hit.getType() != HitResult.Type.BLOCK) return;

        Integer msg = lastMessage.get(id);
        if (msg != null && now - msg < MESSAGE_COOLDOWN_TICKS) return;
        lastMessage.put(id, now);
        player.sendSystemMessage(Component.literal("Burası claim'li, kıramazsın!").withStyle(ChatFormatting.RED));
    }

    @SubscribeEvent
    public static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        lastAction.remove(event.getEntity().getUUID());
        lastMessage.remove(event.getEntity().getUUID());
    }
}
