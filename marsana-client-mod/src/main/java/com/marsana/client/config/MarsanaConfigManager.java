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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MarsanaConfigManager {
    private static final Logger LOGGER = LoggerFactory.getLogger(MarsanaClientMod.MOD_ID);
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    public static final int SCHEMA_VERSION = 2;

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
            if (config.friends == null) {
                config.friends = new ArrayList<>();
            }
            if (config.incomingRequests == null) {
                config.incomingRequests = new ArrayList<>();
            }
            if (config.outgoingRequests == null) {
                config.outgoingRequests = new ArrayList<>();
            }
            if (config.chatHistory == null) {
                config.chatHistory = new HashMap<>();
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

    public static String localPlayerUuid() {
        return config.localPlayerUuid != null ? config.localPlayerUuid : "00000000-0000-0000-0000-000000000000";
    }

    public static void setLocalPlayerUuid(UUID uuid) {
        if (uuid != null) {
            config.localPlayerUuid = uuid.toString();
            save();
        }
    }

    public static final class FriendRecord {
        @SerializedName("uuid")
        public String uuid = "";

        @SerializedName("name")
        public String name = "";
    }

    public static final class ChatMessageRecord {
        @SerializedName("fromUuid")
        public String fromUuid = "";

        @SerializedName("fromName")
        public String fromName = "";

        @SerializedName("text")
        public String text = "";

        @SerializedName("timestamp")
        public long timestamp;

        @SerializedName("outgoing")
        public boolean outgoing;
    }

    public static final class MarsanaConfig {
        @SerializedName("version")
        public int version = SCHEMA_VERSION;

        @SerializedName("cosmetic")
        public String cosmetic = "none";

        @SerializedName("modStates")
        public Map<String, Boolean> modStates = new HashMap<>();

        @SerializedName("localPlayerUuid")
        public String localPlayerUuid;

        @SerializedName("friends")
        public List<FriendRecord> friends = new ArrayList<>();

        @SerializedName("incomingRequests")
        public List<FriendRecord> incomingRequests = new ArrayList<>();

        @SerializedName("outgoingRequests")
        public List<FriendRecord> outgoingRequests = new ArrayList<>();

        @SerializedName("chatHistory")
        public Map<String, List<ChatMessageRecord>> chatHistory = new HashMap<>();

        public static MarsanaConfig defaults() {
            MarsanaConfig c = new MarsanaConfig();
            c.version = SCHEMA_VERSION;
            c.cosmetic = "none";
            c.modStates = new HashMap<>();
            c.friends = new ArrayList<>();
            c.incomingRequests = new ArrayList<>();
            c.outgoingRequests = new ArrayList<>();
            c.chatHistory = new HashMap<>();
            return c;
        }
    }
}
