package com.marsana.schematicfarm.schematic;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public final class FarmTemplateRegistry {
    private static final Map<FarmType, FarmTemplate> TEMPLATES = new EnumMap<>(FarmType.class);

    static {
        TEMPLATES.put(FarmType.MOB_FARM, buildMobFarm());
        TEMPLATES.put(FarmType.BAMBOO_FARM, buildBambooFarm());
        TEMPLATES.put(FarmType.IRON_FARM, buildIronFarm());
        TEMPLATES.put(FarmType.SUGAR_CANE_FARM, buildSugarCaneFarm());
    }

    private FarmTemplateRegistry() {}

    public static FarmTemplate get(FarmType type) {
        return TEMPLATES.get(type);
    }

    public static FarmTemplate getById(String id) {
        return get(FarmType.fromId(id));
    }

    public static FarmType[] allTypes() {
        return FarmType.values();
    }

    /** 9x9 karanlik oda + su kanali + toplama noktasi. */
    private static FarmTemplate buildMobFarm() {
        List<SchematicBlock> blocks = new ArrayList<>();
        for (int x = -4; x <= 4; x++) {
            for (int z = -4; z <= 4; z++) {
                blocks.add(new SchematicBlock(x, 0, z, "minecraft:cobblestone"));
                if (Math.abs(x) == 4 || Math.abs(z) == 4) {
                    blocks.add(new SchematicBlock(x, 1, z, "minecraft:cobblestone"));
                    blocks.add(new SchematicBlock(x, 2, z, "minecraft:cobblestone"));
                }
            }
        }
        blocks.add(new SchematicBlock(0, 1, 0, "minecraft:water"));
        blocks.add(new SchematicBlock(1, 1, 0, "minecraft:water"));
        blocks.add(new SchematicBlock(-1, 1, 0, "minecraft:hopper"));
        blocks.add(new SchematicBlock(-1, 0, 0, "minecraft:chest"));
        blocks.add(new SchematicBlock(2, 2, 2, "minecraft:torch"));
        blocks.add(new SchematicBlock(-2, 2, 2, "minecraft:torch"));
        blocks.add(new SchematicBlock(2, 2, -2, "minecraft:torch"));
        blocks.add(new SchematicBlock(-2, 2, -2, "minecraft:torch"));
        blocks.add(new SchematicBlock(0, 3, 0, "minecraft:spawner"));
        return new FarmTemplate(
            FarmType.MOB_FARM,
            "Karanlik oda mob farmi — spawner, su kanali ve sandik.",
            List.copyOf(blocks)
        );
    }

    /** Gozlemci + piston + bambu hatti. */
    private static FarmTemplate buildBambooFarm() {
        List<SchematicBlock> blocks = new ArrayList<>();
        for (int z = 0; z < 5; z++) {
            blocks.add(new SchematicBlock(0, 0, z, "minecraft:grass_block"));
            blocks.add(new SchematicBlock(0, 1, z, "minecraft:bamboo"));
            blocks.add(new SchematicBlock(0, 2, z, "minecraft:bamboo"));
            blocks.add(new SchematicBlock(1, 0, z, "minecraft:observer"));
            blocks.add(new SchematicBlock(2, 0, z, "minecraft:piston"));
        }
        blocks.add(new SchematicBlock(-1, 0, 2, "minecraft:hopper"));
        blocks.add(new SchematicBlock(-1, 0, 1, "minecraft:chest"));
        blocks.add(new SchematicBlock(0, 0, -1, "minecraft:redstone"));
        return new FarmTemplate(
            FarmType.BAMBOO_FARM,
            "Otomatik bambu farmi — piston, gozlemci ve toplama.",
            List.copyOf(blocks)
        );
    }

    /** Basitlestirilmis golem demir farmi cekirdegi. */
    private static FarmTemplate buildIronFarm() {
        List<SchematicBlock> blocks = new ArrayList<>();
        for (int x = -2; x <= 2; x++) {
            for (int z = -2; z <= 2; z++) {
                blocks.add(new SchematicBlock(x, 0, z, "minecraft:stone"));
            }
        }
        blocks.add(new SchematicBlock(0, 1, 0, "minecraft:bed"));
        blocks.add(new SchematicBlock(2, 1, 0, "minecraft:oak_door"));
        blocks.add(new SchematicBlock(-2, 1, 0, "minecraft:oak_door"));
        blocks.add(new SchematicBlock(0, 1, 2, "minecraft:oak_door"));
        blocks.add(new SchematicBlock(0, 1, -2, "minecraft:oak_door"));
        blocks.add(new SchematicBlock(1, 1, 1, "minecraft:water"));
        blocks.add(new SchematicBlock(-1, 1, -1, "minecraft:water"));
        blocks.add(new SchematicBlock(0, 2, 0, "minecraft:lava"));
        blocks.add(new SchematicBlock(0, 0, 3, "minecraft:hopper"));
        blocks.add(new SchematicBlock(0, 0, 4, "minecraft:chest"));
        for (int y = 1; y <= 3; y++) {
            blocks.add(new SchematicBlock(3, y, 0, "minecraft:glass"));
            blocks.add(new SchematicBlock(-3, y, 0, "minecraft:glass"));
        }
        blocks.add(new SchematicBlock(0, 3, 3, "minecraft:torch"));
        return new FarmTemplate(
            FarmType.IRON_FARM,
            "Demir golem farmi — yatak, kapilar, su/lava ve toplama.",
            List.copyOf(blocks)
        );
    }

    /** Su + kum + seker kamisi satirlari. */
    private static FarmTemplate buildSugarCaneFarm() {
        List<SchematicBlock> blocks = new ArrayList<>();
        for (int z = 0; z < 8; z++) {
            blocks.add(new SchematicBlock(0, 0, z, "minecraft:water"));
            blocks.add(new SchematicBlock(1, 0, z, "minecraft:sand"));
            blocks.add(new SchematicBlock(1, 1, z, "minecraft:sugar_cane"));
            blocks.add(new SchematicBlock(1, 2, z, "minecraft:sugar_cane"));
            blocks.add(new SchematicBlock(2, 0, z, "minecraft:sand"));
            blocks.add(new SchematicBlock(2, 1, z, "minecraft:sugar_cane"));
            blocks.add(new SchematicBlock(2, 2, z, "minecraft:sugar_cane"));
        }
        blocks.add(new SchematicBlock(3, 0, 3, "minecraft:hopper"));
        blocks.add(new SchematicBlock(3, 0, 2, "minecraft:chest"));
        return new FarmTemplate(
            FarmType.SUGAR_CANE_FARM,
            "Seker kamisi farmi — su, kum ve 2 blok yukseklikte kamis.",
            List.copyOf(blocks)
        );
    }
}
