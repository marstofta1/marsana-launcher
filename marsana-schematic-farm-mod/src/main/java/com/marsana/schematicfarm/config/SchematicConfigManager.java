package com.marsana.schematicfarm.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import com.marsana.schematicfarm.SchematicFarmMod;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.core.BlockPos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SchematicConfigManager {
    private static final Logger LOGGER = LoggerFactory.getLogger(SchematicFarmMod.MOD_ID);
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    public static final int SCHEMA_VERSION = 2;

    private static SchematicConfig config = SchematicConfig.defaults();

    private SchematicConfigManager() {}

    public static Path configPath() {
        return FabricLoader.getInstance().getConfigDir().resolve("marsana-schematic-farm.json");
    }

    public static void load() {
        Path path = configPath();
        if (!Files.isRegularFile(path)) {
            config = SchematicConfig.defaults();
            save();
            return;
        }
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            SchematicConfig loaded = GSON.fromJson(reader, SchematicConfig.class);
            config = loaded != null ? loaded : SchematicConfig.defaults();
            if (config.version < SCHEMA_VERSION) {
                config.version = SCHEMA_VERSION;
                config.showHolograms = false;
                save();
            }
        } catch (IOException e) {
            LOGGER.warn("Sematik farm config okunamadi, varsayilan kullaniliyor", e);
            config = SchematicConfig.defaults();
        }
    }

    public static void save() {
        Path path = configPath();
        try {
            Files.createDirectories(path.getParent());
            try (Writer writer = Files.newBufferedWriter(path, StandardCharsets.UTF_8)) {
                GSON.toJson(config, writer);
            }
        } catch (IOException e) {
            LOGGER.error("Sematik farm config yazilamadi", e);
        }
    }

    public static String getSchematicFarmId() {
        return config.schematicFarmId != null ? config.schematicFarmId : "mob_farm";
    }

    public static void setSchematicFarmId(String farmId) {
        config.schematicFarmId = farmId != null ? farmId : "mob_farm";
        save();
    }

    public static String getSchematicAnchorDimension() {
        return config.schematicAnchorDimension;
    }

    public static BlockPos getSchematicAnchor() {
        if (config.schematicAnchorX == null || config.schematicAnchorY == null || config.schematicAnchorZ == null) {
            return null;
        }
        return new BlockPos(config.schematicAnchorX, config.schematicAnchorY, config.schematicAnchorZ);
    }

    public static void setSchematicAnchor(String dimension, BlockPos pos) {
        if (pos == null) {
            config.schematicAnchorDimension = null;
            config.schematicAnchorX = null;
            config.schematicAnchorY = null;
            config.schematicAnchorZ = null;
        } else {
            config.schematicAnchorDimension = normalizeDimensionId(dimension);
            config.schematicAnchorX = pos.getX();
            config.schematicAnchorY = pos.getY();
            config.schematicAnchorZ = pos.getZ();
        }
        save();
    }

    public static boolean isHologramsEnabled() {
        return config.showHolograms;
    }

    public static void setHologramsEnabled(boolean enabled) {
        config.showHolograms = enabled;
        save();
        if (enabled) {
            com.marsana.schematicfarm.render.SchematicHologramRenderer.syncWithConfig();
        }
    }

    public static String normalizeDimensionId(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        int bracket = s.indexOf("location=");
        if (bracket >= 0) {
            s = s.substring(bracket + "location=".length());
            int end = s.indexOf(']');
            if (end >= 0) {
                s = s.substring(0, end);
            }
        }
        return s.replace("ResourceKey[minecraft:", "").replace("]", "");
    }

    public static final class SchematicConfig {
        @SerializedName("version")
        public int version = SCHEMA_VERSION;

        @SerializedName("schematicFarmId")
        public String schematicFarmId = "mob_farm";

        @SerializedName("schematicAnchorDimension")
        public String schematicAnchorDimension;

        @SerializedName("schematicAnchorX")
        public Integer schematicAnchorX;

        @SerializedName("schematicAnchorY")
        public Integer schematicAnchorY;

        @SerializedName("schematicAnchorZ")
        public Integer schematicAnchorZ;

        @SerializedName("showHolograms")
        public boolean showHolograms = false;

        public static SchematicConfig defaults() {
            return new SchematicConfig();
        }
    }
}
