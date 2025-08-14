// Configures the React Native Gradle Settings plugin used for autolinking
pluginManagement { includeBuild("../node_modules/@react-native/gradle-plugin") }
extensions.configure<com.facebook.react.ReactSettingsExtension> { autolinkLibrariesFromCommand() }
includeBuild("../node_modules/@react-native/gradle-plugin")

include(":app")
rootProject.name = "UmaAndroidAutomation"

// Automatic provisioning of a compatible JVM toolchain.
// Convention plugin fetches a jdk into the gradle home directory
// if it doesn't find any compatible ones in its canonical OS search paths.
plugins {
    // Settings plugins cannot be declared in version catalog.
    id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")
    id("com.facebook.react.settings")
}
