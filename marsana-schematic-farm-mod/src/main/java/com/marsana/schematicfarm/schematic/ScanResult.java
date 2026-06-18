package com.marsana.schematicfarm.schematic;

import java.util.List;

public record ScanResult(
    int totalExpected,
    int totalPlaced,
    List<BlockTypeProgress> byType,
    boolean anchorSet
) {
    public int totalMissing() {
        return Math.max(0, totalExpected - totalPlaced);
    }

    public int totalPercent() {
        if (totalExpected <= 0) {
            return 100;
        }
        return Math.min(100, (totalPlaced * 100) / totalExpected);
    }
}
