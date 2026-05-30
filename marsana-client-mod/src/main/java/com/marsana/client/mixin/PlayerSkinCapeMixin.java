package com.marsana.client.mixin;

import com.marsana.client.cosmetics.CosmeticsManager;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.core.ClientAsset;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayer.class)
public abstract class PlayerSkinCapeMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void marsana$applyCosmeticCape(CallbackInfoReturnable<PlayerSkin> cir) {
        AbstractClientPlayer self = (AbstractClientPlayer) (Object) this;
        Minecraft client = Minecraft.getInstance();
        if (client == null || client.player == null || !self.getUUID().equals(client.player.getUUID())) {
            return;
        }

        CosmeticsManager.ensureTexturesReady();
        ClientAsset.ResourceTexture cape = CosmeticsManager.getCapeTextureForCurrentPlayer();
        if (cape == null) {
            return;
        }

        PlayerSkin original = cir.getReturnValue();
        cir.setReturnValue(new PlayerSkin(
            original.body(),
            cape,
            original.elytra(),
            original.model(),
            original.secure()
        ));
    }
}
