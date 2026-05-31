package com.marsana.client.mods;

import com.marsana.client.config.MarsanaConfigManager;
import com.marsana.client.hud.HudFeatureRegistry;
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
        "fabric-api",
        "cloth-config"
    );

    public static final String FULLBRIGHT_FEATURE_ID = "feature:fullbright-ub";

    private ModToggleManager() {}

    public record ModEntry(String fileName, String displayName, boolean enabled, boolean protectedMod) {}

    public enum ToggleOutcome {
        /** Hem tercih kaydedildi hem anlik etki (veya dosya guncellendi). */
        APPLIED,
        /** Tercih kaydedildi; Sodium gibi modlar sonraki baslatmada jar ile kapanir. */
        SAVED_RESTART,
        /** Korunan mod veya hata. */
        BLOCKED
    }

    public record ToggleResult(ToggleOutcome outcome, boolean runtimeApplied, boolean fileApplied) {}

    public static List<ModEntry> listMods() {
        Path modsDir = FabricLoader.getInstance().getGameDir().resolve("mods");
        List<ModEntry> out = new ArrayList<>();
        if (Files.isDirectory(modsDir)) {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir)) {
                for (Path p : stream) {
                    String name = p.getFileName().toString();
                    if (!name.endsWith(".jar") && !name.endsWith(".jar.disabled")) {
                        continue;
                    }
                    boolean fileDisabled = name.endsWith(".jar.disabled");
                    String baseName = fileDisabled ? name.substring(0, name.length() - ".disabled".length()) : name;
                    boolean enabled = resolveEnabledState(baseName, fileDisabled);
                    boolean protectedMod = isProtected(baseName);
                    out.add(new ModEntry(baseName, friendlyName(baseName), enabled, protectedMod));
                }
            } catch (IOException ignored) {
            }
        }

        if (hasFullbrightPack()) {
            boolean enabled = RuntimeModControl.isFullbrightPackEnabled();
            out.add(new ModEntry(FULLBRIGHT_FEATURE_ID, "Fullbright UB", enabled, false));
        }

        for (HudFeatureRegistry.HudFeature feature : HudFeatureRegistry.all()) {
            boolean enabled = HudFeatureRegistry.isEnabled(feature.id());
            out.add(new ModEntry(feature.id(), feature.displayName(), enabled, false));
        }

        out.sort(Comparator.comparing(ModEntry::displayName));
        return out;
    }

    public static ToggleResult toggleMod(String fileName, boolean enable) {
        if (isProtected(fileName)) {
            return new ToggleResult(ToggleOutcome.BLOCKED, false, false);
        }

        if (FULLBRIGHT_FEATURE_ID.equals(fileName)) {
            MarsanaConfigManager.setModEnabled(fileName, enable);
            boolean runtime = RuntimeModControl.applyFullbrightFeature(enable);
            if (runtime) {
                MarsanaConfigManager.setModEnabled(fileName, RuntimeModControl.isFullbrightPackEnabled());
            }
            return new ToggleResult(
                runtime ? ToggleOutcome.APPLIED : ToggleOutcome.SAVED_RESTART,
                runtime,
                false
            );
        }

        if (HudFeatureRegistry.isHudFeature(fileName)) {
            MarsanaConfigManager.setModEnabled(fileName, enable);
            return new ToggleResult(ToggleOutcome.APPLIED, true, false);
        }

        MarsanaConfigManager.setModEnabled(fileName, enable);
        boolean runtime = RuntimeModControl.apply(fileName, enable);
        if (runtime) {
            MarsanaConfigManager.setModEnabled(fileName, readRuntimeEnabled(fileName, enable));
        }
        boolean fileApplied = syncJarFileState(fileName, enable);

        if (runtime || fileApplied) {
            return new ToggleResult(ToggleOutcome.APPLIED, runtime, fileApplied);
        }
        return new ToggleResult(ToggleOutcome.SAVED_RESTART, false, false);
    }

    public static void applyPendingFileToggles() {
        Path modsDir = FabricLoader.getInstance().getGameDir().resolve("mods");
        if (!Files.isDirectory(modsDir)) {
            return;
        }
        for (var entry : MarsanaConfigManager.get().modStates.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith("feature:") || isProtected(key)) {
                continue;
            }
            Boolean enabled = entry.getValue();
            if (enabled == null) {
                continue;
            }
            syncJarFileState(key, enabled);
        }
    }

    /** Oturum basinda kayitli tercihleri oyuna uygula. */
    public static void applyRuntimeFromConfig() {
        for (var entry : MarsanaConfigManager.get().modStates.entrySet()) {
            String key = entry.getKey();
            Boolean enabled = entry.getValue();
            if (enabled == null || isProtected(key)) {
                continue;
            }
            if (FULLBRIGHT_FEATURE_ID.equals(key)) {
                RuntimeModControl.applyFullbrightFeature(enabled);
            } else if (HudFeatureRegistry.isHudFeature(key)) {
                /* HUD ozellikleri anlik okunur */
            } else if (!key.startsWith("feature:")) {
                RuntimeModControl.apply(key, enabled);
            }
        }
        syncConfigFromRuntime();
    }

    /** Menude gosterilen gercek durumu config dosyasina yansit (launcher senkronu). */
    public static void syncConfigFromRuntime() {
        for (ModEntry entry : listMods()) {
            if (entry.protectedMod()) {
                continue;
            }
            MarsanaConfigManager.setModEnabled(entry.fileName(), entry.enabled());
        }
    }

    private static boolean resolveEnabledState(String baseName, boolean fileDisabled) {
        if (fileDisabled) {
            return false;
        }
        String lower = baseName.toLowerCase(Locale.ROOT);
        if (lower.contains("iris")) {
            return RuntimeModControl.isIrisShadersEnabled();
        }
        if (lower.contains("voice")) {
            return RuntimeModControl.isVoiceChatEnabled();
        }
        return MarsanaConfigManager.isModEnabled(baseName);
    }

    private static boolean readRuntimeEnabled(String fileName, boolean fallback) {
        if (FULLBRIGHT_FEATURE_ID.equals(fileName)) {
            return RuntimeModControl.isFullbrightPackEnabled();
        }
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.contains("iris")) {
            return RuntimeModControl.isIrisShadersEnabled();
        }
        if (lower.contains("voice")) {
            return RuntimeModControl.isVoiceChatEnabled();
        }
        return fallback;
    }

    private static boolean syncJarFileState(String fileName, boolean enable) {
        Path modsDir = FabricLoader.getInstance().getGameDir().resolve("mods");
        Path enabledPath = modsDir.resolve(fileName);
        Path disabledPath = modsDir.resolve(fileName + ".disabled");

        try {
            if (enable) {
                if (Files.exists(disabledPath)) {
                    Files.move(disabledPath, enabledPath, StandardCopyOption.REPLACE_EXISTING);
                    return true;
                }
                return Files.exists(enabledPath);
            }
            if (Files.exists(enabledPath)) {
                Files.move(enabledPath, disabledPath, StandardCopyOption.REPLACE_EXISTING);
                return true;
            }
            return Files.exists(disabledPath);
        } catch (IOException e) {
            return false;
        }
    }

    public static boolean isProtected(String fileName) {
        if (FULLBRIGHT_FEATURE_ID.equals(fileName)) {
            return false;
        }
        String lower = fileName.toLowerCase(Locale.ROOT);
        for (String prefix : PROTECTED_PREFIXES) {
            if (lower.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasFullbrightPack() {
        Path packs = FabricLoader.getInstance().getGameDir().resolve("resourcepacks/fullbright-ub.zip");
        return Files.isRegularFile(packs);
    }

    private static String friendlyName(String fileName) {
        if (FULLBRIGHT_FEATURE_ID.equals(fileName)) {
            return "Fullbright UB";
        }
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.contains("iris")) return "Iris (Shader)";
        if (lower.contains("sodium")) return "Sodium (FPS)";
        if (lower.contains("voice")) return "Simple Voice Chat";
        if (lower.contains("continuity")) return "Continuity";
        if (lower.contains("cull-leaves") || lower.contains("cull_leaves")) return "Cull Leaves";
        if (lower.contains("polytone")) return "Polytone";
        if (lower.startsWith("fabric-api")) return "Fabric API";
        if (lower.contains("marsana-client")) return "Marsana Client";
        if (lower.contains("xaero") && lower.contains("minimap")) return "Xaero Minimap";
        if (lower.contains("xaero") && lower.contains("world")) return "Xaero World Map";
        if (lower.contains("appleskin")) return "AppleSkin";
        if (lower.contains("modmenu")) return "Mod Menu";
        if (lower.contains("betterf3")) return "BetterF3";
        if (lower.contains("dynamic-fps") || lower.contains("dynamicfps")) return "Dynamic FPS";
        if (lower.contains("entityculling")) return "Entity Culling";
        if (lower.contains("lambdynamiclights")) return "LambDynamicLights";
        if (lower.contains("shulkerboxtooltip")) return "Shulker Box Tooltip";
        if (lower.contains("mousewheelie")) return "Mouse Wheelie";
        if (lower.contains("skin-layers") || lower.contains("skinlayers")) return "Skin Layers 3D";
        if (lower.contains("not-enough-animations")) return "Not Enough Animations";
        if (lower.contains("falling-leaves")) return "Falling Leaves";
        if (lower.contains("visuality")) return "Visuality";
        if (lower.contains("presence-footsteps")) return "Presence Footsteps";
        if (lower.contains("sound-physics")) return "Sound Physics";
        if (lower.contains("enhanced-block-entities")) return "Enhanced Block Entities";
        if (lower.contains("chat-heads")) return "Chat Heads";
        if (lower.contains("wavey-capes") || lower.contains("waveycapes")) return "Wavey Capes";
        if (lower.contains("lighty")) return "Lighty";
        if (lower.contains("moreculling")) return "More Culling";
        if (lower.contains("sodium-extra")) return "Sodium Extra";
        if (lower.contains("reese")) return "Reese Sodium Options";
        if (lower.contains("dynamiccrosshair")) return "Dynamic Crosshair";
        if (lower.contains("ferritecore")) return "FerriteCore";
        if (lower.contains("modernfix")) return "ModernFix";
        if (lower.contains("fastquit")) return "FastQuit";
        if (lower.contains("lazydfu")) return "LazyDFU";
        if (lower.contains("krypton")) return "Krypton";
        if (lower.contains("no-chat-reports")) return "No Chat Reports";
        if (lower.contains("minihud")) return "MiniHUD";
        if (lower.contains("journeymap")) return "JourneyMap";
        int dot = fileName.indexOf('-');
        if (dot > 0) {
            return fileName.substring(0, dot);
        }
        return fileName.replace(".jar", "");
    }
}
