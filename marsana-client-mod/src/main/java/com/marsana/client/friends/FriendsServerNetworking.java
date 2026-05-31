package com.marsana.client.friends;

import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.players.PlayerList;

import java.util.UUID;

public final class FriendsServerNetworking {
    private static final int MAX_MESSAGE_LENGTH = 256;

    private FriendsServerNetworking() {}

    public static void register() {
        ServerPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendRequestC2S.TYPE, (payload, context) -> {
            context.server().execute(() -> handleFriendRequest(context.server(), context.player(), payload.targetName()));
        });

        ServerPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendRequestReplyC2S.TYPE, (payload, context) -> {
            context.server().execute(() -> handleFriendReply(context.server(), context.player(), payload.requesterUuid(), payload.accept()));
        });

        ServerPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendMessageC2S.TYPE, (payload, context) -> {
            context.server().execute(() -> handleFriendMessage(context.server(), context.player(), payload.targetUuid(), payload.message()));
        });
    }

    private static void handleFriendRequest(MinecraftServer server, ServerPlayer sender, String targetName) {
        if (targetName == null || targetName.isBlank() || targetName.length() > 16) {
            return;
        }
        if (targetName.equalsIgnoreCase(sender.getGameProfile().name())) {
            return;
        }

        ServerPlayer target = server.getPlayerList().getPlayerByName(targetName);
        if (target == null) {
            sender.sendSystemMessage(Component.literal("Oyuncu bulunamadi veya cevrimdisi: " + targetName));
            return;
        }

        ServerPlayNetworking.send(target, new FriendsPayloads.FriendRequestS2C(
            sender.getUUID(),
            sender.getGameProfile().name()
        ));
        sender.sendSystemMessage(Component.literal("Arkadaslik istegi gonderildi: " + targetName));
    }

    private static void handleFriendReply(MinecraftServer server, ServerPlayer responder, UUID requesterUuid, boolean accept) {
        ServerPlayer requester = server.getPlayerList().getPlayer(requesterUuid);
        if (requester == null) {
            responder.sendSystemMessage(Component.literal("Istek gonderen oyuncu artik cevrimici degil."));
            return;
        }

        String requesterName = requester.getGameProfile().name();
        String responderName = responder.getGameProfile().name();

        if (accept) {
            ServerPlayNetworking.send(requester, new FriendsPayloads.FriendAddedS2C(responder.getUUID(), responderName));
            ServerPlayNetworking.send(responder, new FriendsPayloads.FriendAddedS2C(requester.getUUID(), requesterName));
            requester.sendSystemMessage(Component.literal(responderName + " arkadaslik istegini kabul etti."));
            responder.sendSystemMessage(Component.literal(requesterName + " ile arkadas oldunuz."));
        } else {
            ServerPlayNetworking.send(requester, new FriendsPayloads.FriendRequestResultS2C(responderName, false));
            requester.sendSystemMessage(Component.literal(responderName + " arkadaslik istegini reddetti."));
        }
    }

    private static void handleFriendMessage(MinecraftServer server, ServerPlayer sender, UUID targetUuid, String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        String trimmed = message.trim();
        if (trimmed.length() > MAX_MESSAGE_LENGTH) {
            trimmed = trimmed.substring(0, MAX_MESSAGE_LENGTH);
        }

        PlayerList playerList = server.getPlayerList();
        ServerPlayer target = playerList.getPlayer(targetUuid);
        if (target == null) {
            sender.sendSystemMessage(Component.literal("Arkadasin su an cevrimici degil."));
            return;
        }

        long now = System.currentTimeMillis();
        ServerPlayNetworking.send(target, new FriendsPayloads.FriendMessageS2C(
            sender.getUUID(),
            sender.getGameProfile().name(),
            trimmed,
            now
        ));
    }
}
