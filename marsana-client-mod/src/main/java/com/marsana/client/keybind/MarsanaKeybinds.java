package com.marsana.client.keybind;

import com.marsana.client.MarsanaClientMod;
import com.marsana.client.menu.MarsanaMenuScreen;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;
import org.lwjgl.glfw.GLFW;

public final class MarsanaKeybinds {
    private static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(
        Identifier.fromNamespaceAndPath(MarsanaClientMod.MOD_ID, "category")
    );
    private static KeyMapping openMenuKey;

    private MarsanaKeybinds() {}

    public static void register() {
        openMenuKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
            "key.marsana-client.menu",
            InputConstants.Type.KEYSYM,
            GLFW.GLFW_KEY_H,
            CATEGORY
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openMenuKey.consumeClick()) {
                openMenu(client);
            }
        });
    }

    private static void openMenu(Minecraft client) {
        if (client.player == null || client.screen != null) {
            return;
        }
        client.execute(() -> {
            if (client.player != null && client.screen == null) {
                client.setScreen(new MarsanaMenuScreen());
            }
        });
    }

}
