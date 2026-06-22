package com.marsana.schematicfarm.schematic;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

import java.util.Optional;

public final class SchematicTargetFinder {
    private static BlockPos highlightedTarget;

    private SchematicTargetFinder() {}

    public static BlockPos getHighlightedTarget() {
        return highlightedTarget;
    }

    public static void updateHighlight(Minecraft client, double maxReach) {
        highlightedTarget = findMissingBlockAtCrosshair(client, maxReach);
    }

    public static BlockPos findMissingBlockAtCrosshair(Minecraft client, double maxReach) {
        if (client.player == null || client.level == null) {
            return null;
        }
        BlockPos anchor = SchematicConfigManager.getSchematicAnchor();
        if (anchor == null) {
            return null;
        }
        String anchorDim = SchematicConfigManager.getSchematicAnchorDimension();
        String currentDim = SchematicConfigManager.normalizeDimensionId(String.valueOf(client.level.dimension()));
        if (anchorDim != null && !currentDim.equals(SchematicConfigManager.normalizeDimensionId(anchorDim))) {
            return null;
        }

        FarmTemplate template = FarmTemplateRegistry.get(FarmType.fromId(SchematicConfigManager.getSchematicFarmId()));
        if (template == null) {
            return null;
        }

        Vec3 eye = client.player.getEyePosition();
        Vec3 end = eye.add(client.player.getViewVector(1.0f).scale(maxReach));

        BlockPos best = null;
        double bestDist = maxReach + 1.0;

        for (SchematicBlock spec : template.blocks()) {
            BlockPos pos = anchor.offset(spec.x(), spec.y(), spec.z());
            if (!client.level.hasChunkAt(pos)) {
                continue;
            }
            BlockState expected = SchematicScanner.expectedState(spec.blockId());
            BlockState actual = client.level.getBlockState(pos);
            if (SchematicScanner.matchesExpected(expected, actual)) {
                continue;
            }

            Optional<Vec3> clip = new AABB(pos).clip(eye, end);
            if (clip.isEmpty()) {
                continue;
            }
            double dist = eye.distanceTo(clip.get());
            if (dist < bestDist) {
                bestDist = dist;
                best = pos;
            }
        }
        return best;
    }

    public static BlockState expectedStateAt(Minecraft client, BlockPos worldPos) {
        BlockPos anchor = SchematicConfigManager.getSchematicAnchor();
        if (anchor == null || client.level == null) {
            return null;
        }
        BlockPos rel = worldPos.subtract(anchor);
        FarmTemplate template = FarmTemplateRegistry.get(FarmType.fromId(SchematicConfigManager.getSchematicFarmId()));
        if (template == null) {
            return null;
        }
        for (SchematicBlock spec : template.blocks()) {
            if (spec.x() == rel.getX() && spec.y() == rel.getY() && spec.z() == rel.getZ()) {
                return SchematicScanner.expectedState(spec.blockId());
            }
        }
        return null;
    }

    public static BlockPos fromVanillaCrosshair(Minecraft client) {
        HitResult hit = client.hitResult;
        if (!(hit instanceof BlockHitResult blockHit) || hit.getType() != HitResult.Type.BLOCK) {
            return null;
        }
        BlockPos pos = blockHit.getBlockPos();
        BlockState expected = expectedStateAt(client, pos);
        if (expected == null) {
            return null;
        }
        BlockState actual = client.level.getBlockState(pos);
        return SchematicScanner.matchesExpected(expected, actual) ? null : pos;
    }
}
