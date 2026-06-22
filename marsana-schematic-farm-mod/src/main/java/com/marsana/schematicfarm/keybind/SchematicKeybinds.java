package com.marsana.schematicfarm.keybind;

import com.marsana.schematicfarm.SchematicFarmMod;
import com.marsana.schematicfarm.menu.SchematicFarmScreen;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;
import org.lwjgl.glfw.GLFW;

public final class SchematicKeybinds {
    private static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(
        Identifier.fromNamespaceAndPath(SchematicFarmMod.MOD_ID, "category")
    );
    private static KeyMapping openSchematicKey;

    private SchematicKeybinds() {}

    public static void register() {
        openSchematicKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
            "key.marsana-schematic-farm.menu",
            InputConstants.Type.KEYSYM,
            GLFW.GLFW_KEY_F8,
            CATEGORY
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (openSchematicKey.consumeClick()) {
                openSchematicMenu(client);
            }
        });
    }

    private static void openSchematicMenu(Minecraft client) {
        if (client.player == null) {
            return;
        }
        client.execute(() -> {
            if (client.player == null) {
                return;
            }
            if (client.gui.screen() instanceof SchematicFarmScreen) {
                client.gui.setScreen(null);
                return;
            }
            if (client.gui.screen() != null) {
                return;
            }
            client.gui.setScreen(new SchematicFarmScreen());
        });
    }
}
