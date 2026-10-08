package org.nirai.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import org.nirai.app.AppRole

@Composable
fun AuthScreen(
    onLoginSuccess: (AppRole, String) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf(AppRole.CIVILIAN) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Header Logo
        Surface(
            color = Color(0xFF06B6D4).copy(alpha = 0.15f),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            Text(
                text = "NIRAI",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF06B6D4),
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)
            )
        }

        Text(
            text = "Emergency Response & Patrol Node Auth",
            fontSize = 13.sp,
            color = Color(0xFF94A3B8)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Role Selector Tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF0F172A), RoundedCornerShape(12.dp))
                .padding(4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            val roles = listOf(
                AppRole.CIVILIAN to "CIVILIAN",
                AppRole.POLICE to "POLICE",
                AppRole.DRONE to "DRONE NODE"
            )
            roles.forEach { (role, label) ->
                val isSelected = selectedRole == role
                Surface(
                    color = if (isSelected) Color(0xFF06B6D4) else Color.Transparent,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .weight(1f)
                        .clickable { selectedRole = role }
                ) {
                    Box(
                        modifier = Modifier.padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = label,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) Color.Black else Color(0xFF94A3B8)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Email & Password Fields
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email / Officer ID") },
            placeholder = { Text("e.g. officer@police.tn.gov.in") },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF06B6D4),
                unfocusedBorderColor = Color(0xFF334155),
                focusedLabelColor = Color(0xFF06B6D4),
                unfocusedLabelColor = Color(0xFF94A3B8),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password / Passcode") },
            visualTransformation = PasswordVisualTransformation(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color(0xFF06B6D4),
                unfocusedBorderColor = Color(0xFF334155),
                focusedLabelColor = Color(0xFF06B6D4),
                unfocusedLabelColor = Color(0xFF94A3B8),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Login Button
        Button(
            onClick = {
                val userName = email.ifEmpty { "User (${selectedRole.name})" }
                onLoginSuccess(selectedRole, userName)
            },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Text(
                text = "SIGN IN AS ${selectedRole.name}",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Google Sign-In Button (Mock & Direct Integration)
        OutlinedButton(
            onClick = {
                val userName = "Google Account (${selectedRole.name})"
                onLoginSuccess(selectedRole, userName)
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
        ) {
            Text("CONTINUE WITH GOOGLE ACCOUNT", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Initial Testing Mode — Instant Sign In (No Email Verification Required)",
            fontSize = 10.sp,
            color = Color(0xFF64748B)
        )
    }
}
