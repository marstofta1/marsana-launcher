package com.marsana.schematicfarm.schematic;

import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.material.Fluids;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SchematicScanner {
    private SchematicScanner() {}

    public static ScanResult scan(ClientLevel level, BlockPos anchor, FarmTemplate template) {
        if (level == null || anchor == null || template == null) {
            return new ScanResult(0, 0, List.of(), false);
        }

        Map<String, int[]> tallies = new LinkedHashMap<>();
        int placed = 0;

        for (SchematicBlock spec : template.blocks()) {
            BlockPos pos = anchor.offset(spec.x(), spec.y(), spec.z());
            Block expected = resolveBlock(spec.blockId());
            BlockState actual = level.getBlockState(pos);
            boolean ok = matches(expected, actual);
            tallies.computeIfAbsent(spec.blockId(), k -> new int[2]);
            tallies.get(spec.blockId())[0]++;
            if (ok) {
                tallies.get(spec.blockId())[1]++;
                placed++;
            }
        }

        List<BlockTypeProgress> rows = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : tallies.entrySet()) {
            String id = entry.getKey();
            rows.add(new BlockTypeProgress(
                id,
                displayName(id),
                entry.getValue()[0],
                entry.getValue()[1]
            ));
        }

        return new ScanResult(template.blockCount(), placed, rows, true);
    }

    private static Block resolveBlock(String blockId) {
        Identifier id = Identifier.tryParse(blockId);
        if (id == null) {
            return Blocks.AIR;
        }
        Block block = BuiltInRegistries.BLOCK.getValue(id);
        return block != null ? block : Blocks.AIR;
    }

    public static boolean matchesExpected(BlockState expected, BlockState actual) {
        if (expected == null) {
            return actual.isAir();
        }
        Block expectedBlock = expected.getBlock();
        return matches(expectedBlock, actual);
    }

    public static BlockState expectedState(String blockId) {
        return resolveBlock(blockId).defaultBlockState();
    }

    private static boolean matches(Block expected, BlockState actual) {
        if (expected == Blocks.AIR) {
            return actual.isAir();
        }
        if (expected == Blocks.WATER) {
            return actual.getFluidState().getType() == Fluids.WATER
                || actual.getFluidState().getType() == Fluids.FLOWING_WATER;
        }
        if (expected == Blocks.LAVA) {
            return actual.getFluidState().getType() == Fluids.LAVA
                || actual.getFluidState().getType() == Fluids.FLOWING_LAVA;
        }
        return actual.is(expected);
    }

    private static String displayName(String blockId) {
        Block block = resolveBlock(blockId);
        if (block == Blocks.AIR) {
            return blockId;
        }
        return block.getName().getString();
    }
}
