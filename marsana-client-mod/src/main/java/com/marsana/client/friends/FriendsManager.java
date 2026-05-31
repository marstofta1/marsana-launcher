package com.marsana.client.friends;

import com.marsana.client.config.MarsanaConfigManager;
import com.marsana.client.config.MarsanaConfigManager.FriendRecord;
import com.marsana.client.config.MarsanaConfigManager.ChatMessageRecord;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class FriendsManager {
    private FriendsManager() {}

    public record FriendEntry(UUID uuid, String name) {}

    public record FriendRequest(UUID uuid, String name) {}

    public record ChatMessage(UUID fromUuid, String fromName, String text, long timestamp, boolean outgoing) {}

    public static List<FriendEntry> listFriends() {
        return MarsanaConfigManager.get().friends.stream()
            .map(r -> new FriendEntry(parseUuid(r.uuid), r.name))
            .sorted(Comparator.comparing(FriendEntry::name, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    public static List<FriendRequest> listIncomingRequests() {
        return MarsanaConfigManager.get().incomingRequests.stream()
            .map(r -> new FriendRequest(parseUuid(r.uuid), r.name))
            .toList();
    }

    public static List<FriendRequest> listOutgoingRequests() {
        return MarsanaConfigManager.get().outgoingRequests.stream()
            .map(r -> new FriendRequest(parseUuid(r.uuid), r.name))
            .toList();
    }

    public static int pendingRequestCount() {
        return MarsanaConfigManager.get().incomingRequests.size();
    }

    public static boolean isFriend(UUID uuid) {
        return MarsanaConfigManager.get().friends.stream()
            .anyMatch(f -> parseUuid(f.uuid).equals(uuid));
    }

    public static boolean isFriendByName(String name) {
        return MarsanaConfigManager.get().friends.stream()
            .anyMatch(f -> f.name.equalsIgnoreCase(name));
    }

    public static boolean hasOutgoingRequest(String name) {
        return MarsanaConfigManager.get().outgoingRequests.stream()
            .anyMatch(r -> r.name.equalsIgnoreCase(name));
    }

    public static void addFriend(UUID uuid, String name) {
        if (isFriend(uuid)) {
            return;
        }
        FriendRecord record = new FriendRecord();
        record.uuid = uuid.toString();
        record.name = name;
        MarsanaConfigManager.get().friends.add(record);
        MarsanaConfigManager.save();
    }

    public static void removeFriend(UUID uuid) {
        MarsanaConfigManager.get().friends.removeIf(f -> parseUuid(f.uuid).equals(uuid));
        MarsanaConfigManager.get().chatHistory.remove(uuid.toString());
        MarsanaConfigManager.save();
    }

    public static void addIncomingRequest(UUID uuid, String name) {
        if (isFriend(uuid)) {
            return;
        }
        var requests = MarsanaConfigManager.get().incomingRequests;
        if (requests.stream().anyMatch(r -> parseUuid(r.uuid).equals(uuid))) {
            return;
        }
        FriendRecord record = new FriendRecord();
        record.uuid = uuid.toString();
        record.name = name;
        requests.add(record);
        MarsanaConfigManager.save();
    }

    public static void removeIncomingRequest(UUID uuid) {
        MarsanaConfigManager.get().incomingRequests.removeIf(r -> parseUuid(r.uuid).equals(uuid));
        MarsanaConfigManager.save();
    }

    public static void addOutgoingRequestByName(String name) {
        if (hasOutgoingRequest(name) || isFriendByName(name)) {
            return;
        }
        FriendRecord record = new FriendRecord();
        record.uuid = "pending:" + name.toLowerCase();
        record.name = name;
        MarsanaConfigManager.get().outgoingRequests.add(record);
        MarsanaConfigManager.save();
    }

    public static void removeOutgoingRequest(UUID uuid) {
        MarsanaConfigManager.get().outgoingRequests.removeIf(r -> {
            if (r.uuid.startsWith("pending:")) {
                return false;
            }
            return parseUuid(r.uuid).equals(uuid);
        });
        MarsanaConfigManager.save();
    }

    public static void removeOutgoingRequestByName(String name) {
        MarsanaConfigManager.get().outgoingRequests.removeIf(r -> r.name.equalsIgnoreCase(name));
        MarsanaConfigManager.save();
    }

    public static void addIncomingMessage(UUID fromUuid, String fromName, String text, long timestamp) {
        addMessage(fromUuid, fromName, text, timestamp, false);
    }

    public static void addOutgoingMessage(UUID toUuid, String toName, String text) {
        long now = System.currentTimeMillis();
        addMessage(toUuid, toName, text, now, true);
    }

    private static void addMessage(UUID friendUuid, String friendName, String text, long timestamp, boolean outgoing) {
        String key = friendUuid.toString();
        Map<String, List<ChatMessageRecord>> history = MarsanaConfigManager.get().chatHistory;
        List<ChatMessageRecord> messages = history.computeIfAbsent(key, k -> new ArrayList<>());

        ChatMessageRecord record = new ChatMessageRecord();
        record.fromUuid = outgoing ? MarsanaConfigManager.localPlayerUuid() : friendUuid.toString();
        record.fromName = outgoing ? "Sen" : friendName;
        record.text = text;
        record.timestamp = timestamp;
        record.outgoing = outgoing;
        messages.add(record);

        if (messages.size() > 100) {
            messages.subList(0, messages.size() - 100).clear();
        }
        MarsanaConfigManager.save();
    }

    public static List<ChatMessage> getChatHistory(UUID friendUuid) {
        List<ChatMessageRecord> stored = MarsanaConfigManager.get().chatHistory.get(friendUuid.toString());
        if (stored == null) {
            return List.of();
        }
        return stored.stream()
            .map(r -> new ChatMessage(
                parseUuid(r.fromUuid),
                r.fromName,
                r.text,
                r.timestamp,
                r.outgoing
            ))
            .toList();
    }

    public static String getFriendName(UUID uuid) {
        return MarsanaConfigManager.get().friends.stream()
            .filter(f -> parseUuid(f.uuid).equals(uuid))
            .map(f -> f.name)
            .findFirst()
            .orElse("?");
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.startsWith("pending:")) {
            return new UUID(0, 0);
        }
        return UUID.fromString(raw);
    }
}
