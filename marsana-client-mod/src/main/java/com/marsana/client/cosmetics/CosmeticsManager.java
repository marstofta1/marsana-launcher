package com.marsana.client.cosmetics;

import com.marsana.client.MarsanaClientMod;
import com.marsana.client.config.MarsanaConfigManager;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public final class CosmeticsManager {
    /** colorArgb: doku PNG'si okunamazsa kullanilan duz yedek renk. */
    public record CosmeticOption(String id, String label, int colorArgb) {}

    public static final CosmeticOption NONE = new CosmeticOption("none", "Kapali", 0);

    // Dokular jar icinde: assets/marsana-client/textures/cosmetic/<id>.png
    // (scripts/generate-capes.js uretir; launcher'daki COSMETIC_ITEMS ile ayni id'ler).
    public static final CosmeticOption[] OPTIONS = {
        NONE,
        new CosmeticOption("marsana-green", "Marsana Yesil", 0xFF3D9A5F),
        new CosmeticOption("marsana-night", "Marsana Gece", 0xFF1A2744),
        new CosmeticOption("marsana-gold", "Marsana Altin", 0xFFC9A227),
        new CosmeticOption("flame", "Alev", 0xFFD6301C),
        new CosmeticOption("ocean", "Okyanus", 0xFF2A7FB8),
        new CosmeticOption("galaxy", "Galaksi", 0xFF3A1F6E),
        new CosmeticOption("forest", "Orman", 0xFF2D5A2F),
        new CosmeticOption("rainbow", "Gokkusagi", 0xFFF7CF3B),
        new CosmeticOption("frost", "Buz", 0xFF9FD3F0),
        new CosmeticOption("dragon", "Ejderha", 0xFF2A7A44),
        new CosmeticOption("sakura", "Sakura", 0xFFF2A6C4),
        new CosmeticOption("storm", "Simsek", 0xFF2A2E36),
    };

    private static final Logger LOGGER = LoggerFactory.getLogger("marsana-client/cosmetics");
    private static final Map<String, ClientAsset.ResourceTexture> CAPE_TEXTURES = new HashMap<>();

    private CosmeticsManager() {}

    public static void initTextures() {
        // lazy — Minecraft henuz hazir olmayabilir
    }

    public static void ensureTexturesReady() {
        if (!CAPE_TEXTURES.isEmpty()) {
            return;
        }
        for (CosmeticOption option : OPTIONS) {
            if (option != NONE) {
                registerCape(option);
            }
        }
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
        NativeImage image = loadCapeImage(option);
        Identifier texId = Identifier.fromNamespaceAndPath(MarsanaClientMod.MOD_ID, "cosmetic/" + option.id());
        DynamicTexture texture = new DynamicTexture(() -> "marsana-cosmetic-" + option.id(), image);
        Minecraft.getInstance().getTextureManager().register(texId, texture);
        // 2-argumanli yapici: texturePath() == texId olur. Tek-argumanli yapici
        // yolu "textures/<path>.png"e cevirir; renderer texturePath() ile baglar,
        // o yola kayit olmadigi icin PNG aranir -> mor-siyah missing-texture.
        CAPE_TEXTURES.put(option.id(), new ClientAsset.ResourceTexture(texId, texId));
    }

    /** Jar'daki desenli PNG'yi okur; bulunamazsa duz renkli yedek pelerin cizer. */
    private static NativeImage loadCapeImage(CosmeticOption option) {
        String resource = "/assets/" + MarsanaClientMod.MOD_ID + "/textures/cosmetic/" + option.id() + ".png";
        try (InputStream in = CosmeticsManager.class.getResourceAsStream(resource)) {
            if (in != null) {
                return NativeImage.read(in);
            }
            LOGGER.warn("Pelerin dokusu bulunamadi: {}", resource);
        } catch (Exception e) {
            LOGGER.warn("Pelerin dokusu okunamadi: {}", resource, e);
        }
        return solidCape(option.colorArgb() & 0xFFFFFF);
    }

    private static NativeImage solidCape(int rgb) {
        NativeImage image = new NativeImage(64, 32, true);
        for (int y = 0; y < 32; y++) {
            for (int x = 0; x < 64; x++) {
                boolean border = x == 0 || y == 0 || x == 63 || y == 31;
                int shade = border ? darken(rgb, 0.75f) : rgb;
                // setPixel ARGB (0xAARRGGBB) alir ve iceride ARGB.toABGR uygular.
                // Dogrudan setPixelABGR'a ARGB vermek R<->B kanallarini takas eder.
                image.setPixel(x, y, 0xFF000000 | shade);
            }
        }
        return image;
    }

    private static int darken(int rgb, float factor) {
        int r = (int) (((rgb >> 16) & 0xFF) * factor);
        int g = (int) (((rgb >> 8) & 0xFF) * factor);
        int b = (int) ((rgb & 0xFF) * factor);
        return (r << 16) | (g << 8) | b;
    }
}
