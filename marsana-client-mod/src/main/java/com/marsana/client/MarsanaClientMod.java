package com.marsana.client;

import com.marsana.client.config.MarsanaConfigManager;
import com.marsana.client.cosmetics.CosmeticsManager;
import com.marsana.client.friends.FriendsNetworking;
import com.marsana.client.hud.HudFeatureRegistry;
import com.marsana.client.hud.HudOverlayRenderer;
import com.marsana.client.hud.ToggleSprintHandler;
import com.marsana.client.hud.ZoomHandler;
import com.marsana.client.keybind.MarsanaKeybinds;
import com.marsana.client.mods.ModToggleManager;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;

public class MarsanaClientMod implements ClientModInitializer {
    public static final String MOD_ID = "marsana-client";
    private static boolean runtimePrefsApplied;
    private static java.util.UUID lastRecordedUuid;

    @Override
    public void onInitializeClient() {
        MarsanaConfigManager.load();
        HudFeatureRegistry.ensureDefaults();
        CosmeticsManager.initTextures();
        MarsanaKeybinds.register();
        HudOverlayRenderer.register();
        ZoomHandler.register();
        ToggleSprintHandler.register();
        FriendsNetworking.registerClientHandlers();
        Runtime.getRuntime().addShutdownHook(new Thread(ModToggleManager::applyPendingFileToggles, "marsana-mod-sync"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player != null) {
                java.util.UUID uuid = client.player.getUUID();
                if (!uuid.equals(lastRecordedUuid)) {
                    lastRecordedUuid = uuid;
                    MarsanaConfigManager.setLocalPlayerUuid(uuid);
                }
            }
            if (!runtimePrefsApplied && client.level != null && client.player != null) {
                runtimePrefsApplied = true;
                ModToggleManager.applyRuntimeFromConfig();
            }
        });
    }
}
