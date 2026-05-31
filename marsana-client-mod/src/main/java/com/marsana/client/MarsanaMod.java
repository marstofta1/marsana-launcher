package com.marsana.client;

import com.marsana.client.friends.FriendsNetworking;
import com.marsana.client.friends.FriendsServerNetworking;
import net.fabricmc.api.ModInitializer;

public class MarsanaMod implements ModInitializer {
    @Override
    public void onInitialize() {
        FriendsNetworking.registerPayloads();
        FriendsServerNetworking.register();
    }
}
