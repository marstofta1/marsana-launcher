package com.marsana.client.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import com.marsana.client.MarsanaClientMod;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public final class MarsanaConfigManager {
    private static final Logger LOGGER = LoggerFactory.getLogger(MarsanaClientMod.MOD_ID);
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    public static final int SCHEMA_VERSION = 1;

    private static MarsanaConfig config = MarsanaConfig.defaults();

    private MarsanaConfigManager() {}

    public static Path configPath() {
        return FabricLoader.getInstance().getConfigDir().resolve("marsana-client.json");
    }

    public static MarsanaConfig get() {
        return config;
    }

    public static void load() {
        Path path = configPath();
        if (!Files.isRegularFile(path)) {
            config = MarsanaConfig.defaults();
            save();
            return;
        }
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            MarsanaConfig loaded = GSON.fromJson(reader, MarsanaConfig.class);
            config = loaded != null ? loaded : MarsanaConfig.defaults();
            if (config.modStates == null) {
                config.modStates = new HashMap<>();
            }
        } catch (IOException e) {
            LOGGER.warn("Marsana config okunamadi, varsayilan kullaniliyor", e);
            config = MarsanaConfig.defaults();
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
            LOGGER.error("Marsana config yazilamadi", e);
        }
    }

    public static void setCosmetic(String cosmeticId) {
        config.cosmetic = cosmeticId != null ? cosmeticId : "none";
        save();
    }

    public static void setModEnabled(String fileName, boolean enabled) {
        config.modStates.put(fileName, enabled);
        save();
    }

    public static boolean isModEnabled(String fileName) {
        return config.modStates.getOrDefault(fileName, true);
    }

    public static final class MarsanaConfig {
        @SerializedName("version")
        public int version = SCHEMA_VERSION;

        @SerializedName("cosmetic")
        public String cosmetic = "none";

        @SerializedName("modStates")
        public Map<String, Boolean> modStates = new HashMap<>();

        public static MarsanaConfig defaults() {
            MarsanaConfig c = new MarsanaConfig();
            c.version = SCHEMA_VERSION;
            c.cosmetic = "none";
            c.modStates = new HashMap<>();
            return c;
        }
    }
}
