// Top-level build file where you can add configuration options common to all sub-projects/modules.
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath(libs.androidGradleBuildTools)
        classpath(libs.kotlinGradlePlugin)
        classpath(libs.react.native.gradle.plugin)
    }
}

// This is required for the CMAKE/NDK building of certain native modules for React Native (like react-native-screens).
// Just setting it only in the app's build.gradle would not resolve the issue because that controls the Java/Kotlin compilation of the app itself.
extra["minSdkVersion"] = libs.versions.app.minSdk.get().toInt()
extra["targetSdkVersion"] = libs.versions.app.targetSdk.get().toInt()
extra["compileSdkVersion"] = libs.versions.app.compileSdk.get().toInt()

tasks.register("clean", Delete::class.java) {
    delete(layout.buildDirectory)
}