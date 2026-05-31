package com.marsana.client.menu;

import com.marsana.client.friends.FriendsManager;
import com.marsana.client.friends.FriendsNetworking;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.List;

public class AddFriendScreen extends Screen {
    private final Screen parent;
    private final List<Button> dynamicButtons = new ArrayList<>();
    private int scrollOffset = 0;

    public AddFriendScreen(Screen parent) {
        super(Component.literal("Arkadas Ekle"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;

        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> onClose())
            .bounds(centerX - 160, this.height - 32, 100, 20).build());

        if (!FriendsNetworking.isServerSupported()) {
            return;
        }

        List<String> players = listOnlinePlayers();
        int visibleRows = Math.max(1, (this.height - 100) / 24);
        int maxOffset = Math.max(0, players.size() - visibleRows);
        scrollOffset = Math.min(scrollOffset, maxOffset);

        if (scrollOffset > 0) {
            Button up = Button.builder(Component.literal("^ Yukari"), b -> {
                scrollOffset = Math.max(0, scrollOffset - 1);
                rebuildList(players, visibleRows, maxOffset);
            }).bounds(centerX - 160, 48, 155, 18).build();
            addRenderableWidget(up);
            dynamicButtons.add(up);
        }

        rebuildList(players, visibleRows, maxOffset);
    }

    private void rebuildList(List<String> players, int visibleRows, int maxOffset) {
        clearDynamic();
        int centerX = this.width / 2;
        int y = scrollOffset > 0 ? 70 : 54;
        int end = Math.min(players.size(), scrollOffset + visibleRows);

        for (int i = scrollOffset; i < end; i++) {
            String name = players.get(i);
            boolean pending = FriendsManager.hasOutgoingRequest(name);
            String label = pending ? name + " [Bekliyor]" : name + " [Istek Gonder]";
            Button btn = Button.builder(Component.literal(label), b -> sendRequest(name))
                .bounds(centerX - 160, y + (i - scrollOffset) * 24, 320, 20).build();
            btn.active = !pending && !FriendsManager.isFriendByName(name);
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
        }

        if (scrollOffset + visibleRows < players.size()) {
            int scrollY = y + (end - scrollOffset) * 24 + 4;
            Button down = Button.builder(Component.literal("v Asagi"), b -> {
                scrollOffset = Math.min(maxOffset, scrollOffset + 1);
                init();
            }).bounds(centerX + 5, scrollY, 155, 18).build();
            addRenderableWidget(down);
            dynamicButtons.add(down);
        }
    }

    private void clearDynamic() {
        for (Button btn : dynamicButtons) {
            removeWidget(btn);
        }
        dynamicButtons.clear();
    }

    private void sendRequest(String name) {
        if (this.minecraft != null && this.minecraft.player != null) {
            if (FriendsNetworking.sendFriendRequest(name)) {
                this.minecraft.player.sendSystemMessage(Component.literal("Istek gonderildi: " + name)
                    .withStyle(ChatFormatting.GREEN));
            } else {
                this.minecraft.player.sendSystemMessage(Component.literal(
                    "Sunucu Marsana arkadaslik sistemini desteklemiyor."
                ).withStyle(ChatFormatting.RED));
            }
        }
        init();
    }

    private List<String> listOnlinePlayers() {
        if (this.minecraft == null || this.minecraft.player == null || this.minecraft.getConnection() == null) {
            return List.of();
        }
        String self = this.minecraft.player.getGameProfile().name();
        List<String> names = new ArrayList<>();
        for (PlayerInfo info : this.minecraft.getConnection().getOnlinePlayers()) {
            String name = info.getProfile().name();
            if (!name.equalsIgnoreCase(self)) {
                names.add(name);
            }
        }
        names.sort(String.CASE_INSENSITIVE_ORDER);
        return names;
    }

    @Override
    public void onClose() {
        if (this.minecraft != null) {
            this.minecraft.setScreen(parent);
        }
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        graphics.centeredText(this.font, this.title, this.width / 2, 12, 0x55FF88);
        String subtitle = FriendsNetworking.isServerSupported()
            ? "Sunucudaki oyuncular — tikla ve istek gonder"
            : "Sunucu desteklemiyor — Fabric sunucusuna Marsana Client modu gerekli";
        graphics.centeredText(this.font, subtitle, this.width / 2, 28, 0xAAAAAA);
        super.extractRenderState(graphics, mouseX, mouseY, delta);
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
