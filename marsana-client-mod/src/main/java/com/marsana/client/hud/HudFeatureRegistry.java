package com.marsana.client.hud;

import com.marsana.client.config.MarsanaConfigManager;

import java.util.ArrayList;
import java.util.List;

public final class HudFeatureRegistry {
    public record HudFeature(String id, String displayName, boolean defaultEnabled) {}

    private static final List<HudFeature> FEATURES = List.of(
        new HudFeature(HudFeatureIds.CPS, "CPS Sayaci", true),
        new HudFeature(HudFeatureIds.KEYSTROKES, "Keystrokes", true),
        new HudFeature(HudFeatureIds.ZOOM, "Zoom (C)", true),
        new HudFeature(HudFeatureIds.FPS, "FPS", true),
        new HudFeature(HudFeatureIds.COORDS, "Koordinatlar", true),
        new HudFeature(HudFeatureIds.ARMOR, "Zirh Durumu", true),
        new HudFeature(HudFeatureIds.PING, "Ping", true),
        new HudFeature(HudFeatureIds.CLOCK, "Saat", false),
        new HudFeature(HudFeatureIds.COMPASS, "Pusula", false),
        new HudFeature(HudFeatureIds.TOGGLE_SPRINT, "Toggle Sprint", true),
        new HudFeature(HudFeatureIds.CROSSHAIR, "Crosshair Bilgisi", false),
        new HudFeature(HudFeatureIds.REACH, "Reach Gostergesi", false)
    );

    private HudFeatureRegistry() {}

    public static List<HudFeature> all() {
        return FEATURES;
    }

    public static void ensureDefaults() {
        for (HudFeature feature : FEATURES) {
            if (!MarsanaConfigManager.get().modStates.containsKey(feature.id())) {
                MarsanaConfigManager.setModEnabled(feature.id(), feature.defaultEnabled());
            }
        }
    }

    public static boolean isEnabled(String id) {
        for (HudFeature feature : FEATURES) {
            if (feature.id().equals(id)) {
                return MarsanaConfigManager.isModEnabled(id);
            }
        }
        return false;
    }

    public static String displayName(String id) {
        for (HudFeature feature : FEATURES) {
            if (feature.id().equals(id)) {
                return feature.displayName();
            }
        }
        return id;
    }

    public static boolean isHudFeature(String id) {
        return id != null && id.startsWith(HudFeatureIds.PREFIX);
    }

    public static List<HudFeature> enabledFeatures() {
        List<HudFeature> out = new ArrayList<>();
        for (HudFeature feature : FEATURES) {
            if (isEnabled(feature.id())) {
                out.add(feature);
            }
        }
        return out;
    }
}
