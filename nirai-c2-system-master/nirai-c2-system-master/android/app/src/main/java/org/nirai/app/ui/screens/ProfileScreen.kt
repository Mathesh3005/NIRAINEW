package org.nirai.app.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.nirai.app.AppRole
import java.io.ByteArrayOutputStream
import java.io.InputStream

data class EmergencyContact(
    var name: String,
    var phone: String,
    var relation: String
)

@Composable
fun ProfileScreen(
    currentRole: AppRole,
    userEmail: String,
    onSwitchRole: (AppRole) -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    
    // Bug 11: Persist contacts to SharedPreferences
    val prefs = context.getSharedPreferences("nirai_contacts", Context.MODE_PRIVATE)
    
    fun saveContactsToPrefs(contactList: List<EmergencyContact>) {
        val json = contactList.joinToString("|||") { "${it.name}::${it.phone}::${it.relation}" }
        prefs.edit().putString("emergency_contacts", json).apply()
    }
    
    fun loadContactsFromPrefs(): List<EmergencyContact> {
        val json = prefs.getString("emergency_contacts", null) ?: return listOf(
            EmergencyContact("Mother", "+91 98765 43210", "Family"),
            EmergencyContact("112 ERSS Control", "112", "Emergency")
        )
        return json.split("|||").mapNotNull { entry ->
            val parts = entry.split("::")
            if (parts.size >= 3) EmergencyContact(parts[0], parts[1], parts[2]) else null
        }.ifEmpty {
            listOf(
                EmergencyContact("Mother", "+91 98765 43210", "Family"),
                EmergencyContact("112 ERSS Control", "112", "Emergency")
            )
        }
    }
    
    val contacts = remember { mutableStateListOf<EmergencyContact>().also { it.addAll(loadContactsFromPrefs()) } }

    // Contact Editing Modal State
    var showContactDialog by remember { mutableStateOf(false) }
    var editingContactIndex by remember { mutableStateOf<Int?>(null) }
    var dialogName by remember { mutableStateOf("") }
    var dialogPhone by remember { mutableStateOf("") }
    var dialogRelation by remember { mutableStateOf("") }

    // Photo Upload State
    var profilePhotoBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var profilePhotoBase64 by remember { mutableStateOf<String?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            try {
                val inputStream: InputStream? = context.contentResolver.openInputStream(it)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                profilePhotoBitmap = bitmap

                val byteArrayOutputStream = ByteArrayOutputStream()
                bitmap?.compress(Bitmap.CompressFormat.JPEG, 70, byteArrayOutputStream)
                val byteArray = byteArrayOutputStream.toByteArray()
                profilePhotoBase64 = "data:image/jpeg;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP)

                Toast.makeText(context, "Profile Photo Updated!", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "Failed to load photo", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val roleName = when (currentRole) {
        AppRole.CIVILIAN -> "Civilian User"
        AppRole.POLICE -> "Police Officer"
        AppRole.DRONE -> "Drone Operator"
    }

    val roleColor = when (currentRole) {
        AppRole.CIVILIAN -> Color(0xFF06B6D4)
        AppRole.POLICE -> Color(0xFF3B82F6)
        AppRole.DRONE -> Color(0xFF8B5CF6)
    }

    val roleIcon = when (currentRole) {
        AppRole.CIVILIAN -> Icons.Default.Person
        AppRole.POLICE -> Icons.Default.Shield
        AppRole.DRONE -> Icons.Default.FlightTakeoff
    }

    // Edit Contact Dialog
    if (showContactDialog) {
        AlertDialog(
            onDismissRequest = { showContactDialog = false },
            containerColor = Color(0xFF0F172A),
            title = {
                Text(
                    text = if (editingContactIndex != null) "EDIT EMERGENCY CONTACT" else "ADD EMERGENCY CONTACT",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = dialogName,
                        onValueChange = { dialogName = it },
                        label = { Text("Contact Name") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF06B6D4),
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedLabelColor = Color(0xFF06B6D4),
                            unfocusedLabelColor = Color(0xFF94A3B8)
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = dialogPhone,
                        onValueChange = { dialogPhone = it },
                        label = { Text("Phone Number") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF06B6D4),
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedLabelColor = Color(0xFF06B6D4),
                            unfocusedLabelColor = Color(0xFF94A3B8)
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = dialogRelation,
                        onValueChange = { dialogRelation = it },
                        label = { Text("Relation (e.g. Mother, Friend)") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF06B6D4),
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedLabelColor = Color(0xFF06B6D4),
                            unfocusedLabelColor = Color(0xFF94A3B8)
                        ),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (dialogName.isNotBlank() && dialogPhone.isNotBlank()) {
                            val newContact = EmergencyContact(dialogName, dialogPhone, dialogRelation.ifBlank { "Contact" })
                            val idx = editingContactIndex
                            if (idx != null && idx in contacts.indices) {
                                contacts[idx] = newContact
                                Toast.makeText(context, "Contact Updated!", Toast.LENGTH_SHORT).show()
                            } else {
                                contacts.add(newContact)
                                Toast.makeText(context, "Contact Added!", Toast.LENGTH_SHORT).show()
                            }
                            showContactDialog = false
                            saveContactsToPrefs(contacts.toList())
                        } else {
                            Toast.makeText(context, "Please fill Name and Phone", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06B6D4))
                ) {
                    Text("SAVE", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showContactDialog = false }) {
                    Text("CANCEL", color = Color(0xFF94A3B8))
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Profile Avatar Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Profile Photo / Avatar circle
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(roleColor.copy(alpha = 0.4f), roleColor.copy(alpha = 0.1f))
                                )
                            )
                            .border(2.dp, roleColor, CircleShape)
                            .clickable { photoPickerLauncher.launch("image/*") },
                        contentAlignment = Alignment.Center
                    ) {
                        if (profilePhotoBitmap != null) {
                            Image(
                                bitmap = profilePhotoBitmap!!.asImageBitmap(),
                                contentDescription = "Profile Photo",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Icon(
                                imageVector = roleIcon,
                                contentDescription = null,
                                tint = roleColor,
                                modifier = Modifier.size(44.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    TextButton(onClick = { photoPickerLauncher.launch("image/*") }) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null, tint = Color(0xFF06B6D4), modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (profilePhotoBitmap != null) "CHANGE PHOTO" else "UPLOAD PHOTO",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF06B6D4)
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = roleName,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = userEmail,
                        fontSize = 13.sp,
                        color = Color(0xFF94A3B8)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Surface(
                        color = roleColor.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = currentRole.name,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = roleColor,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }

        // Role Switch Section
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.SwapHoriz, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("SWITCH ROLE", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        val roles = listOf(
                            AppRole.CIVILIAN to "CIVILIAN",
                            AppRole.POLICE to "POLICE",
                            AppRole.DRONE to "DRONE"
                        )
                        roles.forEach { (role, label) ->
                            val isSelected = currentRole == role
                            val bgColor by animateColorAsState(
                                if (isSelected) roleColor else Color.Transparent,
                                label = "roleBg"
                            )
                            Surface(
                                color = bgColor,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onSwitchRole(role) }
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
                }
            }
        }

        // Emergency Contacts Section (Civilian mode)
        if (currentRole == AppRole.CIVILIAN) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ContactPhone, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("EMERGENCY CONTACTS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
                            }
                            Surface(
                                color = Color(0xFF06B6D4).copy(alpha = 0.2f),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.clickable {
                                    editingContactIndex = null
                                    dialogName = ""
                                    dialogPhone = ""
                                    dialogRelation = ""
                                    showContactDialog = true
                                }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFF06B6D4), modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("ADD NEW", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF06B6D4))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        contacts.forEachIndexed { index, contact ->
                            Surface(
                                color = Color(0xFF1E293B),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(contact.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                        Text(contact.phone, fontSize = 12.sp, color = Color(0xFF38BDF8))
                                        Text(contact.relation, fontSize = 10.sp, color = Color(0xFF94A3B8))
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        // Edit Button
                                        IconButton(
                                            onClick = {
                                                editingContactIndex = index
                                                dialogName = contact.name
                                                dialogPhone = contact.phone
                                                dialogRelation = contact.relation
                                                showContactDialog = true
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Icon(Icons.Default.Edit, contentDescription = "Edit Contact", tint = Color(0xFF06B6D4), modifier = Modifier.size(18.dp))
                                        }
                                        // Delete Button
                                        IconButton(
                                            onClick = {
                                                contacts.removeAt(index)
                                                saveContactsToPrefs(contacts.toList())
                                                Toast.makeText(context, "Contact Deleted", Toast.LENGTH_SHORT).show()
                                            },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete Contact", tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Logout Button
        item {
            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = onLogout,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.15f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = Brush.linearGradient(listOf(Color(0xFFEF4444).copy(alpha = 0.4f), Color(0xFFEF4444).copy(alpha = 0.2f)))
                )
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("SIGN OUT", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "NIRAI SOS v2.0 — Networked Intelligent Rapid-response",
                fontSize = 10.sp,
                color = Color(0xFF475569),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
