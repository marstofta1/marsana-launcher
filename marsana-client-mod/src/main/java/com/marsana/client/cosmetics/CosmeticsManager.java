package com.marsana.client.cosmetics;

import com.marsana.client.MarsanaClientMod;
import com.marsana.client.config.MarsanaConfigManager;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;

import java.util.HashMap;
import java.util.Map;

public final class CosmeticsManager {
    public record CosmeticOption(String id, String label, int colorArgb) {}

    public static final CosmeticOption NONE = new CosmeticOption("none", "Kapali", 0);
    public static final CosmeticOption GREEN = new CosmeticOption("marsana-green", "Marsana Yesil", 0xFF3D9A5F);
    public static final CosmeticOption NIGHT = new CosmeticOption("marsana-night", "Marsana Gece", 0xFF1A2744);
    public static final CosmeticOption GOLD = new CosmeticOption("marsana-gold", "Marsana Altin", 0xFFC9A227);

    public static final CosmeticOption[] OPTIONS = { NONE, GREEN, NIGHT, GOLD };

    private static final Map<String, ClientAsset.ResourceTexture> CAPE_TEXTURES = new HashMap<>();

    private CosmeticsManager() {}

    public static void initTextures() {
        // lazy — Minecraft henuz hazir olmayabilir
    }

    public static void ensureTexturesReady() {
        if (!CAPE_TEXTURES.isEmpty()) {
            return;
        }
        registerCape(GREEN);
        registerCape(NIGHT);
        registerCape(GOLD);
    }

    public static String getSelectedCosmetic() {
        String id = MarsanaConfigManager.get().cosmetic;
        return id != null ? id : "none";
    }

    public static void selectCosmetic(String id) {
        MarsanaConfigManager.setCosmetic(id);
    }

    public static ClientAsset.ResourceTexture getCapeTextureForCurrentPlayer() {
        String id = getSelectedCosmetic();
        if ("none".equals(id)) {
            return null;
        }
        return CAPE_TEXTURES.get(id);
    }

    private static void registerCape(CosmeticOption option) {
        NativeImage image = new NativeImage(64, 32, true);
        int rgb = option.colorArgb() & 0xFFFFFF;
        for (int y = 0; y < 32; y++) {
            for (int x = 0; x < 64; x++) {
                boolean border = x == 0 || y == 0 || x == 63 || y == 31;
                int shade = border ? darken(rgb, 0.75f) : rgb;
                image.setPixelABGR(x, y, 0xFF000000 | shade);
            }
        }
        Identifier texId = Identifier.fromNamespaceAndPath(MarsanaClientMod.MOD_ID, "cosmetic/" + option.id());
        DynamicTexture texture = new DynamicTexture(() -> "marsana-cosmetic-" + option.id(), image);
        Minecraft.getInstance().getTextureManager().register(texId, texture);
        CAPE_TEXTURES.put(option.id(), new ClientAsset.ResourceTexture(texId));
    }

    private static int darken(int rgb, float factor) {
        int r = (int) (((rgb >> 16) & 0xFF) * factor);
        int g = (int) (((rgb >> 8) & 0xFF) * factor);
        int b = (int) ((rgb & 0xFF) * factor);
        return (r << 16) | (g << 8) | b;
    }
}
