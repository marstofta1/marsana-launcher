import UIKit
import Capacitor

@objc(MarsanaLauncherPlugin)
public class MarsanaLauncherPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MarsanaLauncherPlugin"
    public let jsName = "MarsanaLauncher"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openUrl", returnType: CAPPluginReturnPromise)
    ]

    @objc func openUrl(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("URL gerekli")
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve()
                    return
                }

                if url.scheme == "minecraft",
                   let store = URL(string: "https://apps.apple.com/app/minecraft/id479516143") {
                    UIApplication.shared.open(store, options: [:]) { storeOpened in
                        if storeOpened {
                            call.resolve()
                        } else {
                            call.reject("URL açılamadı")
                        }
                    }
                    return
                }

                call.reject("URL açılamadı")
            }
        }
    }
}
