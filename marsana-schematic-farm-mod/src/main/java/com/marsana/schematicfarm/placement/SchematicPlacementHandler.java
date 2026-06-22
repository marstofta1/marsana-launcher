package com.marsana.schematicfarm.placement;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import com.marsana.schematicfarm.schematic.SchematicTargetFinder;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ServerboundUseItemOnPacket;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;

public final class SchematicPlacementHandler {
    private static final double REACH = 6.0;

    private SchematicPlacementHandler() {}

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (!SchematicConfigManager.isHologramsEnabled() || client.player == null) {
                SchematicTargetFinder.updateHighlight(client, 0);
                return;
            }
            SchematicTargetFinder.updateHighlight(client, REACH);
        });

        UseItemCallback.EVENT.register((player, world, hand) -> {
            if (!world.isClientSide() || !SchematicConfigManager.isHologramsEnabled()) {
                return InteractionResult.PASS;
            }
            Minecraft client = Minecraft.getInstance();
            if (!(player instanceof LocalPlayer localPlayer) || client.gameMode == null) {
                return InteractionResult.PASS;
            }

            BlockPos target = SchematicTargetFinder.findMissingBlockAtCrosshair(client, REACH);
            if (target == null) {
                target = SchematicTargetFinder.fromVanillaCrosshair(client);
            }
            if (target == null) {
                return InteractionResult.PASS;
            }

            BlockState expected = SchematicTargetFinder.expectedStateAt(client, target);
            if (expected == null || expected.isAir()) {
                return InteractionResult.PASS;
            }

            if (localPlayer.getAbilities().instabuild) {
                placeCreative(client, target, expected);
                return InteractionResult.SUCCESS;
            }

            return trySurvivalPlace(client, localPlayer, hand, target, expected);
        });
    }

    private static void placeCreative(Minecraft client, BlockPos target, BlockState expected) {
        if (client.getSingleplayerServer() != null) {
            client.getSingleplayerServer().execute(() -> {
                if (client.level != null) {
                    client.level.setBlockAndUpdate(target, expected);
                }
            });
            return;
        }
        client.execute(() -> {
            if (client.level != null) {
                client.level.setBlockAndUpdate(target, expected);
            }
        });
    }

    private static InteractionResult trySurvivalPlace(
        Minecraft client,
        LocalPlayer player,
        InteractionHand hand,
        BlockPos target,
        BlockState expected
    ) {
        ItemStack stack = player.getItemInHand(hand);
        if (stack.isEmpty() || !(stack.getItem() instanceof BlockItem)) {
            hint(player, expected);
            return InteractionResult.SUCCESS;
        }
        if (!stack.is(expected.getBlock().asItem())) {
            hint(player, expected);
            return InteractionResult.SUCCESS;
        }

        Direction face = Direction.UP;
        BlockPos against = target.below();
        if (client.level != null && client.level.getBlockState(against).isAir()) {
            face = Direction.DOWN;
            against = target.above();
        }

        BlockHitResult hit = new BlockHitResult(
            Vec3.atCenterOf(target),
            face,
            against,
            false
        );

        ClientPacketListener connection = client.getConnection();
        if (connection != null) {
            connection.send(new ServerboundUseItemOnPacket(hand, hit, 0));
            return InteractionResult.SUCCESS;
        }
        return InteractionResult.PASS;
    }

    private static void hint(LocalPlayer player, BlockState expected) {
        player.sendOverlayMessage(
            Component.literal("Sematik: ")
                .append(expected.getBlock().getName())
                .append(" gerekli (Yaratıcı modda havaya yerleştirilir)")
                .withStyle(ChatFormatting.YELLOW)
        );
    }
}
