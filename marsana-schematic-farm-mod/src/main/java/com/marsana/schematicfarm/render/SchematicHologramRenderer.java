package com.marsana.schematicfarm.render;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import com.marsana.schematicfarm.schematic.FarmTemplate;
import com.marsana.schematicfarm.schematic.FarmTemplateRegistry;
import com.marsana.schematicfarm.schematic.FarmType;
import com.marsana.schematicfarm.schematic.SchematicBlock;
import com.marsana.schematicfarm.schematic.SchematicScanner;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.fabricmc.fabric.api.client.rendering.v1.level.LevelRenderContext;
import net.fabricmc.fabric.api.client.rendering.v1.level.LevelRenderEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.ShapeRenderer;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.phys.shapes.Shapes;

public final class SchematicHologramRenderer {
    private static final int MAX_RENDER_DISTANCE_SQ = 96 * 96;

    private SchematicHologramRenderer() {}

    public static void register() {
        LevelRenderEvents.END_MAIN.register(SchematicHologramRenderer::render);
    }

    private static void render(LevelRenderContext context) {
        if (!SchematicConfigManager.isHologramsEnabled()) {
            return;
        }

        Minecraft client = Minecraft.getInstance();
        if (client.level == null || client.player == null) {
            return;
        }

        BlockPos anchor = SchematicConfigManager.getSchematicAnchor();
        if (anchor == null) {
            return;
        }

        String anchorDim = SchematicConfigManager.getSchematicAnchorDimension();
        String currentDim = String.valueOf(client.level.dimension());
        if (anchorDim != null && !anchorDim.equals(currentDim)) {
            return;
        }

        if (client.player.blockPosition().distSqr(anchor) > MAX_RENDER_DISTANCE_SQ) {
            return;
        }

        FarmType farmType = FarmType.fromId(SchematicConfigManager.getSchematicFarmId());
        FarmTemplate template = FarmTemplateRegistry.get(farmType);
        if (template.blocks().isEmpty()) {
            return;
        }

        Vec3 camera = context.levelState().cameraRenderState.pos;
        if (camera == null) {
            camera = client.gameRenderer.getMainCamera().position();
        }

        PoseStack poseStack = context.poseStack();
        MultiBufferSource.BufferSource bufferSource = context.bufferSource();
        VertexConsumer fillBuffer = bufferSource.getBuffer(RenderTypes.debugFilledBox());
        VertexConsumer lineBuffer = bufferSource.getBuffer(RenderTypes.lines());

        poseStack.pushPose();
        poseStack.translate(-camera.x, -camera.y, -camera.z);

        for (SchematicBlock spec : template.blocks()) {
            BlockPos pos = anchor.offset(spec.x(), spec.y(), spec.z());
            BlockState expected = SchematicScanner.expectedState(spec.blockId());
            BlockState actual = client.level.getBlockState(pos);
            boolean placed = SchematicScanner.matchesExpected(expected, actual);

            int fillColor = placed ? 0x5533FF88 : 0x66FF8844;
            int lineColor = placed ? 0xFF55FFAA : 0xFFFFAA55;

            ShapeRenderer.renderShape(
                poseStack,
                fillBuffer,
                Shapes.block(),
                pos.getX(),
                pos.getY(),
                pos.getZ(),
                fillColor,
                0.35f
            );
            ShapeRenderer.renderShape(
                poseStack,
                lineBuffer,
                Shapes.block(),
                pos.getX(),
                pos.getY(),
                pos.getZ(),
                lineColor,
                1.0f
            );
        }

        poseStack.popPose();
        bufferSource.endBatch(RenderTypes.debugFilledBox());
        bufferSource.endBatch(RenderTypes.lines());
    }
}
