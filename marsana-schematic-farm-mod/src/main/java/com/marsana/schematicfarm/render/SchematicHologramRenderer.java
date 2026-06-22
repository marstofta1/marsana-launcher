package com.marsana.schematicfarm.render;

import com.marsana.schematicfarm.config.SchematicConfigManager;
import com.marsana.schematicfarm.menu.SchematicFarmScreen;
import com.marsana.schematicfarm.schematic.FarmTemplate;
import com.marsana.schematicfarm.schematic.FarmTemplateRegistry;
import com.marsana.schematicfarm.schematic.FarmType;
import com.marsana.schematicfarm.schematic.SchematicBlock;
import com.marsana.schematicfarm.schematic.SchematicScanner;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.level.LevelRenderContext;
import net.fabricmc.fabric.api.client.rendering.v1.level.LevelRenderEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.renderer.OrderedSubmitNodeCollector;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.block.MovingBlockRenderState;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.util.LightCoordsUtil;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.phys.shapes.Shapes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SchematicHologramRenderer {
    private static final Logger LOGGER = LoggerFactory.getLogger("marsana-schematic-farm");
    private static final int MAX_RENDER_DISTANCE_SQ = 96 * 96;
    private static final int LABEL_DISTANCE_SQ = 64 * 64;
    private static final int MIN_STABLE_TICKS = 20;

    private static boolean pipelineRegistered;
    private static int stableWorldTicks;

    private SchematicHologramRenderer() {}

    public static void initPipeline() {
        if (pipelineRegistered) {
            return;
        }
        pipelineRegistered = true;
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player != null && client.level != null && !shouldHideForScreen(client.gui.screen())) {
                stableWorldTicks = Math.min(stableWorldTicks + 1, MIN_STABLE_TICKS + 1);
            } else if (client.level == null || client.player == null) {
                stableWorldTicks = 0;
            }
        });
        LevelRenderEvents.AFTER_TRANSLUCENT_TERRAIN.register(SchematicHologramRenderer::render);
    }

    public static void syncWithConfig() {
        initPipeline();
    }

    /** ESC envanteri vb. acikken gizle; normal oyun ve F8 sematik menusunde goster. */
    private static boolean shouldHideForScreen(Screen screen) {
        if (screen == null) {
            return false;
        }
        return !(screen instanceof SchematicFarmScreen);
    }

    private static void render(LevelRenderContext context) {
        if (!SchematicConfigManager.isHologramsEnabled()) {
            return;
        }
        if (stableWorldTicks < MIN_STABLE_TICKS) {
            return;
        }

        Minecraft client = Minecraft.getInstance();
        if (client.level == null || client.player == null || shouldHideForScreen(client.gui.screen())) {
            return;
        }

        BlockPos anchor = SchematicConfigManager.getSchematicAnchor();
        if (anchor == null) {
            return;
        }

        String anchorDim = SchematicConfigManager.getSchematicAnchorDimension();
        String currentDim = normalizeDimensionId(String.valueOf(client.level.dimension()));
        if (anchorDim != null && !normalizeDimensionId(anchorDim).equals(currentDim)) {
            return;
        }

        if (client.player.blockPosition().distSqr(anchor) > MAX_RENDER_DISTANCE_SQ) {
            return;
        }

        FarmType farmType = FarmType.fromId(SchematicConfigManager.getSchematicFarmId());
        FarmTemplate template = FarmTemplateRegistry.get(farmType);
        if (template == null || template.blocks().isEmpty()) {
            return;
        }

        try {
            Vec3 camera = resolveCamera(client, context);
            if (camera == null) {
                return;
            }

            var poseStack = context.poseStack();
            SubmitNodeCollector collector = context.submitNodeCollector();
            if (!(collector instanceof OrderedSubmitNodeCollector ordered)) {
                return;
            }

            CameraRenderState cameraState = context.levelState() != null
                ? context.levelState().cameraRenderState
                : null;

            BlockPos playerPos = client.player.blockPosition();

            poseStack.pushPose();
            poseStack.translate(-camera.x, -camera.y, -camera.z);

            for (SchematicBlock spec : template.blocks()) {
                BlockPos pos = anchor.offset(spec.x(), spec.y(), spec.z());
                if (!client.level.hasChunkAt(pos)) {
                    continue;
                }
                BlockState expected = SchematicScanner.expectedState(spec.blockId());
                if (expected.getRenderShape() == RenderShape.INVISIBLE) {
                    continue;
                }
                BlockState actual = client.level.getBlockState(pos);
                boolean placed = SchematicScanner.matchesExpected(expected, actual);
                int typeColor = blockTypeColor(spec.blockId());

                poseStack.pushPose();
                poseStack.translate(pos.getX(), pos.getY(), pos.getZ());

                if (!placed) {
                    MovingBlockRenderState ghost = ghostState(client, pos, expected);
                    ordered.submitMovingBlock(poseStack, ghost, typeColor | 0x99000000);

                    ordered.submitShapeOutline(
                        poseStack,
                        Shapes.block(),
                        RenderTypes.lines(),
                        typeColor | 0xFF000000,
                        1.4f,
                        false
                    );

                    if (playerPos.distSqr(pos) <= LABEL_DISTANCE_SQ && cameraState != null) {
                        String label = expected.getBlock().getName().getString();
                        ordered.submitNameTag(
                            poseStack,
                            new Vec3(0.5, 0.92, 0.5),
                            0,
                            Component.literal(label),
                            true,
                            LightCoordsUtil.FULL_BRIGHT,
                            cameraState
                        );
                    }
                } else {
                    ordered.submitShapeOutline(
                        poseStack,
                        Shapes.block(),
                        RenderTypes.lines(),
                        0xFF55FFAA,
                        1.0f,
                        false
                    );
                }

                poseStack.popPose();
            }

            poseStack.popPose();
        } catch (Throwable e) {
            LOGGER.warn("Sematik hologram cizilemedi — hologram kapatildi", e);
            SchematicConfigManager.setHologramsEnabled(false);
        }
    }

    /** Her blok turu icin ayirt edici renk (eksik blok cizimi). */
    private static int blockTypeColor(String blockId) {
        int hash = blockId.hashCode();
        int r = 160 + (hash & 0x5F);
        int g = 120 + ((hash >> 7) & 0x5F);
        int b = 90 + ((hash >> 14) & 0x5F);
        return (r << 16) | (g << 8) | b;
    }

    private static MovingBlockRenderState ghostState(Minecraft client, BlockPos worldPos, BlockState state) {
        MovingBlockRenderState ghost = new MovingBlockRenderState();
        ghost.blockPos = BlockPos.ZERO;
        ghost.randomSeedPos = worldPos;
        ghost.blockState = state;
        ghost.biome = client.level.getBiome(worldPos);
        ghost.lightEngine = client.level.getLightEngine();
        ghost.cardinalLighting = client.level.cardinalLighting();
        return ghost;
    }

    private static String normalizeDimensionId(String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw.trim();
        int bracket = s.indexOf("location=");
        if (bracket >= 0) {
            s = s.substring(bracket + "location=".length());
            int end = s.indexOf(']');
            if (end >= 0) {
                s = s.substring(0, end);
            }
        }
        return s.replace("ResourceKey[minecraft:", "").replace("]", "");
    }

    private static Vec3 resolveCamera(Minecraft client, LevelRenderContext context) {
        Vec3 fallback = client.gameRenderer.mainCamera().position();
        try {
            var levelState = context.levelState();
            if (levelState != null
                && levelState.cameraRenderState != null
                && levelState.cameraRenderState.pos != null) {
                return levelState.cameraRenderState.pos;
            }
        } catch (Exception ignored) {
            // render durumu hazir degilse guvenli kamera
        }
        return fallback;
    }
}
