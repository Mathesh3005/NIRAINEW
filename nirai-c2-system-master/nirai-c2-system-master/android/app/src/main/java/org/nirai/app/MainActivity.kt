package org.nirai.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.nirai.app.ui.screens.AuthScreen
import org.nirai.app.ui.screens.CivilianHomeScreen
import org.nirai.app.ui.screens.DroneHomeScreen
import org.nirai.app.ui.screens.PoliceHomeScreen
import org.nirai.app.ui.screens.ProfileScreen

enum class AppRole { CIVILIAN, POLICE, DRONE }
enum class NavTab { HOME, PROFILE }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF06B6D4),
                    secondary = Color(0xFF3B82F6),
                    background = Color(0xFF020617),
                    surface = Color(0xFF0F172A)
                )
            ) {
                var isAuthenticated by remember { mutableStateOf(false) }
                var currentRole by remember { mutableStateOf(AppRole.CIVILIAN) }
                var currentUserEmail by remember { mutableStateOf("civilian@nirai.app") }
                var currentTab by remember { mutableStateOf(NavTab.HOME) }

                if (!isAuthenticated) {
                    AuthScreen(
                        onLoginSuccess = { role, name ->
                            currentRole = role
                            currentUserEmail = name
                            isAuthenticated = true
                            currentTab = NavTab.HOME
                        }
                    )
                } else {
                    Scaffold(
                        containerColor = Color(0xFF020617),
                        bottomBar = {
                            NiraiBottomBar(
                                currentTab = currentTab,
                                currentRole = currentRole,
                                onTabSelected = { currentTab = it }
                            )
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding)) {
                            when (currentTab) {
                                NavTab.HOME -> {
                                    when (currentRole) {
                                        AppRole.CIVILIAN -> CivilianHomeScreen()
                                        AppRole.POLICE -> PoliceHomeScreen()
                                        AppRole.DRONE -> DroneHomeScreen()
                                    }
                                }
                                NavTab.PROFILE -> {
                                    ProfileScreen(
                                        currentRole = currentRole,
                                        userEmail = currentUserEmail,
                                        onSwitchRole = { role ->
                                            currentRole = role
                                            currentTab = NavTab.HOME
                                        },
                                        onLogout = {
                                            isAuthenticated = false
                                            currentTab = NavTab.HOME
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NiraiBottomBar(
    currentTab: NavTab,
    currentRole: AppRole,
    onTabSelected: (NavTab) -> Unit
) {
    val roleColor = when (currentRole) {
        AppRole.CIVILIAN -> Color(0xFF06B6D4)
        AppRole.POLICE -> Color(0xFF3B82F6)
        AppRole.DRONE -> Color(0xFF8B5CF6)
    }

    val homeIcon = when (currentRole) {
        AppRole.CIVILIAN -> Icons.Default.Warning
        AppRole.POLICE -> Icons.Default.Shield
        AppRole.DRONE -> Icons.Default.FlightTakeoff
    }

    val homeLabel = when (currentRole) {
        AppRole.CIVILIAN -> "SOS"
        AppRole.POLICE -> "DISPATCH"
        AppRole.DRONE -> "HUD"
    }

    Surface(
        color = Color(0xFF0F172A),
        tonalElevation = 8.dp,
        shadowElevation = 16.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Home Tab
            BottomNavItem(
                icon = homeIcon,
                label = homeLabel,
                isSelected = currentTab == NavTab.HOME,
                accentColor = roleColor,
                onClick = { onTabSelected(NavTab.HOME) }
            )

            // Profile Tab
            BottomNavItem(
                icon = Icons.Default.Person,
                label = "PROFILE",
                isSelected = currentTab == NavTab.PROFILE,
                accentColor = roleColor,
                onClick = { onTabSelected(NavTab.PROFILE) }
            )
        }
    }
}

@Composable
fun BottomNavItem(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    accentColor: Color,
    onClick: () -> Unit
) {
    val color by animateColorAsState(
        if (isSelected) accentColor else Color(0xFF64748B),
        label = "navColor"
    )

    Column(
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = color
        )
        if (isSelected) {
            Spacer(modifier = Modifier.height(2.dp))
            Surface(
                color = accentColor,
                shape = RoundedCornerShape(2.dp),
                modifier = Modifier.size(width = 20.dp, height = 3.dp)
            ) {}
        }
    }
}
