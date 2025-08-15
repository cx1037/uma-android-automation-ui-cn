plugins {
    id("com.android.application")
    id("kotlin-android")
    id("com.facebook.react")
}

android {
    namespace = "com.steve1316.uma_android_automation"
    compileSdk = libs.versions.app.compileSdk.get().toInt()
    buildToolsVersion = libs.versions.app.buildToolsVersion.get()

    defaultConfig {
        applicationId = "com.steve1316.uma_android_automation"
        minSdk {
            version = release(libs.versions.app.minSdk.get().toInt())
        }
        targetSdk {
            version = release(libs.versions.app.targetSdk.get().toInt())
        }
        versionCode = libs.versions.app.versionCode.get().toInt()
        versionName = libs.versions.app.versionName.get()
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            isProfileable = false
            isJniDebuggable = false
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            isDefault = true
            isMinifyEnabled = false
            isShrinkResources = false
        }
        all {
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            applicationVariants.all {
                val releaseType = this.buildType.name
                // Allow layout XMLs to get a reference to the application's version number.
                resValue("string", "versionName", "v${versionName}")

                // Auto-generate the file name.
                // To access the output file name, the apk variants must be explicitly cast to,
                // as in the previous groovy version (where they were implicitly cast)
                outputs.asSequence()
                    .filter {
                        it is com.android.build.gradle.internal.api.ApkVariantOutputImpl
                    }.map {
                        it as com.android.build.gradle.internal.api.ApkVariantOutputImpl
                    }.forEach {
                        val type = releaseType
                        val versionName = defaultConfig.versionName
                        val architecture = it.filters.first().identifier
                        it.outputFileName = "v${versionName}-UmaAndroidAutomation-${architecture}-${type}.apk"
                    }
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Specify which architecture to make apks for, or set universalApk to true for an all-in-one apk with increased file size.
    splits {
        abi {
            isEnable = true
            reset()
            //noinspection ChromeOsAbiSupport
            include("armeabi-v7a", "arm64-v8a")
            // include "armeabi","armeabi-v7a",'arm64-v8a',"mips","x86","x86_64"
            isUniversalApk = false
        }
    }
}

dependencies {
    implementation(libs.bundles.androidApp)

    // React Native.
    implementation(libs.react.android)
    implementation(libs.hermes.android)

    // OpenCV Android 4.12.0 for image processing.
    implementation(libs.opencv)

    // Tesseract4Android for OCR text recognition.
    implementation(libs.tesseract4android)

    // string-similarity to compare the string from OCR to the strings in data.
    implementation(libs.stringSimilarity)

    // Klaxon to parse JSON data files.
    implementation(libs.klaxon)

    // Google's Firebase Machine Learning OCR for Text Detection.
    implementation(libs.mlkitTextRecognition)

    // AppUpdater for notifying users when there is a new update available.
    implementation(libs.appUpdater)
}

react {
    // Needed to enable Autolinking - https://github.com/react-native-community/cli/blob/master/docs/autolinking.md
    autolinkLibrariesWithApp()
}

kotlin {
    jvmToolchain {
        languageVersion.set(JavaLanguageVersion.of(libs.versions.app.jvm.toolchain.get().toInt()))
    }
}

// ============================================================================
// React Native Bundle Configuration and Build Tasks
// ============================================================================

// Configure React Native to bundle JavaScript code in both debug and release builds.
project.extra["react"] = mapOf(
    "bundleInDebug" to true,
    "bundleInRelease" to true,
)

// Configure the source sets to include React Native bundle assets in the APK.
// This ensures the JavaScript bundle and any generated assets are properly packaged.
android.sourceSets {
    getByName("main") {
        assets.srcDirs("src/main/assets", "build/generated/assets/react")
    }
}

// Clean task to remove old React Native bundles and generated assets.
// This prevents stale bundles from being included in new builds.
tasks.register("cleanBundle", Delete::class.java) {
    delete("${projectDir}/src/main/assets/index.android.bundle")
    delete("${projectDir}/src/main/assets/index.android.bundle.meta")
    delete("${projectDir}/src/main/res/drawable-*")
    delete("${projectDir}/src/main/res/raw")
}

// Make the main clean task depend on cleanBundle to ensure React Native assets are cleaned.
tasks.named("clean") {
    dependsOn("cleanBundle")
}

// Generate the React Native JavaScript bundle before building the APK.
// This task runs the generate-bundle.js script to create the JavaScript bundle.
tasks.register("generateBundle", Exec::class) {
    workingDir = projectDir.parentFile
    commandLine("node", "generate-bundle.js")
    
    // Only run if the bundle generation script exists.
    onlyIf {
        file("${projectDir.parentFile}/generate-bundle.js").exists()
    }
    
    // Handle case where the bundle generation script doesn't exist.
    doFirst {
        if (!file("${projectDir.parentFile}/generate-bundle.js").exists()) {
            println("Bundle generation script not found, skipping...")
            enabled = false
        }
    }
}

// Ensure the React Native bundle is generated before the preBuild task runs.
// This guarantees the bundle is available for the build process.
tasks.named("preBuild") {
    dependsOn("generateBundle")
}

// Make bundle generation run before any application variant is assembled.
// This ensures the JavaScript bundle is always up-to-date in the final APK.
android.applicationVariants.all {
    val variant = this
    variant.assembleProvider.get().dependsOn("generateBundle")
}