package com.marsana.schematicfarm.schematic;

import java.util.List;

public record FarmTemplate(FarmType type, String description, List<SchematicBlock> blocks) {
    public int blockCount() {
        return blocks.size();
    }
}
