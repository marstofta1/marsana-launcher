package com.marsana.client;

import com.marsana.client.config.MarsanaConfigManager;
import com.marsana.client.cosmetics.CosmeticsManager;
import com.marsana.client.keybind.MarsanaKeybinds;
import net.fabricmc.api.ClientModInitializer;

public class MarsanaClientMod implements ClientModInitializer {
    public static final String MOD_ID = "marsana-client";

    @Override
    public void onInitializeClient() {
        MarsanaConfigManager.load();
        CosmeticsManager.initTextures();
        MarsanaKeybinds.register();
    }
}
