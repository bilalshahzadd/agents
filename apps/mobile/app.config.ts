import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Spheric Agents", slug: "spheric-agents", scheme: "sphericagents", version: "1.0.0", orientation: "portrait", userInterfaceStyle: "dark",
  ios: { supportsTablet: true, bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "media.spheric.agents", config: { usesNonExemptEncryption: false } },
  android: { package: process.env.ANDROID_PACKAGE ?? "media.spheric.agents", adaptiveIcon: { backgroundColor: "#07090d" } },
  plugins: ["expo-router", ["expo-secure-store", { configureAndroidBackup: true, faceIDPermission: "Allow Spheric Agents to protect your session." }]],
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } }, experiments: { typedRoutes: true }
};
export default config;
