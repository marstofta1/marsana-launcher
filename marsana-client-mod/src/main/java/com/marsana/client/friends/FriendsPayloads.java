package com.marsana.client.friends;

import com.marsana.client.MarsanaClientMod;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

import java.util.UUID;

public final class FriendsPayloads {
    private FriendsPayloads() {}

    static final StreamCodec<RegistryFriendlyByteBuf, UUID> UUID_CODEC = StreamCodec.composite(
        ByteBufCodecs.VAR_LONG, UUID::getMostSignificantBits,
        ByteBufCodecs.VAR_LONG, UUID::getLeastSignificantBits,
        UUID::new
    );

    private static Identifier id(String path) {
        return Identifier.fromNamespaceAndPath(MarsanaClientMod.MOD_ID, path);
    }

    /** Client -> Server: arkadaslik istegi gonder */
    public record FriendRequestC2S(String targetName) implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendRequestC2S> TYPE =
            new CustomPacketPayload.Type<>(id("friend_request"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendRequestC2S> CODEC =
            StreamCodec.composite(ByteBufCodecs.STRING_UTF8, FriendRequestC2S::targetName, FriendRequestC2S::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Server -> Client: gelen arkadaslik istegi */
    public record FriendRequestS2C(UUID senderUuid, String senderName) implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendRequestS2C> TYPE =
            new CustomPacketPayload.Type<>(id("friend_request_notify"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendRequestS2C> CODEC =
            StreamCodec.composite(
                UUID_CODEC, FriendRequestS2C::senderUuid,
                ByteBufCodecs.STRING_UTF8, FriendRequestS2C::senderName,
                FriendRequestS2C::new
            );

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> Server: istegi kabul/red */
    public record FriendRequestReplyC2S(UUID requesterUuid, boolean accept) implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendRequestReplyC2S> TYPE =
            new CustomPacketPayload.Type<>(id("friend_request_reply"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendRequestReplyC2S> CODEC =
            StreamCodec.composite(
                UUID_CODEC, FriendRequestReplyC2S::requesterUuid,
                ByteBufCodecs.BOOL, FriendRequestReplyC2S::accept,
                FriendRequestReplyC2S::new
            );

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Server -> Client: istek sonucu (gonderen icin) */
    public record FriendRequestResultS2C(String targetName, boolean accepted) implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendRequestResultS2C> TYPE =
            new CustomPacketPayload.Type<>(id("friend_request_result"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendRequestResultS2C> CODEC =
            StreamCodec.composite(
                ByteBufCodecs.STRING_UTF8, FriendRequestResultS2C::targetName,
                ByteBufCodecs.BOOL, FriendRequestResultS2C::accepted,
                FriendRequestResultS2C::new
            );

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Server -> Client: yeni arkadas eklendi */
    public record FriendAddedS2C(UUID friendUuid, String friendName) implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendAddedS2C> TYPE =
            new CustomPacketPayload.Type<>(id("friend_added"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendAddedS2C> CODEC =
            StreamCodec.composite(
                UUID_CODEC, FriendAddedS2C::friendUuid,
                ByteBufCodecs.STRING_UTF8, FriendAddedS2C::friendName,
                FriendAddedS2C::new
            );

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> Server: arkadas mesaji */
    public record FriendMessageC2S(UUID targetUuid, String message) implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendMessageC2S> TYPE =
            new CustomPacketPayload.Type<>(id("friend_message"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendMessageC2S> CODEC =
            StreamCodec.composite(
                UUID_CODEC, FriendMessageC2S::targetUuid,
                ByteBufCodecs.STRING_UTF8, FriendMessageC2S::message,
                FriendMessageC2S::new
            );

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Server -> Client: gelen arkadas mesaji */
    public record FriendMessageS2C(UUID senderUuid, String senderName, String message, long timestamp)
        implements CustomPacketPayload {
        public static final CustomPacketPayload.Type<FriendMessageS2C> TYPE =
            new CustomPacketPayload.Type<>(id("friend_message_notify"));
        public static final StreamCodec<RegistryFriendlyByteBuf, FriendMessageS2C> CODEC =
            StreamCodec.composite(
                UUID_CODEC, FriendMessageS2C::senderUuid,
                ByteBufCodecs.STRING_UTF8, FriendMessageS2C::senderName,
                ByteBufCodecs.STRING_UTF8, FriendMessageS2C::message,
                ByteBufCodecs.VAR_LONG, FriendMessageS2C::timestamp,
                FriendMessageS2C::new
            );

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }
}
