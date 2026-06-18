package com.marsana.schematicfarm.schematic;

public record BlockTypeProgress(
    String blockId,
    String displayName,
    int expected,
    int placed
) {
    public int missing() {
        return Math.max(0, expected - placed);
    }
}
