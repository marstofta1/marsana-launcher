package com.marsana.schematicfarm.menu;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import com.marsana.schematicfarm.schematic.BlockTypeProgress;
import com.marsana.schematicfarm.schematic.FarmTemplate;
import com.marsana.schematicfarm.schematic.FarmTemplateRegistry;
import com.marsana.schematicfarm.schematic.FarmType;
import com.marsana.schematicfarm.schematic.ScanResult;
import com.marsana.schematicfarm.schematic.SchematicScanner;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.List;

public class SchematicFarmScreen extends Screen {
    private FarmType selectedFarm;
    private ScanResult lastScan = new ScanResult(0, 0, List.of(), false);
    private final List<Button> dynamicButtons = new ArrayList<>();
    private int progressScroll;
    private Button hologramToggleBtn;

    public SchematicFarmScreen() {
        super(Component.literal("Marsana Sematik Farm"));
        this.selectedFarm = FarmType.fromId(SchematicConfigManager.getSchematicFarmId());
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        addRenderableWidget(Button.builder(Component.literal("Kapat"), b -> onClose())
            .bounds(centerX - 50, this.height - 28, 100, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Konumu Ayarla (Ayaklarim)"), b -> setAnchorHere())
            .bounds(centerX - 160, this.height - 28, 155, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Yenile"), b -> refreshScan())
            .bounds(centerX + 5, this.height - 28, 100, 20).build());

        hologramToggleBtn = Button.builder(Component.literal(hologramToggleText()), b -> toggleHolograms())
            .bounds(centerX - 160, 48, 155, 20).build();
        addRenderableWidget(hologramToggleBtn);

        rebuildContent();
        if (this.minecraft != null) {
            this.minecraft.execute(this::refreshScan);
        } else {
            refreshScan();
        }
    }

    private void clearDynamic() {
        for (Button btn : dynamicButtons) {
            removeWidget(btn);
        }
        dynamicButtons.clear();
    }

    private void rebuildContent() {
        clearDynamic();
        int leftX = this.width / 2 - 160;
        int y = 72;
        for (FarmType type : FarmTemplateRegistry.allTypes()) {
            boolean active = type == selectedFarm;
            String prefix = active ? "> " : "  ";
            FarmType captured = type;
            Button btn = Button.builder(Component.literal(prefix + type.displayName()), b -> selectFarm(captured))
                .bounds(leftX, y, 150, 20).build();
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
            y += 24;
        }
    }

    private void selectFarm(FarmType type) {
        selectedFarm = type;
        SchematicConfigManager.setSchematicFarmId(type.id());
        progressScroll = 0;
        rebuildContent();
        refreshScan();
    }

    private String hologramToggleText() {
        return SchematicConfigManager.isHologramsEnabled()
            ? "Hologram: Acik"
            : "Hologram: Kapali";
    }

    private void toggleHolograms() {
        SchematicConfigManager.setHologramsEnabled(!SchematicConfigManager.isHologramsEnabled());
        if (hologramToggleBtn != null) {
            hologramToggleBtn.setMessage(Component.literal(hologramToggleText()));
        }
    }

    private void setAnchorHere() {
        if (this.minecraft == null || this.minecraft.player == null) {
            return;
        }
        BlockPos feet = this.minecraft.player.blockPosition();
        String dimension = this.minecraft.level != null
            ? String.valueOf(this.minecraft.level.dimension())
            : "minecraft:overworld";
        SchematicConfigManager.setSchematicAnchor(dimension, feet);
        if (this.minecraft.player != null) {
            this.minecraft.player.sendSystemMessage(Component.literal(
                "Sematik baslangic noktasi: " + feet.getX() + ", " + feet.getY() + ", " + feet.getZ()
            ).withStyle(ChatFormatting.GREEN));
        }
        refreshScan();
    }

    private void refreshScan() {
        if (this.minecraft == null || this.minecraft.level == null) {
            lastScan = new ScanResult(0, 0, List.of(), false);
            return;
        }
        BlockPos anchor = SchematicConfigManager.getSchematicAnchor();
        if (anchor == null) {
            lastScan = new ScanResult(0, 0, List.of(), false);
            return;
        }
        String dim = SchematicConfigManager.getSchematicAnchorDimension();
        if (dim != null && SchematicConfigManager.normalizeDimensionId(String.valueOf(this.minecraft.level.dimension())).equals(dim)) {
            FarmTemplate template = FarmTemplateRegistry.get(selectedFarm);
            lastScan = SchematicScanner.scan(this.minecraft.level, anchor, template);
        } else {
            lastScan = new ScanResult(0, 0, List.of(), false);
        }
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        graphics.centeredText(this.font, this.title, this.width / 2, 12, 0x55FF88);
        graphics.centeredText(this.font, "F8 — farm sec, hologram ve ilerlemeyi gor", this.width / 2, 24, 0xAAAAAA);
        graphics.centeredText(this.font, "Yaratıcı: holograma bak + sag tik = havaya blok", this.width / 2, 36, 0x88CCFF);

        FarmTemplate template = FarmTemplateRegistry.get(selectedFarm);
        int rightX = this.width / 2 + 10;
        int y = 58;
        String description = template != null ? template.description() : "";
        graphics.text(this.font, description, rightX, y, 0xCCCCCC);
        y += 14;

        BlockPos anchor = SchematicConfigManager.getSchematicAnchor();
        String anchorDim = SchematicConfigManager.getSchematicAnchorDimension();
        String currentDim = this.minecraft != null && this.minecraft.level != null
            ? SchematicConfigManager.normalizeDimensionId(String.valueOf(this.minecraft.level.dimension()))
            : null;

        if (anchor == null) {
            graphics.text(this.font, "Baslangic noktasi yok — Konumu Ayarla (hologram icin)", rightX, y + 4, 0xFFAA00);
        } else if (anchorDim != null && currentDim != null && !anchorDim.equals(currentDim)) {
            graphics.text(this.font, "Baslangic noktasi baska boyutta — yeniden ayarlayin", rightX, y + 4, 0xFF5555);
        } else {
            String summary = String.format(
                "Toplam: %d / %d blok (%d%%) — Eksik: %d",
                lastScan.totalPlaced(),
                lastScan.totalExpected(),
                lastScan.totalPercent(),
                lastScan.totalMissing()
            );
            graphics.text(this.font, summary, rightX, y, 0xFFFFFF);
            y += 16;
            graphics.text(this.font, "Blok turu — Var / Gerekli (Eksik)", rightX, y, 0x888888);
            y += 12;

            List<BlockTypeProgress> rows = lastScan.byType();
            int visible = Math.max(1, (this.height - 160) / 12);
            int maxScroll = Math.max(0, rows.size() - visible);
            progressScroll = Math.min(progressScroll, maxScroll);
            int end = Math.min(rows.size(), progressScroll + visible);
            for (int i = progressScroll; i < end; i++) {
                BlockTypeProgress row = rows.get(i);
                int color = row.missing() == 0 ? 0x55FF88 : 0xFFCC66;
                String line = String.format(
                    "%s: %d / %d (-%d)",
                    row.displayName(),
                    row.placed(),
                    row.expected(),
                    row.missing()
                );
                graphics.text(this.font, line, rightX, y + (i - progressScroll) * 12, color);
            }
        }

        super.extractRenderState(graphics, mouseX, mouseY, delta);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double scrollX, double scrollY) {
        if (scrollY > 0) {
            progressScroll = Math.max(0, progressScroll - 1);
        } else if (scrollY < 0) {
            progressScroll++;
        }
        return true;
    }

    @Override
    public boolean isInGameUi() {
        return true;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
