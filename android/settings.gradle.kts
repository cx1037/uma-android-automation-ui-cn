// Configures Expo for autolinking.
pluginManagement { 
    includeBuild("../node_modules/@react-native/gradle-plugin")
    val expoPluginsPath = File(
        providers.exec {
            workingDir(rootDir)
            commandLine("node", "--print", "require.resolve('expo-modules-autolinking/package.json', { paths: [require.resolve('expo/package.json')] })")
        }.standardOutput.asText.get().trim(),
        "../android/expo-gradle-plugin"
    ).absolutePath
    includeBuild(expoPluginsPath)
}

include(":app")
rootProject.name = "UmaAndroidAutomation"

// Centralized repository management.
@Suppress("UnstableApiUsage")
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

// Automatic provisioning of a compatible JVM toolchain.
// Convention plugin fetches a jdk into the gradle home directory
// if it doesn't find any compatible ones in its canonical OS search paths.
plugins {
    // Settings plugins cannot be declared in version catalog.
    id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")
    id("com.facebook.react.settings")
    id("expo-autolinking-settings")
}

extensions.configure<com.facebook.react.ReactSettingsExtension> { 
    autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand) 
}
expoAutolinking.useExpoModules()
expoAutolinking.useExpoVersionCatalog()
includeBuild(expoAutolinking.reactNativeGradlePlugin)