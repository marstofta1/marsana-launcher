package com.marsana.client.hud;

import com.marsana.client.MarsanaClientMod;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import org.lwjgl.glfw.GLFW;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public final class HudOverlayRenderer {
    /** Minecraft 26.x metin rengi ARGB (alfa zorunlu; 0xFFFFFF yaziyi gorunmez yapar). */
    private static final int TEXT_WHITE = 0xFFFFFFFF;
    private static final int TEXT_DIM = 0xFFAAAAAA;
    private static final int TEXT_DARK = 0xFF111111;
    private static final int ACCENT = 0xFF55FF88;
    private static final int KEY_BG = 0xFF2A2A2A;
    private static final int KEY_BG_PRESSED = 0xFF55FF88;

    private static final DateTimeFormatter CLOCK_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static int frameCounter;
    private static int lastFps;
    private static long lastFpsTime;

    private HudOverlayRenderer() {}

    public static void register() {
        Identifier hudId = Identifier.fromNamespaceAndPath(MarsanaClientMod.MOD_ID, "overlay");
        HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, hudId, HudOverlayRenderer::render);
        CpsTracker.register();
    }

    private static void render(GuiGraphicsExtractor graphics, net.minecraft.client.DeltaTracker tickCounter) {
        Minecraft client = Minecraft.getInstance();
        LocalPlayer player = client.player;
        if (player == null || client.options.hideGui) {
            return;
        }

        updateFps();

        int sw = client.getWindow().getGuiScaledWidth();
        int sh = client.getWindow().getGuiScaledHeight();
        int stackRow = HudFeatureRegistry.isEnabled(HudFeatureIds.FPS) ? 1 : 0;

        if (HudFeatureRegistry.isEnabled(HudFeatureIds.FPS)) {
            drawTopLeftStack(graphics, client, sw, 0, "FPS: " + lastFps);
        }
        if (HudFeatureRegistry.isEnabled(HudFeatureIds.PING)) {
            int ping = 0;
            if (client.getConnection() != null) {
                var info = client.getConnection().getPlayerInfo(player.getUUID());
                if (info != null) {
                    ping = info.getLatency();
                }
            }
            drawTopLeftStack(graphics, client, sw, stackRow++, "Ping: " + ping + "ms");
        }
        if (HudFeatureRegistry.isEnabled(HudFeatureIds.COORDS)) {
            BlockPos pos = player.blockPosition();
            drawTopLeftStack(graphics, client, sw, stackRow++,
                String.format("XYZ: %d / %d / %d", pos.getX(), pos.getY(), pos.getZ()));
        }
        if (HudFeatureRegistry.isEnabled(HudFeatureIds.CLOCK)) {
            drawTopLeftStack(graphics, client, sw, stackRow++, LocalTime.now().format(CLOCK_FMT));
        }
        if (HudFeatureRegistry.isEnabled(HudFeatureIds.COMPASS)) {
            drawTopLeftStack(graphics, client, sw, stackRow++, directionLabel(player.getYRot()));
        }

        if (HudFeatureRegistry.isEnabled(HudFeatureIds.CPS)) {
            String cps = "CPS: " + CpsTracker.leftCps() + " | " + CpsTracker.rightCps();
            graphics.text(client.font, cps, sw - client.font.width(cps) - 4, 4, TEXT_WHITE);
        }

        if (HudFeatureRegistry.isEnabled(HudFeatureIds.ARMOR)) {
            renderArmor(graphics, client, sw);
        }

        if (HudFeatureRegistry.isEnabled(HudFeatureIds.KEYSTROKES)) {
            renderKeystrokes(graphics, client, sh);
        }

        if (HudFeatureRegistry.isEnabled(HudFeatureIds.CROSSHAIR)) {
            int cx = sw / 2 + 8;
            int cy = sh / 2 + 8;
            graphics.text(client.font, "+", cx, cy, ACCENT);
        }

        if (HudFeatureRegistry.isEnabled(HudFeatureIds.REACH)) {
            String reach = String.format("Reach: %.1f", 3.0);
            graphics.text(client.font, reach, sw / 2 - client.font.width(reach) / 2, sh - 52, TEXT_DIM);
        }
    }

    private static void drawTopLeftStack(GuiGraphicsExtractor graphics, Minecraft client, int sw, int row, String text) {
        graphics.text(client.font, text, 4, 4 + row * 10, TEXT_WHITE);
    }

    private static void updateFps() {
        frameCounter++;
        long now = System.currentTimeMillis();
        if (now - lastFpsTime >= 1000L) {
            lastFps = frameCounter;
            frameCounter = 0;
            lastFpsTime = now;
        }
    }

    private static String directionLabel(float yaw) {
        yaw = (yaw % 360 + 360) % 360;
        if (yaw >= 315 || yaw < 45) return "Yon: Guney (+Z)";
        if (yaw < 135) return "Yon: Bati (-X)";
        if (yaw < 225) return "Yon: Kuzey (-Z)";
        return "Yon: Dogu (+X)";
    }

    private static void renderArmor(GuiGraphicsExtractor graphics, Minecraft client, int sw) {
        LocalPlayer player = client.player;
        if (player == null) return;
        int y = 4;
        EquipmentSlot[] slots = {
            EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET
        };
        String[] labels = { "Bas", "Gogus", "Bacak", "Ayak" };
        int idx = 0;
        for (EquipmentSlot slot : slots) {
            ItemStack stack = player.getItemBySlot(slot);
            if (stack.isEmpty()) {
                idx++;
                continue;
            }
            String line = labels[idx] + ": " + stack.getHoverName().getString();
            if (stack.isDamageableItem()) {
                int max = stack.getMaxDamage();
                int left = max - stack.getDamageValue();
                line += " (" + left + "/" + max + ")";
            }
            int w = client.font.width(line);
            graphics.text(client.font, line, sw - w - 4, y, TEXT_WHITE);
            y += 10;
            idx++;
        }
    }

    private static void renderKeystrokes(GuiGraphicsExtractor graphics, Minecraft client, int sh) {
        long window = client.getWindow().handle();
        int baseX = 4;
        int baseY = sh - 74;

        drawKey(graphics, client, baseX + 22, baseY, "W", keyDown(window, client.options.keyUp));
        drawKey(graphics, client, baseX, baseY + 22, "A", keyDown(window, client.options.keyLeft));
        drawKey(graphics, client, baseX + 22, baseY + 22, "S", keyDown(window, client.options.keyDown));
        drawKey(graphics, client, baseX + 44, baseY + 22, "D", keyDown(window, client.options.keyRight));
        drawKey(graphics, client, baseX + 22, baseY + 44, "SPACE", keyDown(window, client.options.keyJump));

        boolean lmb = GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
        boolean rmb = GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
        drawKey(graphics, client, baseX + 72, baseY + 22, "LMB", lmb);
        drawKey(graphics, client, baseX + 72, baseY + 44, "RMB", rmb);
    }

    private static boolean keyDown(long window, net.minecraft.client.KeyMapping mapping) {
        return mapping.isDown();
    }

    private static void drawKey(GuiGraphicsExtractor graphics, Minecraft client, int x, int y, String label, boolean pressed) {
        int w = Math.max(20, client.font.width(label) + 8);
        int h = 18;
        int bg = pressed ? KEY_BG_PRESSED : KEY_BG;
        graphics.fill(x, y, x + w, y + h, bg);
        graphics.text(client.font, label, x + (w - client.font.width(label)) / 2, y + 5, pressed ? TEXT_DARK : TEXT_WHITE);
    }
}
