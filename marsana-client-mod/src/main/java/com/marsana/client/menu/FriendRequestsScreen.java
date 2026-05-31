package com.marsana.client.menu;

import com.marsana.client.friends.FriendsManager;
import com.marsana.client.friends.FriendsNetworking;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.List;

public class FriendRequestsScreen extends Screen {
    private final Screen parent;
    private final List<Button> dynamicButtons = new ArrayList<>();

    public FriendRequestsScreen(Screen parent) {
        super(Component.literal("Arkadaslik Istekleri"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;

        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> onClose())
            .bounds(centerX - 160, this.height - 32, 100, 20).build());

        int y = 54;
        List<FriendsManager.FriendRequest> incoming = FriendsManager.listIncomingRequests();
        if (incoming.isEmpty()) {
            // no incoming rows
        } else {
            for (FriendsManager.FriendRequest req : incoming) {
                String label = req.name() + " — gelen istek";
                addRenderableWidget(Button.builder(Component.literal(label + " [Kabul]"), b -> accept(req))
                    .bounds(centerX - 160, y, 155, 20).build());
                addRenderableWidget(Button.builder(Component.literal("[Red]"), b -> deny(req))
                    .bounds(centerX + 5, y, 155, 20).build());
                y += 26;
            }
        }

        y += 8;
        List<FriendsManager.FriendRequest> outgoing = FriendsManager.listOutgoingRequests();
        for (FriendsManager.FriendRequest req : outgoing) {
            Button btn = Button.builder(Component.literal(req.name() + " — bekliyor"), b -> {})
                .bounds(centerX - 160, y, 320, 20).build();
            btn.active = false;
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
            y += 24;
        }
    }

    private void accept(FriendsManager.FriendRequest req) {
        if (FriendsNetworking.sendFriendReply(req.uuid(), true)) {
            FriendsManager.addFriend(req.uuid(), req.name());
            FriendsManager.removeIncomingRequest(req.uuid());
            notify(Component.literal(req.name() + " arkadas olarak eklendi.").withStyle(ChatFormatting.GREEN));
        } else {
            notify(Component.literal("Islem basarisiz.").withStyle(ChatFormatting.RED));
        }
        init();
    }

    private void deny(FriendsManager.FriendRequest req) {
        FriendsNetworking.sendFriendReply(req.uuid(), false);
        FriendsManager.removeIncomingRequest(req.uuid());
        notify(Component.literal(req.name() + " istegi reddedildi.").withStyle(ChatFormatting.YELLOW));
        init();
    }

    private void notify(Component msg) {
        if (this.minecraft != null && this.minecraft.player != null) {
            this.minecraft.player.sendSystemMessage(msg);
        }
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
        graphics.centeredText(this.font, "Gelen istekleri kabul veya reddet", this.width / 2, 28, 0xAAAAAA);
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
