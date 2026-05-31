package com.marsana.client.menu;

import com.mojang.blaze3d.platform.InputConstants;
import com.marsana.client.friends.FriendsManager;
import com.marsana.client.friends.FriendsNetworking;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class FriendChatScreen extends Screen {
    private final Screen parent;
    private final UUID friendUuid;
    private final String friendName;
    private EditBox messageInput;
    private int scrollOffset = 0;

    public FriendChatScreen(Screen parent, UUID friendUuid, String friendName) {
        super(Component.literal("Mesaj: " + friendName));
        this.parent = parent;
        this.friendUuid = friendUuid;
        this.friendName = friendName;
    }

    public boolean isChatWith(UUID uuid) {
        return friendUuid.equals(uuid);
    }

    public void refreshMessages() {
        init();
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int inputY = this.height - 56;

        messageInput = new EditBox(this.font, centerX - 160, inputY, 240, 20, Component.literal("Mesaj"));
        messageInput.setMaxLength(256);
        messageInput.setResponder(s -> {});
        addRenderableWidget(messageInput);
        setInitialFocus(messageInput);

        addRenderableWidget(Button.builder(Component.literal("Gonder"), b -> sendMessage())
            .bounds(centerX + 85, inputY, 75, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> onClose())
            .bounds(centerX - 160, this.height - 32, 100, 20).build());

        List<FriendsManager.ChatMessage> messages = FriendsManager.getChatHistory(friendUuid);
        int visibleRows = Math.max(1, (inputY - 70) / 14);
        int maxOffset = Math.max(0, messages.size() - visibleRows);
        scrollOffset = Math.min(scrollOffset, maxOffset);

        if (scrollOffset > 0) {
            addRenderableWidget(Button.builder(Component.literal("^"), b -> {
                scrollOffset = Math.max(0, scrollOffset - 3);
                init();
            }).bounds(centerX + 120, 48, 40, 18).build());
        }

        if (scrollOffset + visibleRows < messages.size()) {
            addRenderableWidget(Button.builder(Component.literal("v"), b -> {
                scrollOffset = Math.min(maxOffset, scrollOffset + 3);
                init();
            }).bounds(centerX + 120, inputY - 24, 40, 18).build());
        }
    }

    private void sendMessage() {
        String text = messageInput.getValue().trim();
        if (text.isEmpty()) {
            return;
        }
        if (!FriendsNetworking.sendFriendMessage(friendUuid, text)) {
            if (this.minecraft != null && this.minecraft.player != null) {
                this.minecraft.player.sendSystemMessage(Component.literal(
                    "Mesaj gonderilemedi — sunucu desteklemiyor veya arkadas cevrimdisi."
                ).withStyle(ChatFormatting.RED));
            }
            return;
        }
        FriendsManager.addOutgoingMessage(friendUuid, friendName, text);
        messageInput.setValue("");
        init();
    }

    @Override
    public boolean keyPressed(KeyEvent event) {
        if (messageInput != null && messageInput.keyPressed(event)) {
            return true;
        }
        if (messageInput != null && messageInput.isFocused()
            && (event.key() == InputConstants.KEY_RETURN || event.key() == InputConstants.KEY_NUMPADENTER)) {
            sendMessage();
            return true;
        }
        return super.keyPressed(event);
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        graphics.centeredText(this.font, this.title, this.width / 2, 12, 0x55FF88);
        graphics.centeredText(this.font, friendName, this.width / 2, 28, 0xAAAAAA);

        List<FriendsManager.ChatMessage> messages = FriendsManager.getChatHistory(friendUuid);
        int inputY = this.height - 56;
        int visibleRows = Math.max(1, (inputY - 70) / 14);
        int end = Math.min(messages.size(), scrollOffset + visibleRows);
        int y = 48;

        SimpleDateFormat fmt = new SimpleDateFormat("HH:mm", Locale.getDefault());
        for (int i = scrollOffset; i < end; i++) {
            FriendsManager.ChatMessage msg = messages.get(i);
            String time = fmt.format(new Date(msg.timestamp()));
            String prefix = msg.outgoing() ? "Sen" : msg.fromName();
            int color = msg.outgoing() ? 0x88FF88 : 0xFFFFFF;
            String line = "[" + time + "] " + prefix + ": " + msg.text();
            if (line.length() > 52) {
                line = line.substring(0, 49) + "...";
            }
            graphics.text(this.font, line, this.width / 2 - 160, y + (i - scrollOffset) * 14, color);
        }

        super.extractRenderState(graphics, mouseX, mouseY, delta);
    }

    @Override
    public void onClose() {
        if (this.minecraft != null) {
            this.minecraft.setScreen(parent);
        }
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
