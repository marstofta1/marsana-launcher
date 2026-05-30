package com.marsana.client.mods;

import com.marsana.client.config.MarsanaConfigManager;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class ModToggleManager {
    private static final Set<String> PROTECTED_PREFIXES = Set.of(
        "marsana-client",
        "fabric-api"
    );

    private ModToggleManager() {}

    public record ModEntry(String fileName, String displayName, boolean enabled, boolean protectedMod) {}

    public static List<ModEntry> listMods() {
        Path modsDir = FabricLoader.getInstance().getGameDir().resolve("mods");
        List<ModEntry> out = new ArrayList<>();
        if (!Files.isDirectory(modsDir)) {
            return out;
        }

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir)) {
            for (Path p : stream) {
                String name = p.getFileName().toString();
                if (!name.endsWith(".jar") && !name.endsWith(".jar.disabled")) {
                    continue;
                }
                boolean disabled = name.endsWith(".jar.disabled");
                String baseName = disabled ? name.substring(0, name.length() - ".disabled".length()) : name;
                boolean enabled = !disabled && MarsanaConfigManager.isModEnabled(baseName);
                boolean protectedMod = isProtected(baseName);
                out.add(new ModEntry(baseName, friendlyName(baseName), enabled, protectedMod));
            }
        } catch (IOException ignored) {
        }

        out.sort(Comparator.comparing(ModEntry::displayName));
        return out;
    }

    public static boolean toggleMod(String fileName, boolean enable) {
        if (isProtected(fileName)) {
            return false;
        }
        Path modsDir = FabricLoader.getInstance().getGameDir().resolve("mods");
        Path enabledPath = modsDir.resolve(fileName);
        Path disabledPath = modsDir.resolve(fileName + ".disabled");

        try {
            if (enable) {
                if (Files.exists(disabledPath)) {
                    Files.move(disabledPath, enabledPath, StandardCopyOption.REPLACE_EXISTING);
                }
            } else {
                if (Files.exists(enabledPath)) {
                    Files.move(enabledPath, disabledPath, StandardCopyOption.REPLACE_EXISTING);
                }
            }
            MarsanaConfigManager.setModEnabled(fileName, enable);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    public static boolean isProtected(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        for (String prefix : PROTECTED_PREFIXES) {
            if (lower.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private static String friendlyName(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.contains("iris")) return "Iris (Shader)";
        if (lower.contains("sodium")) return "Sodium (FPS)";
        if (lower.contains("voice")) return "Simple Voice Chat";
        if (lower.contains("continuity")) return "Continuity";
        if (lower.contains("cull-leaves") || lower.contains("cull_leaves")) return "Cull Leaves";
        if (lower.contains("polytone")) return "Polytone";
        if (lower.startsWith("fabric-api")) return "Fabric API";
        if (lower.contains("marsana-client")) return "Marsana Client";
        int dot = fileName.indexOf('-');
        if (dot > 0) {
            return fileName.substring(0, dot);
        }
        return fileName.replace(".jar", "");
    }
}
