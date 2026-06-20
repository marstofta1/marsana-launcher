package com.marsana.client.mods;

import com.marsana.client.MarsanaClientMod;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.server.packs.repository.PackRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Oyun acikken jar yeniden adlandirilamaz; bilinen modlar icin anlik etki uygular.
 */
public final class RuntimeModControl {
    private static final Logger LOGGER = LoggerFactory.getLogger(MarsanaClientMod.MOD_ID);
    private static final String FULLBRIGHT_PACK_ID = "file/fullbright-ub.zip";
    private static final String IRIS_API = "net.irisshaders.iris.api.v0.IrisApi";
    private static final Pattern PROP_LINE = Pattern.compile("^([^#=\\s]+)\\s*=\\s*(.*)$");

    private RuntimeModControl() {}

    public static boolean apply(String fileName, boolean enable) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.contains("iris")) {
            return setIrisShadersEnabled(enable);
        }
        if (lower.contains("voice")) {
            return setVoiceChatDisabled(!enable);
        }
        if (lower.contains("fullbright")) {
            return setFullbrightPackEnabled(enable);
        }
        return false;
    }

    public static boolean applyFullbrightFeature(boolean enable) {
        return setFullbrightPackEnabled(enable);
    }

    public static boolean isIrisShadersEnabled() {
        Boolean apiState = readIrisShadersFromApi();
        if (apiState != null) {
            return apiState;
        }
        return readBooleanProperty(
            FabricLoader.getInstance().getConfigDir().resolve("iris.properties"),
            "enableShaders",
            true
        );
    }

    public static boolean isVoiceChatEnabled() {
        return !readBooleanProperty(
            FabricLoader.getInstance().getConfigDir().resolve("voicechat/voicechat-client.properties"),
            "disabled",
            false
        );
    }

    public static boolean isFullbrightPackEnabled() {
        Minecraft client = Minecraft.getInstance();
        if (client == null) {
            return false;
        }
        return client.getResourcePackRepository().getSelectedIds().contains(FULLBRIGHT_PACK_ID);
    }

    public static boolean setIrisShadersEnabled(boolean enable) {
        if (applyIrisShadersViaApi(enable)) {
            return true;
        }
        Path propsPath = FabricLoader.getInstance().getConfigDir().resolve("iris.properties");
        if (!Files.isRegularFile(propsPath)) {
            return false;
        }
        try {
            setPropertyFileValue(propsPath, "enableShaders", Boolean.toString(enable));
            if (!enable) {
                setPropertyFileValue(propsPath, "shaderPack", "");
            }
            return true;
        } catch (IOException e) {
            LOGGER.warn("Iris shader durumu guncellenemedi", e);
            return false;
        }
    }

    public static boolean setVoiceChatDisabled(boolean disabled) {
        Path propsPath = FabricLoader.getInstance().getConfigDir().resolve("voicechat/voicechat-client.properties");
        if (!Files.isRegularFile(propsPath)) {
            return false;
        }
        try {
            setPropertyFileValue(propsPath, "disabled", Boolean.toString(disabled));
            return true;
        } catch (IOException e) {
            LOGGER.warn("Voice chat durumu guncellenemedi", e);
            return false;
        }
    }

    public static boolean setFullbrightPackEnabled(boolean enable) {
        Minecraft client = Minecraft.getInstance();
        if (client == null) {
            return false;
        }
        PackRepository repo = client.getResourcePackRepository();
        boolean changed = enable ? repo.addPack(FULLBRIGHT_PACK_ID) : repo.removePack(FULLBRIGHT_PACK_ID);
        if (!changed && enable == isFullbrightPackEnabled()) {
            return true;
        }
        if (!changed) {
            return false;
        }
        try {
            List<String> selected = new ArrayList<>(repo.getSelectedIds());
            client.options.resourcePacks = selected;
            client.options.updateResourcePacks(repo);
            // reloadResourcePacks() dunyaya girerken Iris/Sodium ile JVM cokertmesine yol acabiliyor.
        } catch (Exception e) {
            LOGGER.warn("Fullbright kaynak paketi guncellenemedi", e);
            return false;
        }
        return true;
    }

    private static boolean applyIrisShadersViaApi(boolean enable) {
        try {
            Class<?> apiClass = Class.forName(IRIS_API);
            Object api = apiClass.getMethod("getInstance").invoke(null);
            Object config = apiClass.getMethod("getConfig").invoke(api);
            config.getClass()
                .getMethod("setShadersEnabledAndApply", boolean.class)
                .invoke(config, enable);
            return true;
        } catch (ReflectiveOperationException e) {
            LOGGER.debug("Iris API ile shader durumu degistirilemedi, properties fallback kullanilacak", e);
            return false;
        }
    }

    private static Boolean readIrisShadersFromApi() {
        try {
            Class<?> apiClass = Class.forName(IRIS_API);
            Object api = apiClass.getMethod("getInstance").invoke(null);
            try {
                Object config = apiClass.getMethod("getConfig").invoke(api);
                for (String method : new String[] { "areShadersEnabled", "isShadersEnabled", "getShadersEnabled" }) {
                    try {
                        Object value = config.getClass().getMethod(method).invoke(config);
                        if (value instanceof Boolean b) {
                            return b;
                        }
                    } catch (NoSuchMethodException ignored) {
                    }
                }
            } catch (ReflectiveOperationException ignored) {
            }
            Object inUse = apiClass.getMethod("isShaderPackInUse").invoke(api);
            if (inUse instanceof Boolean b) {
                return b;
            }
        } catch (ReflectiveOperationException ignored) {
        }
        return null;
    }

    private static boolean readBooleanProperty(Path path, String key, boolean defaultValue) {
        if (!Files.isRegularFile(path)) {
            return defaultValue;
        }
        try {
            for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
                var m = PROP_LINE.matcher(line.trim());
                if (m.matches() && key.equals(m.group(1))) {
                    return Boolean.parseBoolean(m.group(2).trim());
                }
            }
        } catch (IOException e) {
            LOGGER.debug("Properties okunamadi: {}", path, e);
        }
        return defaultValue;
    }

    private static void setPropertyFileValue(Path path, String key, String value) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        boolean touched = false;
        for (int i = 0; i < lines.size(); i++) {
            var m = PROP_LINE.matcher(lines.get(i).trim());
            if (m.matches() && key.equals(m.group(1))) {
                lines.set(i, key + "=" + value);
                touched = true;
                break;
            }
        }
        if (!touched) {
            lines.add(key + "=" + value);
        }
        Files.write(path, lines, StandardCharsets.UTF_8);
    }
}
