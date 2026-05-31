package com.marsana.client.menu;

import com.marsana.client.friends.FriendsManager;
import com.marsana.client.friends.FriendsNetworking;
import com.marsana.client.friends.OnlinePlayerLookup;
import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.List;

public class AddFriendScreen extends Screen {
    private final Screen parent;
    private final List<Button> dynamicButtons = new ArrayList<>();
    private int scrollOffset = 0;
    private EditBox nameInput;
    private List<String> cachedPlayers = List.of();

    public AddFriendScreen(Screen parent) {
        super(Component.literal("Arkadas Ekle"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int listTop = 96;

        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> onClose())
            .bounds(centerX - 160, this.height - 32, 100, 20).build());

        nameInput = new EditBox(this.font, centerX - 160, 54, 220, 20, Component.literal("Oyuncu adi"));
        nameInput.setMaxLength(16);
        nameInput.setHint(Component.literal("Kullanici adi yaz..."));
        addRenderableWidget(nameInput);

        addRenderableWidget(Button.builder(Component.literal("Istek Gonder"), b -> sendRequest(nameInput.getValue().trim()))
            .bounds(centerX + 65, 54, 95, 20).build());

        cachedPlayers = OnlinePlayerLookup.listOtherPlayers(this.minecraft);
        int visibleRows = Math.max(1, (this.height - listTop - 48) / 24);
        int maxOffset = Math.max(0, cachedPlayers.size() - visibleRows);
        scrollOffset = Math.min(scrollOffset, maxOffset);

        clearDynamic();

        if (scrollOffset > 0) {
            Button up = Button.builder(Component.literal("^ Yukari"), b -> {
                scrollOffset = Math.max(0, scrollOffset - 1);
                init();
            }).bounds(centerX - 160, listTop - 22, 155, 18).build();
            addRenderableWidget(up);
            dynamicButtons.add(up);
        }

        int y = listTop;
        int end = Math.min(cachedPlayers.size(), scrollOffset + visibleRows);
        for (int i = scrollOffset; i < end; i++) {
            String name = cachedPlayers.get(i);
            boolean pending = FriendsManager.hasOutgoingRequest(name);
            boolean alreadyFriend = FriendsManager.isFriendByName(name);
            String suffix = alreadyFriend ? "[Arkadas]" : pending ? "[Bekliyor]" : "[Istek Gonder]";
            String label = name + " " + suffix;
            Button btn = Button.builder(Component.literal(label), b -> sendRequest(name))
                .bounds(centerX - 160, y + (i - scrollOffset) * 24, 320, 20).build();
            btn.active = !pending && !alreadyFriend;
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
        }

        if (scrollOffset + visibleRows < cachedPlayers.size()) {
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
        if (name == null || name.isBlank()) {
            notify(Component.literal("Gecerli bir oyuncu adi yaz.").withStyle(ChatFormatting.YELLOW));
            return;
        }
        if (this.minecraft != null && this.minecraft.player != null
            && name.equalsIgnoreCase(this.minecraft.player.getGameProfile().name())) {
            notify(Component.literal("Kendine istek gonderemezsin.").withStyle(ChatFormatting.RED));
            return;
        }
        if (FriendsManager.isFriendByName(name)) {
            notify(Component.literal(name + " zaten arkadasin.").withStyle(ChatFormatting.YELLOW));
            return;
        }
        if (!FriendsNetworking.isServerSupported()) {
            notify(Component.literal(
                "Sunucu Marsana arkadaslik sistemini desteklemiyor. Sunucuya Marsana Client modu kurulmali."
            ).withStyle(ChatFormatting.RED));
            return;
        }
        if (FriendsNetworking.sendFriendRequest(name)) {
            notify(Component.literal("Istek gonderildi: " + name).withStyle(ChatFormatting.GREEN));
            if (nameInput != null) {
                nameInput.setValue("");
            }
        } else {
            notify(Component.literal("Istek gonderilemedi.").withStyle(ChatFormatting.RED));
        }
        init();
    }

    private void notify(Component message) {
        if (this.minecraft != null && this.minecraft.player != null) {
            this.minecraft.player.sendSystemMessage(message);
        }
    }

    @Override
    public boolean keyPressed(KeyEvent event) {
        if (nameInput != null && nameInput.keyPressed(event)) {
            return true;
        }
        if (nameInput != null && nameInput.isFocused()
            && (event.key() == InputConstants.KEY_RETURN || event.key() == InputConstants.KEY_NUMPADENTER)) {
            sendRequest(nameInput.getValue().trim());
            return true;
        }
        return super.keyPressed(event);
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
            ? "Sunucudaki oyuncular veya isim yazarak istek gonder"
            : "Oyunculari gorebilirsin; istek icin sunucuda Marsana Client modu gerekli";
        graphics.centeredText(this.font, subtitle, this.width / 2, 28, 0xAAAAAA);
        graphics.text(this.font, "Oyuncu adi:", this.width / 2 - 160, 44, 0xAAAAAA);

        if (cachedPlayers.isEmpty()) {
            graphics.centeredText(this.font, "Tab listesinde baska oyuncu yok — yukaridan isim yaz.", this.width / 2, 78, 0x888888);
        } else {
            graphics.text(this.font, "Cevrimici oyuncular:", this.width / 2 - 160, 82, 0xAAAAAA);
        }

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
