package com.marsana.client.menu;

import com.marsana.client.cosmetics.CosmeticsManager;
import com.marsana.client.friends.FriendsManager;
import com.marsana.client.friends.FriendsNetworking;
import com.marsana.client.friends.OnlinePlayerLookup;
import com.marsana.client.mods.ModToggleManager;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.ChatFormatting;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class MarsanaMenuScreen extends Screen {
    private enum Tab { MODS, COSMETICS, FRIENDS }

    private Tab activeTab = Tab.MODS;
    private final List<Button> dynamicButtons = new ArrayList<>();
    private Button modsTabButton;
    private Button cosmeticsTabButton;
    private Button friendsTabButton;
    private int modScrollOffset = 0;
    private int friendsScrollOffset = 0;

    public MarsanaMenuScreen() {
        super(Component.literal("Marsana Client"));
    }

    @Override
    protected void init() {
        ModToggleManager.syncConfigFromRuntime();
        int centerX = this.width / 2;
        int top = 28;

        modsTabButton = Button.builder(Component.literal("Modlar"), b -> switchTab(Tab.MODS))
            .bounds(centerX - 155, top, 100, 20).build();
        cosmeticsTabButton = Button.builder(Component.literal("Kozmetik"), b -> switchTab(Tab.COSMETICS))
            .bounds(centerX - 50, top, 100, 20).build();
        friendsTabButton = Button.builder(Component.literal("Arkadaslar"), b -> switchTab(Tab.FRIENDS))
            .bounds(centerX + 55, top, 100, 20).build();

        addRenderableWidget(modsTabButton);
        addRenderableWidget(cosmeticsTabButton);
        addRenderableWidget(friendsTabButton);
        addRenderableWidget(Button.builder(Component.literal("Kapat"), b -> onClose())
            .bounds(centerX - 50, this.height - 32, 100, 20).build());

        rebuildTabContent();
    }

    private void switchTab(Tab tab) {
        activeTab = tab;
        modScrollOffset = 0;
        friendsScrollOffset = 0;
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
        switch (activeTab) {
            case MODS -> buildModsTab();
            case COSMETICS -> buildCosmeticsTab();
            case FRIENDS -> buildFriendsTab();
        }
    }

    private void buildModsTab() {
        List<ModToggleManager.ModEntry> mods = ModToggleManager.listMods();
        int visibleRows = Math.max(1, (this.height - 120) / 24);
        int maxOffset = Math.max(0, mods.size() - visibleRows);
        modScrollOffset = Math.min(modScrollOffset, maxOffset);

        if (modScrollOffset > 0) {
            Button up = Button.builder(Component.literal("^ Yukari"), b -> {
                modScrollOffset = Math.max(0, modScrollOffset - 1);
                rebuildTabContent();
            }).bounds(this.width / 2 - 160, 58, 155, 18).build();
            addRenderableWidget(up);
            dynamicButtons.add(up);
        }

        int y = modScrollOffset > 0 ? 80 : 64;
        int end = Math.min(mods.size(), modScrollOffset + visibleRows);
        for (int i = modScrollOffset; i < end; i++) {
            ModToggleManager.ModEntry entry = mods.get(i);
            String state = entry.enabled() ? "Acik" : "Kapali";
            String label = entry.displayName() + " [" + state + "]";
            Button btn = Button.builder(Component.literal(label), b -> onModToggle(entry))
                .bounds(this.width / 2 - 160, y + (i - modScrollOffset) * 24, 320, 20).build();
            btn.active = !entry.protectedMod();
            addRenderableWidget(btn);
            dynamicButtons.add(btn);
        }

        if (modScrollOffset + visibleRows < mods.size()) {
            int scrollY = y + (end - modScrollOffset) * 24 + 4;
            Button down = Button.builder(Component.literal("v Asagi"), b -> {
                modScrollOffset = Math.min(maxOffset, modScrollOffset + 1);
                rebuildTabContent();
            }).bounds(this.width / 2 + 5, scrollY, 155, 18).build();
            addRenderableWidget(down);
            dynamicButtons.add(down);
        }
    }

    private void onModToggle(ModToggleManager.ModEntry entry) {
        if (entry.protectedMod()) {
            return;
        }
        ModToggleManager.ToggleResult result = ModToggleManager.toggleMod(entry.fileName(), !entry.enabled());
        if (this.minecraft != null && this.minecraft.player != null) {
            Component msg = toggleMessage(entry.displayName(), result);
            this.minecraft.player.sendSystemMessage(msg);
        }
        rebuildTabContent();
    }

    private static Component toggleMessage(String name, ModToggleManager.ToggleResult result) {
        return switch (result.outcome()) {
            case APPLIED -> Component.literal(name + " guncellendi.")
                .withStyle(ChatFormatting.GREEN);
            case SAVED_RESTART -> Component.literal(
                name + " kaydedildi. Sodium gibi modlar tam kapanmak icin oyunu kapatip yeniden baslat.")
                .withStyle(ChatFormatting.YELLOW);
            case BLOCKED -> Component.literal(name + " degistirilemez.")
                .withStyle(ChatFormatting.RED);
        };
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

    private void buildFriendsTab() {
        int centerX = this.width / 2;
        int y = 64;

        int pending = FriendsManager.pendingRequestCount();
        String requestsLabel = pending > 0 ? "Istekler (" + pending + ")" : "Istekler";
        addRenderableWidget(Button.builder(Component.literal("Arkadas Ekle"), b -> openAddFriend())
            .bounds(centerX - 160, y, 155, 20).build());
        addRenderableWidget(Button.builder(Component.literal(requestsLabel), b -> openRequests())
            .bounds(centerX + 5, y, 155, 20).build());
        y += 28;

        List<FriendsManager.FriendEntry> friends = FriendsManager.listFriends();
        int visibleRows = Math.max(1, (this.height - 140) / 24);
        int maxOffset = Math.max(0, friends.size() - visibleRows);
        friendsScrollOffset = Math.min(friendsScrollOffset, maxOffset);

        Set<String> online = onlinePlayerNames();

        if (friendsScrollOffset > 0) {
            Button up = Button.builder(Component.literal("^ Yukari"), b -> {
                friendsScrollOffset = Math.max(0, friendsScrollOffset - 1);
                rebuildTabContent();
            }).bounds(centerX - 160, y, 155, 18).build();
            addRenderableWidget(up);
            dynamicButtons.add(up);
            y += 22;
        }

        int end = Math.min(friends.size(), friendsScrollOffset + visibleRows);
        for (int i = friendsScrollOffset; i < end; i++) {
            FriendsManager.FriendEntry friend = friends.get(i);
            boolean onlineNow = online.contains(friend.name().toLowerCase());
            String status = onlineNow ? "Cevrimici" : "Cevrimdisi";
            String label = friend.name() + " [" + status + "]";
            int row = i - friendsScrollOffset;
            Button msgBtn = Button.builder(Component.literal(label + " > Mesaj"), b -> openChat(friend))
                .bounds(centerX - 160, y + row * 24, 320, 20).build();
            addRenderableWidget(msgBtn);
            dynamicButtons.add(msgBtn);
        }

        if (friends.isEmpty()) {
            Button hint = Button.builder(Component.literal("Henuz arkadas yok — Arkadas Ekle"), b -> openAddFriend())
                .bounds(centerX - 160, y, 320, 20).build();
            addRenderableWidget(hint);
            dynamicButtons.add(hint);
        }

        if (friendsScrollOffset + visibleRows < friends.size()) {
            int scrollY = y + (end - friendsScrollOffset) * 24 + 4;
            Button down = Button.builder(Component.literal("v Asagi"), b -> {
                friendsScrollOffset = Math.min(maxOffset, friendsScrollOffset + 1);
                rebuildTabContent();
            }).bounds(centerX + 5, scrollY, 155, 18).build();
            addRenderableWidget(down);
            dynamicButtons.add(down);
        }
    }

    private Set<String> onlinePlayerNames() {
        return OnlinePlayerLookup.listOtherPlayers(this.minecraft).stream()
            .map(String::toLowerCase)
            .collect(Collectors.toSet());
    }

    private void openAddFriend() {
        if (this.minecraft != null) {
            this.minecraft.setScreen(new AddFriendScreen(this));
        }
    }

    private void openRequests() {
        if (this.minecraft != null) {
            this.minecraft.setScreen(new FriendRequestsScreen(this));
        }
    }

    private void openChat(FriendsManager.FriendEntry friend) {
        if (this.minecraft != null) {
            this.minecraft.setScreen(new FriendChatScreen(this, friend.uuid(), friend.name()));
        }
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float delta) {
        graphics.centeredText(this.font, this.title, this.width / 2, 12, 0x55FF88);
        String subtitle = switch (activeTab) {
            case MODS -> "Marsana HUD (CPS, keystrokes, zoom) aninda; Modrinth modlari jar ile";
            case COSMETICS -> "Ucretsiz pelerin secenekleri — sadece sen gorursun";
            case FRIENDS -> FriendsNetworking.isServerSupported()
                ? "Sunucudaki oyunculara istek gonder, arkadaslarinla mesajlas"
                : "Arkadaslik icin sunucuda Marsana Client modu gerekli";
        };
        graphics.centeredText(this.font, subtitle, this.width / 2, 52, 0xAAAAAA);
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
