package com.marsana.client.friends;

import com.marsana.client.menu.FriendChatScreen;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

public final class FriendsNetworking {
    private FriendsNetworking() {}

    public static void registerPayloads() {
        PayloadTypeRegistry.serverboundPlay().register(FriendsPayloads.FriendRequestC2S.TYPE, FriendsPayloads.FriendRequestC2S.CODEC);
        PayloadTypeRegistry.serverboundPlay().register(FriendsPayloads.FriendRequestReplyC2S.TYPE, FriendsPayloads.FriendRequestReplyC2S.CODEC);
        PayloadTypeRegistry.serverboundPlay().register(FriendsPayloads.FriendMessageC2S.TYPE, FriendsPayloads.FriendMessageC2S.CODEC);

        PayloadTypeRegistry.clientboundPlay().register(FriendsPayloads.FriendRequestS2C.TYPE, FriendsPayloads.FriendRequestS2C.CODEC);
        PayloadTypeRegistry.clientboundPlay().register(FriendsPayloads.FriendRequestResultS2C.TYPE, FriendsPayloads.FriendRequestResultS2C.CODEC);
        PayloadTypeRegistry.clientboundPlay().register(FriendsPayloads.FriendAddedS2C.TYPE, FriendsPayloads.FriendAddedS2C.CODEC);
        PayloadTypeRegistry.clientboundPlay().register(FriendsPayloads.FriendMessageS2C.TYPE, FriendsPayloads.FriendMessageS2C.CODEC);
    }

    public static void registerClientHandlers() {
        ClientPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendRequestS2C.TYPE, (payload, context) -> {
            context.client().execute(() -> {
                FriendsManager.addIncomingRequest(payload.senderUuid(), payload.senderName());
                notifyPlayer(context.client(), Component.literal(
                    payload.senderName() + " sana arkadaslik istegi gonderdi. H > Arkadaslar > Istekler"
                ).withStyle(ChatFormatting.AQUA));
            });
        });

        ClientPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendRequestResultS2C.TYPE, (payload, context) -> {
            context.client().execute(() -> {
                FriendsManager.removeOutgoingRequestByName(payload.targetName());
                if (payload.accepted()) {
                    notifyPlayer(context.client(), Component.literal(
                        payload.targetName() + " arkadaslik istegini kabul etti."
                    ).withStyle(ChatFormatting.GREEN));
                }
            });
        });

        ClientPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendAddedS2C.TYPE, (payload, context) -> {
            context.client().execute(() -> {
                FriendsManager.addFriend(payload.friendUuid(), payload.friendName());
                FriendsManager.removeIncomingRequest(payload.friendUuid());
                FriendsManager.removeOutgoingRequest(payload.friendUuid());
            });
        });

        ClientPlayNetworking.registerGlobalReceiver(FriendsPayloads.FriendMessageS2C.TYPE, (payload, context) -> {
            context.client().execute(() -> {
                FriendsManager.addIncomingMessage(payload.senderUuid(), payload.senderName(), payload.message(), payload.timestamp());
                Minecraft client = context.client();
                if (client.screen instanceof FriendChatScreen chat && chat.isChatWith(payload.senderUuid())) {
                    chat.refreshMessages();
                } else {
                    notifyPlayer(client, Component.literal(
                        payload.senderName() + ": " + payload.message()
                    ).withStyle(ChatFormatting.YELLOW));
                }
            });
        });
    }

    public static boolean sendFriendRequest(String targetName) {
        if (!ClientPlayNetworking.canSend(FriendsPayloads.FriendRequestC2S.TYPE)) {
            return false;
        }
        ClientPlayNetworking.send(new FriendsPayloads.FriendRequestC2S(targetName));
        FriendsManager.addOutgoingRequestByName(targetName);
        return true;
    }

    public static boolean sendFriendReply(java.util.UUID requesterUuid, boolean accept) {
        if (!ClientPlayNetworking.canSend(FriendsPayloads.FriendRequestReplyC2S.TYPE)) {
            return false;
        }
        ClientPlayNetworking.send(new FriendsPayloads.FriendRequestReplyC2S(requesterUuid, accept));
        if (accept) {
            FriendsManager.removeIncomingRequest(requesterUuid);
        }
        return true;
    }

    public static boolean sendFriendMessage(java.util.UUID targetUuid, String message) {
        if (!ClientPlayNetworking.canSend(FriendsPayloads.FriendMessageC2S.TYPE)) {
            return false;
        }
        ClientPlayNetworking.send(new FriendsPayloads.FriendMessageC2S(targetUuid, message));
        return true;
    }

    public static boolean isServerSupported() {
        return ClientPlayNetworking.canSend(FriendsPayloads.FriendRequestC2S.TYPE);
    }

    private static void notifyPlayer(Minecraft client, Component message) {
        if (client.player != null) {
            client.player.sendSystemMessage(message);
        }
    }
}
