# Üretilmiş dosya — elle düzenleme yerine scripts/gen-lobby-structure.js'i güncelle.
# Alanı temizle, temel ve zemin
fill ~-17 ~ ~-17 ~17 ~15 ~17 minecraft:air
fill ~-16 ~-6 ~-16 ~16 ~-2 ~16 minecraft:stone_bricks
fill ~-16 ~-1 ~-16 ~16 ~-1 ~16 create:polished_cut_andesite
# Kapılara giden yollar ve merkez madalyonu (doğuş noktası)
fill ~-1 ~-1 ~-16 ~1 ~-1 ~16 create:cut_andesite_bricks
fill ~-16 ~-1 ~-1 ~16 ~-1 ~1 create:cut_andesite_bricks
fill ~-4 ~-1 ~-4 ~4 ~-1 ~4 minecraft:waxed_cut_copper
fill ~-3 ~-1 ~-3 ~3 ~-1 ~3 create:polished_cut_andesite
fill ~-1 ~-1 ~-1 ~1 ~-1 ~1 create:brass_block
# Duvarlar, pencereler ve üst kenar
fill ~-15 ~ ~-15 ~15 ~4 ~-15 create:cut_andesite_bricks
fill ~-15 ~ ~15 ~15 ~4 ~15 create:cut_andesite_bricks
fill ~-15 ~ ~-15 ~-15 ~4 ~15 create:cut_andesite_bricks
fill ~15 ~ ~-15 ~15 ~4 ~15 create:cut_andesite_bricks
fill ~-13 ~1 ~-15 ~-11 ~3 ~-15 create:framed_glass
fill ~-13 ~1 ~15 ~-11 ~3 ~15 create:framed_glass
fill ~-15 ~1 ~-13 ~-15 ~3 ~-11 create:framed_glass
fill ~15 ~1 ~-13 ~15 ~3 ~-11 create:framed_glass
fill ~-9 ~1 ~-15 ~-6 ~3 ~-15 create:framed_glass
fill ~-9 ~1 ~15 ~-6 ~3 ~15 create:framed_glass
fill ~-15 ~1 ~-9 ~-15 ~3 ~-6 create:framed_glass
fill ~15 ~1 ~-9 ~15 ~3 ~-6 create:framed_glass
fill ~6 ~1 ~-15 ~9 ~3 ~-15 create:framed_glass
fill ~6 ~1 ~15 ~9 ~3 ~15 create:framed_glass
fill ~-15 ~1 ~6 ~-15 ~3 ~9 create:framed_glass
fill ~15 ~1 ~6 ~15 ~3 ~9 create:framed_glass
fill ~11 ~1 ~-15 ~13 ~3 ~-15 create:framed_glass
fill ~11 ~1 ~15 ~13 ~3 ~15 create:framed_glass
fill ~-15 ~1 ~11 ~-15 ~3 ~13 create:framed_glass
fill ~15 ~1 ~11 ~15 ~3 ~13 create:framed_glass
fill ~-15 ~5 ~-15 ~15 ~5 ~-15 create:cut_andesite_slab
fill ~-15 ~5 ~15 ~15 ~5 ~15 create:cut_andesite_slab
fill ~-15 ~5 ~-15 ~-15 ~5 ~15 create:cut_andesite_slab
fill ~15 ~5 ~-15 ~15 ~5 ~15 create:cut_andesite_slab
# Sütunlar ve üstlerinde fenerler
fill ~-10 ~ ~-15 ~-10 ~5 ~-15 create:andesite_casing
fill ~-10 ~ ~15 ~-10 ~5 ~15 create:andesite_casing
fill ~-15 ~ ~-10 ~-15 ~5 ~-10 create:andesite_casing
fill ~15 ~ ~-10 ~15 ~5 ~-10 create:andesite_casing
setblock ~-10 ~6 ~-15 minecraft:lantern
setblock ~-10 ~6 ~15 minecraft:lantern
setblock ~-15 ~6 ~-10 minecraft:lantern
setblock ~15 ~6 ~-10 minecraft:lantern
fill ~-5 ~ ~-15 ~-5 ~5 ~-15 create:andesite_casing
fill ~-5 ~ ~15 ~-5 ~5 ~15 create:andesite_casing
fill ~-15 ~ ~-5 ~-15 ~5 ~-5 create:andesite_casing
fill ~15 ~ ~-5 ~15 ~5 ~-5 create:andesite_casing
setblock ~-5 ~6 ~-15 minecraft:lantern
setblock ~-5 ~6 ~15 minecraft:lantern
setblock ~-15 ~6 ~-5 minecraft:lantern
setblock ~15 ~6 ~-5 minecraft:lantern
fill ~5 ~ ~-15 ~5 ~5 ~-15 create:andesite_casing
fill ~5 ~ ~15 ~5 ~5 ~15 create:andesite_casing
fill ~-15 ~ ~5 ~-15 ~5 ~5 create:andesite_casing
fill ~15 ~ ~5 ~15 ~5 ~5 create:andesite_casing
setblock ~5 ~6 ~-15 minecraft:lantern
setblock ~5 ~6 ~15 minecraft:lantern
setblock ~-15 ~6 ~5 minecraft:lantern
setblock ~15 ~6 ~5 minecraft:lantern
fill ~10 ~ ~-15 ~10 ~5 ~-15 create:andesite_casing
fill ~10 ~ ~15 ~10 ~5 ~15 create:andesite_casing
fill ~-15 ~ ~10 ~-15 ~5 ~10 create:andesite_casing
fill ~15 ~ ~10 ~15 ~5 ~10 create:andesite_casing
setblock ~10 ~6 ~-15 minecraft:lantern
setblock ~10 ~6 ~15 minecraft:lantern
setblock ~-15 ~6 ~10 minecraft:lantern
setblock ~15 ~6 ~10 minecraft:lantern
# Kapılar (pirinç çerçeve, 3 geniş x 3 yüksek)
fill ~-2 ~ ~-15 ~2 ~4 ~-15 create:brass_casing
fill ~-2 ~ ~15 ~2 ~4 ~15 create:brass_casing
fill ~-15 ~ ~-2 ~-15 ~4 ~2 create:brass_casing
fill ~15 ~ ~-2 ~15 ~4 ~2 create:brass_casing
fill ~-1 ~ ~-15 ~1 ~2 ~-15 minecraft:air
fill ~-1 ~ ~15 ~1 ~2 ~15 minecraft:air
fill ~-15 ~ ~-1 ~-15 ~2 ~1 minecraft:air
fill ~15 ~ ~-1 ~15 ~2 ~1 minecraft:air
# Köşe kuleleri
fill ~-14 ~ ~-14 ~-16 ~7 ~-16 create:andesite_casing
fill ~-14 ~4 ~-14 ~-16 ~4 ~-16 create:copper_casing
setblock ~-15 ~8 ~-15 minecraft:lantern
fill ~-14 ~ ~14 ~-16 ~7 ~16 create:andesite_casing
fill ~-14 ~4 ~14 ~-16 ~4 ~16 create:copper_casing
setblock ~-15 ~8 ~15 minecraft:lantern
fill ~14 ~ ~-14 ~16 ~7 ~-16 create:andesite_casing
fill ~14 ~4 ~-14 ~16 ~4 ~-16 create:copper_casing
setblock ~15 ~8 ~-15 minecraft:lantern
fill ~14 ~ ~14 ~16 ~7 ~16 create:andesite_casing
fill ~14 ~4 ~14 ~16 ~4 ~16 create:copper_casing
setblock ~15 ~8 ~15 minecraft:lantern
# Fener direkleri
fill ~-4 ~ ~-4 ~-4 ~2 ~-4 create:cut_andesite_wall
setblock ~-4 ~3 ~-4 minecraft:lantern
fill ~-4 ~ ~4 ~-4 ~2 ~4 create:cut_andesite_wall
setblock ~-4 ~3 ~4 minecraft:lantern
fill ~4 ~ ~-4 ~4 ~2 ~-4 create:cut_andesite_wall
setblock ~4 ~3 ~-4 minecraft:lantern
fill ~4 ~ ~4 ~4 ~2 ~4 create:cut_andesite_wall
setblock ~4 ~3 ~4 minecraft:lantern
fill ~-2 ~ ~-9 ~-2 ~2 ~-9 create:cut_andesite_wall
setblock ~-2 ~3 ~-9 minecraft:lantern
fill ~-2 ~ ~9 ~-2 ~2 ~9 create:cut_andesite_wall
setblock ~-2 ~3 ~9 minecraft:lantern
fill ~2 ~ ~-9 ~2 ~2 ~-9 create:cut_andesite_wall
setblock ~2 ~3 ~-9 minecraft:lantern
fill ~2 ~ ~9 ~2 ~2 ~9 create:cut_andesite_wall
setblock ~2 ~3 ~9 minecraft:lantern
fill ~-9 ~ ~-2 ~-9 ~2 ~-2 create:cut_andesite_wall
setblock ~-9 ~3 ~-2 minecraft:lantern
fill ~-9 ~ ~2 ~-9 ~2 ~2 create:cut_andesite_wall
setblock ~-9 ~3 ~2 minecraft:lantern
fill ~9 ~ ~-2 ~9 ~2 ~-2 create:cut_andesite_wall
setblock ~9 ~3 ~-2 minecraft:lantern
fill ~9 ~ ~2 ~9 ~2 ~2 create:cut_andesite_wall
setblock ~9 ~3 ~2 minecraft:lantern
# İç köşelerde saksılar
fill ~-10 ~-1 ~-10 ~-12 ~-1 ~-12 minecraft:moss_block
setblock ~-11 ~ ~-11 minecraft:flowering_azalea
fill ~-10 ~-1 ~10 ~-12 ~-1 ~12 minecraft:moss_block
setblock ~-11 ~ ~11 minecraft:flowering_azalea
fill ~10 ~-1 ~-10 ~12 ~-1 ~-12 minecraft:moss_block
setblock ~11 ~ ~-11 minecraft:flowering_azalea
fill ~10 ~-1 ~10 ~12 ~-1 ~12 minecraft:moss_block
setblock ~11 ~ ~11 minecraft:flowering_azalea
