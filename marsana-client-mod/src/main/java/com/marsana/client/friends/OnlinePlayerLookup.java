package com.marsana.client.friends;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.player.AbstractClientPlayer;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class OnlinePlayerLookup {
    private OnlinePlayerLookup() {}

    public static List<String> listOtherPlayers(Minecraft client) {
        if (client == null || client.player == null) {
            return List.of();
        }

        String self = client.player.getGameProfile().name();
        Set<String> names = new LinkedHashSet<>();

        if (client.getConnection() != null) {
            for (PlayerInfo info : client.getConnection().getOnlinePlayers()) {
                if (info != null && info.getProfile() != null) {
                    String name = info.getProfile().name();
                    if (name != null && !name.isBlank() && !name.equalsIgnoreCase(self)) {
                        names.add(name);
                    }
                }
            }
        }

        if (client.level != null) {
            for (AbstractClientPlayer player : client.level.players()) {
                if (player == null || player == client.player) {
                    continue;
                }
                String name = player.getGameProfile().name();
                if (name != null && !name.isBlank() && !name.equalsIgnoreCase(self)) {
                    names.add(name);
                }
            }
        }

        List<String> sorted = new ArrayList<>(names);
        sorted.sort(String.CASE_INSENSITIVE_ORDER);
        return sorted;
    }
}
