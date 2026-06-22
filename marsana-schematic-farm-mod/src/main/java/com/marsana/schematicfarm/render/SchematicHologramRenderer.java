package com.marsana.schematicfarm.render;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 26.2'de vanilla cizim API'si yenilendi (MultiBufferSource / ShapeRenderer kaldirildi).
 * Hologram yeniden yazilana kadar guvenli no-op; F8 menusu ve tarama calisir.
 */
public final class SchematicHologramRenderer {
    private static final Logger LOGGER = LoggerFactory.getLogger("marsana-schematic-farm");
    private static boolean pipelineRegistered;

    private SchematicHologramRenderer() {}

    public static void initPipeline() {
        if (pipelineRegistered) {
            return;
        }
        pipelineRegistered = true;
        LOGGER.info("Sematik hologram 26.2 cizim API'sine uyarlaniyor — su an devre disi.");
    }

    public static void syncWithConfig() {
        if (!SchematicConfigManager.isHologramsEnabled()) {
            return;
        }
        initPipeline();
    }
}
