package com.marsana.client.menu;

import com.marsana.client.cosmetics.CosmeticsManager;
import com.marsana.client.mods.ModToggleManager;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.List;

public class MarsanaMenuScreen extends Screen {
    private enum Tab { MODS, COSMETICS }

    private Tab activeTab = Tab.MODS;
    private final List<Button> dynamicButtons = new ArrayList<>();
    private Button modsTabButton;
    private Button cosmeticsTabButton;

    public MarsanaMenuScreen() {
        super(Component.literal("Marsana Client"));
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int top = 28;

        modsTabButton = Button.builder(Component.literal("Modlar"), b -> switchTab(Tab.MODS))
            .bounds(centerX - 155, top, 150, 20).build();
        cosmeticsTabButton = Button.builder(Component.literal("Kozmetik"), b -> switchTab(Tab.COSMETICS))
            .bounds(centerX + 5, top, 150, 20).build();

        addRenderableWidget(modsTabButton);
        addRenderableWidget(cosmeticsTabButton);
        addRenderableWidget(Button.builder(Component.literal("Kapat"), b -> onClose())
            .bounds(centerX - 50, this.height - 32, 100, 20).build());

        rebuildTabContent();
    }

    private void switchTab(Tab tab) {
        activeTab = tab;
        rebuildTabContent();
    }

    private void clearDynamicButtons() {
        for (Button btn : dynamicButtons) {
            removeWidget(btn);
        }
        dynamicButtons.clear();
    }

    private void rebuildTabContent() {
        clearDynamicButtons();
        if (activeTab == Tab.MODS) {
            buildModsTab();
        } else {
            buildCosmeticsTab();
        }
    }

    private void buildModsTab() {
        List<ModToggleManager.ModEntry> mods = ModToggleManager.listMods();
        int y = 64;
        int max = Math.min(mods.size(), 8);
        for (int i = 0; i < max; i++) {
            ModToggleManager.ModEntry entry = mods.get(i);
            String label = entry.displayName() + (entry.enabled() ? " [Acik]" : " [Kapali]");
            Button btn = Button.builder(Component.literal(label), b -> {
                if (!entry.protectedMod()) {
                    ModToggleManager.toggleMod(entry.fileName(), !entry.enabled());
                    if (this.minecraft != null && this.minecraft.player != null) {
                        this.minecraft.player.sendSystemMessage(
                            Component.literal("Degisiklik icin oyunu yeniden baslatin.").withStyle(ChatFormatting.YELLOW)
                        );
                    }
                    rebuildTabContent();
                }
            }).bounds(this.width / 2 - 160, y + i * 24, 320, 20).build();
            btn.active = !entry.protectedMod();
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
        }
    }

    private void buildCosmeticsTab() {
        int y = 64;
        for (int i = 0; i < CosmeticsManager.OPTIONS.length; i++) {
            CosmeticsManager.CosmeticOption opt = CosmeticsManager.OPTIONS[i];
            boolean selected = opt.id().equals(CosmeticsManager.getSelectedCosmetic());
            String label = (selected ? "> " : "  ") + opt.label() + " (Ucretsiz)";
            int idx = i;
            Button btn = Button.builder(Component.literal(label), b -> {
                CosmeticsManager.selectCosmetic(CosmeticsManager.OPTIONS[idx].id());
                rebuildTabContent();
            }).bounds(this.width / 2 - 160, y + i * 24, 320, 20).build();
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
        }
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        graphics.centeredText(this.font, this.title, this.width / 2, 12, 0x55FF88);
        String subtitle = activeTab == Tab.MODS
            ? "Modlari ac/kapa — degisiklik sonraki baslatmada gecerli"
            : "Ucretsiz pelerin secenekleri — sadece sen gorursun";
        graphics.centeredText(this.font, subtitle, this.width / 2, 52, 0xAAAAAA);
        super.extractRenderState(graphics, mouseX, mouseY, delta);
    }

    /** Envanter gibi: dunya acikken blur/panorama yerine seffaf karartma kullan. */
    @Override
    public boolean isInGameUi() {
        return true;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
