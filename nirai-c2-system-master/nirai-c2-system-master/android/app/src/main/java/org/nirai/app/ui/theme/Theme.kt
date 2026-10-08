package org.nirai.app.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color

// Apple Pro Dark Color Scheme (iOS 18 HIG)
private val StandardDarkColorScheme = darkColorScheme(
    primary = PrimaryBlue,          // Signature Apple Action Blue (#0071E3)
    secondary = PrimaryCyan,        // Apple Sky Blue (#2997FF)
    tertiary = AiTelemetryAccent,   // Apple Intelligence Purple (#BF5AF2)
    background = BgDark950,         // Pure Black (#000000)
    surface = BgDark900,            // System Gray 6 (#1C1C1E)
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = TextPrimary,     // Parchment White (#F5F5F7)
    onSurface = TextPrimary,
    outline = BorderDark            // 1px Translucent Hairline
)

// Apple Warm Amber Offline Fallback Color Scheme
private val OfflineAmberColorScheme = darkColorScheme(
    primary = OfflineAmberPrimary,  // Apple System Orange (#FF9F0A)
    secondary = OfflineAmberSecondary,
    tertiary = AiTelemetryAccent,
    background = OfflineAmberBg,
    surface = OfflineAmberSurface,
    onPrimary = Color.Black,
    onSecondary = Color.White,
    onBackground = OfflineAmberText,
    onSurface = OfflineAmberText,
    outline = OfflineAmberBorder
)

private val StandardLightColorScheme = lightColorScheme(
    primary = PrimaryBlue,
    secondary = PrimaryCyan,
    tertiary = MotherPurple,
    background = Color(0xFFF4F6F8),
    surface = Color.White,
    surfaceVariant = Color(0xFFE9EEF2),
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFF17212B),
    onSurface = Color(0xFF17212B),
    onSurfaceVariant = Color(0xFF53616D),
    outline = Color(0xFFBAC4CD),
    outlineVariant = Color(0xFFD8DEE4),
    error = SeverityCritical
)

@Composable
fun NiraiTheme(
    isOfflineMode: Boolean = false,
    content: @Composable () -> Unit
) {
    val darkMode = isSystemInDarkTheme()
    val colorScheme: ColorScheme = when {
        isOfflineMode -> OfflineAmberColorScheme
        darkMode -> StandardDarkColorScheme
        else -> StandardLightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
