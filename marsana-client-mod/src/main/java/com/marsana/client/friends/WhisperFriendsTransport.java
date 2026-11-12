package com.marsana.client.friends;

import com.marsana.client.menu.FriendChatScreen;
import com.mojang.authlib.GameProfile;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.ChatType;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sunucuda Marsana modu yokken arkadaslik sistemini vanilla /msg (fisilti) uzerinden tasir.
 *
 * Her fisiltinin sonunda "[mf1:req|acc|dec|msg]" etiketi bulunur; karsidaki Marsana Client bu
 * fisiltiyi sohbetten gizleyip arkadaslik sistemine isler. Modu olmayan oyuncu fisiltiyi okunur
 * bir metin olarak gorur. Sinirlama: iki oyuncu ayni anda ayni sunucuda olmali ve sunucu /msg'ye
 * izin vermeli.
 */
public final class WhisperFriendsTransport {
    private WhisperFriendsTransport() {}

    /** Mesaj metni icin ust sinir: "msg <isim> " + etiket + metin, 256 karakterlik komut sinirina sigar. */
    public static final int MAX_MESSAGE_LENGTH = 200;

    private static final Pattern TOKEN = Pattern.compile("\\[mf1:(req|acc|dec|msg)\\]\\s?(.*)$", Pattern.DOTALL);
    private static final Pattern VALID_NAME = Pattern.compile("^[A-Za-z0-9_]{3,16}$");
    // Eklentili sunucularin (Essentials vb.) duz metin fisilti bicimleri.
    private static final Pattern[] SYSTEM_WHISPER_SENDER = {
        // Kaynak kodlamasindan bagimsiz kalsin diye ASCII disi karakterler kacisli: → = ok, » = cift ok.
        Pattern.compile("^\\[?([A-Za-z0-9_]{3,16}) ?(?:->|→|») ?(?:me|ben|sen|you)\\]?", Pattern.CASE_INSENSITIVE),
        Pattern.compile("^([A-Za-z0-9_]{3,16}) (?:whispers to you|sana fısıldıyor)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("^\\[?(?:From|Kimden) ([A-Za-z0-9_]{3,16})\\]?", Pattern.CASE_INSENSITIVE),
    };

    public static void register() {
        ClientReceiveMessageEvents.ALLOW_CHAT.register((message, signed, sender, params, receivedAt) -> {
            String text = signed != null ? signed.signedContent() : message.getString();
            Matcher m = TOKEN.matcher(text);
            if (!m.find()) {
                return true;
            }
            if (isSelf(sender) || params.chatType().is(ChatType.MSG_COMMAND_OUTGOING)) {
                return false; // kendi gonderdigimiz fisiltinin yankisi
            }
            if (!params.chatType().is(ChatType.MSG_COMMAND_INCOMING)) {
                return true; // genel sohbette etiket gecerse dokunma (taklit edilemesin)
            }
            String name = sender != null ? sender.name() : params.name().getString();
            UUID uuid = sender != null ? sender.id() : lookupUuid(name);
            Minecraft.getInstance().execute(() -> handle(m.group(1), m.group(2), name, uuid));
            return false;
        });

        ClientReceiveMessageEvents.ALLOW_GAME.register((message, overlay) -> {
            if (overlay) {
                return true;
            }
            String plain = message.getString();
            Matcher m = TOKEN.matcher(plain);
            if (!m.find()) {
                return true;
            }
            String name = systemWhisperSender(message, plain);
            if (name != null && !isSelfName(name)) {
                UUID uuid = lookupUuid(name);
                Minecraft.getInstance().execute(() -> handle(m.group(1), m.group(2), name, uuid));
            }
            // Gonderenini cozemedigimiz etiketli sistem mesaji buyuk olasilikla kendi yankimizdir; gizle.
            return false;
        });
    }

    // ---------------------------------------------------------------- gonderme

    public static boolean canUse() {
        Minecraft client = Minecraft.getInstance();
        return client.player != null && client.getConnection() != null;
    }

    public static boolean sendRequest(String targetName) {
        return whisper(targetName, "Marsana Client arkadaslik istegi gonderdi. [mf1:req]");
    }

    public static boolean sendReply(String requesterName, boolean accept) {
        return whisper(requesterName, accept
            ? "Arkadaslik istegini kabul etti. [mf1:acc]"
            : "Arkadaslik istegini reddetti. [mf1:dec]");
    }

    public static boolean sendMessage(String friendName, String text) {
        String clean = text.replace('\n', ' ').trim();
        if (clean.isEmpty() || clean.length() > MAX_MESSAGE_LENGTH || !isOnline(friendName)) {
            return false;
        }
        return whisper(friendName, "[mf1:msg] " + clean);
    }

    public static boolean isOnline(String name) {
        ClientPacketListener connection = Minecraft.getInstance().getConnection();
        return connection != null && name != null && connection.getPlayerInfoIgnoreCase(name) != null;
    }

    private static boolean whisper(String target, String body) {
        Minecraft client = Minecraft.getInstance();
        ClientPacketListener connection = client.getConnection();
        if (client.player == null || connection == null || target == null || !VALID_NAME.matcher(target).matches()) {
            return false;
        }
        connection.sendCommand("msg " + target + " " + body);
        return true;
    }

    // ---------------------------------------------------------------- alma

    private static void handle(String kind, String rest, String name, UUID uuid) {
        if (name == null || !VALID_NAME.matcher(name).matches()) {
            return;
        }
        Minecraft client = Minecraft.getInstance();
        switch (kind) {
            case "req" -> {
                if (FriendsManager.isFriendByName(name)) {
                    // Karsi taraf bizi silip yeniden istemis olabilir; otomatik kabul et.
                    sendReply(name, true);
                    return;
                }
                if (FriendsManager.hasOutgoingRequest(name)) {
                    // Iki taraf ayni anda istek atmis: ikisi de kabul sayilir.
                    FriendsManager.addFriend(uuid, name);
                    FriendsManager.removeOutgoingRequestByName(name);
                    sendReply(name, true);
                    notify(client, Component.literal(name + " ile artik arkadassiniz.").withStyle(ChatFormatting.GREEN));
                    return;
                }
                FriendsManager.addIncomingRequest(uuid, name);
                notify(client, Component.literal(
                    name + " sana arkadaslik istegi gonderdi. H > Arkadaslar > Istekler"
                ).withStyle(ChatFormatting.AQUA));
            }
            case "acc" -> {
                // Yalnizca gercekten istek attigimiz kisinin kabulu gecerli (sahte "kabul" ile eklenemez).
                if (!FriendsManager.hasOutgoingRequest(name)) {
                    return;
                }
                FriendsManager.removeOutgoingRequestByName(name);
                FriendsManager.addFriend(uuid, name);
                notify(client, Component.literal(name + " arkadaslik istegini kabul etti.").withStyle(ChatFormatting.GREEN));
            }
            case "dec" -> FriendsManager.removeOutgoingRequestByName(name);
            case "msg" -> {
                if (!FriendsManager.isFriendByName(name)) {
                    return; // arkadas olmayanlardan gelen etiketli mesajlari yok say
                }
                UUID friendUuid = friendUuidByName(name, uuid);
                String text = rest == null ? "" : rest.trim();
                if (text.isEmpty()) {
                    return;
                }
                FriendsManager.addIncomingMessage(friendUuid, name, text, System.currentTimeMillis());
                if (client.screen instanceof FriendChatScreen chat && chat.isChatWith(friendUuid)) {
                    chat.refreshMessages();
                } else {
                    notify(client, Component.literal(name + ": " + text).withStyle(ChatFormatting.YELLOW));
                }
            }
            default -> {
            }
        }
    }

    /** Sohbet gecmisi arkadas kaydindaki UUID'ye baglidir; ad eslesirse kayittaki UUID'yi kullan. */
    private static UUID friendUuidByName(String name, UUID fallback) {
        return FriendsManager.listFriends().stream()
            .filter(f -> f.name().equalsIgnoreCase(name))
            .map(FriendsManager.FriendEntry::uuid)
            .findFirst()
            .orElse(fallback);
    }

    private static String systemWhisperSender(Component message, String plain) {
        if (message.getContents() instanceof TranslatableContents tc
            && "commands.message.display.incoming".equals(tc.getKey())
            && tc.getArgs().length > 0) {
            Object arg = tc.getArgs()[0];
            String name = arg instanceof Component c ? c.getString() : String.valueOf(arg);
            return name.trim();
        }
        for (Pattern p : SYSTEM_WHISPER_SENDER) {
            Matcher m = p.matcher(plain.trim());
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static UUID lookupUuid(String name) {
        ClientPacketListener connection = Minecraft.getInstance().getConnection();
        if (connection != null && name != null) {
            PlayerInfo info = connection.getPlayerInfoIgnoreCase(name);
            if (info != null && info.getProfile() != null) {
                return info.getProfile().id();
            }
        }
        // Tab listesinde yoksa ada bagli kararli bir kimlik (cevrimdisi UUID bicimi).
        return UUID.nameUUIDFromBytes(("OfflinePlayer:" + name).getBytes(StandardCharsets.UTF_8));
    }

    private static boolean isSelf(GameProfile sender) {
        Minecraft client = Minecraft.getInstance();
        return sender != null && client.player != null && sender.id().equals(client.player.getUUID());
    }

    private static boolean isSelfName(String name) {
        Minecraft client = Minecraft.getInstance();
        return client.player != null && name.equalsIgnoreCase(client.player.getGameProfile().name());
    }

    private static void notify(Minecraft client, Component message) {
        if (client.player != null) {
            client.player.sendSystemMessage(message);
        }
    }
}
