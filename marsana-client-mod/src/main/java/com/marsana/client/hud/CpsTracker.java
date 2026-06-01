package com.marsana.client.hud;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayDeque;
import java.util.Deque;

public final class CpsTracker {
    private static final Deque<Long> LEFT_CLICKS = new ArrayDeque<>();
    private static final Deque<Long> RIGHT_CLICKS = new ArrayDeque<>();
    private static boolean leftWasDown;
    private static boolean rightWasDown;

    private CpsTracker() {}

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(CpsTracker::onTick);
    }

    private static void onTick(Minecraft client) {
        if (client.player == null || client.screen != null) {
            leftWasDown = false;
            rightWasDown = false;
            return;
        }
        long now = System.currentTimeMillis();
        trimOld(now);

        boolean leftDown = client.options.keyAttack.isDown();
        boolean rightDown = client.options.keyUse.isDown();
        long window = client.getWindow().handle();
        if (!leftDown) {
            leftDown = GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
        }
        if (!rightDown) {
            rightDown = GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
        }

        if (leftDown && !leftWasDown) {
            LEFT_CLICKS.addLast(now);
        }
        if (rightDown && !rightWasDown) {
            RIGHT_CLICKS.addLast(now);
        }
        leftWasDown = leftDown;
        rightWasDown = rightDown;
    }

    private static void trimOld(long now) {
        while (!LEFT_CLICKS.isEmpty() && now - LEFT_CLICKS.peekFirst() > 1000L) {
            LEFT_CLICKS.removeFirst();
        }
        while (!RIGHT_CLICKS.isEmpty() && now - RIGHT_CLICKS.peekFirst() > 1000L) {
            RIGHT_CLICKS.removeFirst();
        }
    }

    public static int leftCps() {
        trimOld(System.currentTimeMillis());
        return LEFT_CLICKS.size();
    }

    public static int rightCps() {
        trimOld(System.currentTimeMillis());
        return RIGHT_CLICKS.size();
    }
}
