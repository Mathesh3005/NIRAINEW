plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val physicalBackendUrl = providers.gradleProperty("niraiBackendPhysicalUrl")
    .orElse(providers.environmentVariable("NIRAI_BACKEND_PHYSICAL_URL"))
    .getOrElse("http://10.104.156.90:4000")
val emulatorBackendUrl = providers.gradleProperty("niraiBackendEmulatorUrl")
    .orElse(providers.environmentVariable("NIRAI_BACKEND_EMULATOR_URL"))
    .getOrElse("http://10.0.2.2:4000")

android {
    namespace = "org.nirai.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "org.nirai.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "BACKEND_URL_PHYSICAL", "\"$physicalBackendUrl\"")
        buildConfigField("String", "BACKEND_URL_EMULATOR", "\"$emulatorBackendUrl\"")

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("com.google.android.gms:play-services-location:21.2.0")
}
