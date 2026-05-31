package com.marsana.client;

import com.marsana.client.config.MarsanaConfigManager;
import com.marsana.client.cosmetics.CosmeticsManager;
import com.marsana.client.keybind.MarsanaKeybinds;
import com.marsana.client.mods.ModToggleManager;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;

public class MarsanaClientMod implements ClientModInitializer {
    public static final String MOD_ID = "marsana-client";
    private static boolean runtimePrefsApplied;

    @Override
    public void onInitializeClient() {
        MarsanaConfigManager.load();
        CosmeticsManager.initTextures();
        MarsanaKeybinds.register();
        Runtime.getRuntime().addShutdownHook(new Thread(ModToggleManager::applyPendingFileToggles, "marsana-mod-sync"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (!runtimePrefsApplied && client.level != null && client.player != null) {
                runtimePrefsApplied = true;
                ModToggleManager.applyRuntimeFromConfig();
            }
        });
    }
}
