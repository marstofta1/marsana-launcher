package com.marsana.client.hud;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;
import com.marsana.client.MarsanaClientMod;
import org.lwjgl.glfw.GLFW;

public final class ZoomHandler {
    private static KeyMapping zoomKey;
    private static int savedFov = 70;
    private static boolean zoomActive;

    private ZoomHandler() {}

    public static void register() {
        KeyMapping.Category category = KeyMapping.Category.register(
            Identifier.fromNamespaceAndPath(MarsanaClientMod.MOD_ID, "hud")
        );
        zoomKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
            "key.marsana-client.zoom",
            InputConstants.Type.KEYSYM,
            GLFW.GLFW_KEY_C,
            category
        ));

        ClientTickEvents.END_CLIENT_TICK.register(ZoomHandler::onTick);
    }

    private static void onTick(Minecraft client) {
        if (!HudFeatureRegistry.isEnabled(HudFeatureIds.ZOOM)) {
            if (zoomActive) {
                restoreFov(client);
            }
            return;
        }
        if (client.player == null || client.screen != null) {
            if (zoomActive) {
                restoreFov(client);
            }
            return;
        }

        boolean wantZoom = zoomKey.isDown();
        if (wantZoom && !zoomActive) {
            savedFov = client.options.fov().get();
            zoomActive = true;
            client.options.fov().set(Math.max(10, Math.round(savedFov * 0.35f)));
        } else if (!wantZoom && zoomActive) {
            restoreFov(client);
        } else if (wantZoom && zoomActive) {
            int target = Math.max(10, Math.round(savedFov * 0.35f));
            if (client.options.fov().get() != target) {
                client.options.fov().set(target);
            }
        }
    }

    private static void restoreFov(Minecraft client) {
        client.options.fov().set(savedFov);
        zoomActive = false;
    }
}
