package com.marsana.schematicfarm;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import com.marsana.schematicfarm.keybind.SchematicKeybinds;
import com.marsana.schematicfarm.render.SchematicHologramRenderer;
import net.fabricmc.api.ClientModInitializer;

public class SchematicFarmMod implements ClientModInitializer {
    public static final String MOD_ID = "marsana-schematic-farm";

    @Override
    public void onInitializeClient() {
        SchematicConfigManager.load();
        SchematicKeybinds.register();
        SchematicHologramRenderer.initPipeline();
    }
}
