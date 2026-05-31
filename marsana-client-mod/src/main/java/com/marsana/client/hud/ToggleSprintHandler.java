package com.marsana.client.hud;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;

public final class ToggleSprintHandler {
    private ToggleSprintHandler() {}

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(ToggleSprintHandler::onTick);
    }

    private static void onTick(Minecraft client) {
        if (!HudFeatureRegistry.isEnabled(HudFeatureIds.TOGGLE_SPRINT)) {
            return;
        }
        LocalPlayer player = client.player;
        if (player == null || client.screen != null) {
            return;
        }
        if (player.input.keyPresses.forward() && !player.isSneaking() && !player.isUsingItem()) {
            player.setSprinting(true);
        }
    }
}
