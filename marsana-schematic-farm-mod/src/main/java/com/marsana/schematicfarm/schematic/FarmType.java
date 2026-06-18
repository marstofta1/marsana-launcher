package com.marsana.schematicfarm.schematic;

public enum FarmType {
    MOB_FARM("mob_farm", "Mob Farmi"),
    BAMBOO_FARM("bamboo_farm", "Bambu Farmi"),
    IRON_FARM("iron_farm", "Demir Farmi"),
    SUGAR_CANE_FARM("sugar_cane_farm", "Seker Kamisi Farmi");

    private final String id;
    private final String displayName;

    FarmType(String id, String displayName) {
        this.id = id;
        this.displayName = displayName;
    }

    public String id() {
        return id;
    }

    public String displayName() {
        return displayName;
    }

    public static FarmType fromId(String id) {
        if (id == null) {
            return MOB_FARM;
        }
        for (FarmType type : values()) {
            if (type.id.equals(id)) {
                return type;
            }
        }
        return MOB_FARM;
    }
}
