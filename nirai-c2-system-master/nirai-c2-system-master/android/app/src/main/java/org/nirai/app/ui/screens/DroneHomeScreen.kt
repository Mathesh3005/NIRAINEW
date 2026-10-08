package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi
import org.nirai.app.ui.components.CameraStreamView

@Composable
fun DroneHomeScreen() {
    val context = LocalContext.current
    var droneStatus by remember { mutableStateOf("AIRBORNE_RECON") }
    var altitudeMeters by remember { mutableStateOf(35) }
    var batteryPct by remember { mutableStateOf(92) }
    var speedKmh by remember { mutableStateOf(34) }
    var telemetryLog by remember { mutableStateOf("Initializing C2 Stream...") }
    var hasCameraPermission by remember { mutableStateOf(false) }
    var gpsPermissionGranted by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    // Camera Permission Launcher (Isolated to Drone Page)
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
        if (isGranted) {
            Toast.makeText(context, "Drone Camera Hardware Enabled", Toast.LENGTH_SHORT).show()
        }
    }

    // GPS Permission Launcher
    val gpsPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        gpsPermissionGranted = (permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false) ||
            (permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false)
    }

    LaunchedEffect(Unit) {
        // Request Camera permission specifically on Drone page
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        } else {
            hasCameraPermission = true
        }

        // Check GPS permission for drone telemetry
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            gpsPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            gpsPermissionGranted = true
        }
    }

    // Real GPS for drone position
    var currentLat by remember { mutableStateOf(13.0827) }
    var currentLng by remember { mutableStateOf(80.2707) }
    var hasGpsFix by remember { mutableStateOf(false) }

    DisposableEffect(gpsPermissionGranted) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLat = location.latitude
                currentLng = location.longitude
                hasGpsFix = true
            }
            @Deprecated("Deprecated") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        try {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                
                if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 5f, locationListener)
                }
                if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                    locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000, 5f, locationListener)
                }
                val lastKnown = try {
                    locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                        ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                } catch (_: Exception) { null }

                lastKnown?.let {
                    currentLat = it.latitude
                    currentLng = it.longitude
                    hasGpsFix = true
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        onDispose {
            try {
                locationManager?.removeUpdates(locationListener)
            } catch (_: Exception) {}
        }
    }

    // Periodic telemetry sync
    LaunchedEffect(currentLat, currentLng, hasGpsFix, droneStatus, altitudeMeters) {
        while (true) {
            try {
                if (batteryPct > 15) batteryPct -= 1

                NiraiApi.updateDroneTelemetry(
                    droneId = "drone-c1",
                    lat = currentLat,
                    lng = currentLng,
                    altitudeMeters = altitudeMeters,
                    batteryPct = batteryPct,
                    status = droneStatus.lowercase()
                )
                telemetryLog = "GPS: ${String.format("%.4f", currentLat)}, ${String.format("%.4f", currentLng)} → C2 Live"
            } catch (_: Exception) {}
            delay(3000)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Drone HUD Top Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF8B5CF6).copy(alpha = 0.4f), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFF6D28D9)))
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.FlightTakeoff, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("RECON NODE ALPHA", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA78BFA))
                            Text("DRONE-C1", fontSize = 10.sp, color = Color(0xFF94A3B8))
                        }
                    }
                    Surface(
                        color = Color(0xFF10B981).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = "DGCA NPNT",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF10B981),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Telemetry Grid
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TelemetryCell("ALTITUDE", "${altitudeMeters}m", Color.White)
                    TelemetryCell("SPEED", "${speedKmh} km/h", Color(0xFF38BDF8))
                    TelemetryCell("BATTERY", "${batteryPct}%", if (batteryPct > 20) Color(0xFF10B981) else Color(0xFFEF4444))
                    TelemetryCell("SIGNAL", "5G/MESH", Color(0xFFF59E0B))
                }

                Spacer(modifier = Modifier.height(8.dp))

                // GPS Status
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (hasGpsFix) Icons.Default.MyLocation else Icons.Default.LocationSearching,
                        contentDescription = null,
                        tint = if (hasGpsFix) Color(0xFF10B981) else Color(0xFFF59E0B),
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = telemetryLog,
                        fontSize = 10.sp,
                        color = Color(0xFF10B981)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

    // Dynamic mission target from backend
    var missionCaseId by remember { mutableStateOf<String?>(null) }
    var missionReporter by remember { mutableStateOf("Awaiting Mission Assignment...") }
    var missionAddress by remember { mutableStateOf("No active target") }
    var missionStatus by remember { mutableStateOf("STANDBY") }

    // Poll for active cases assigned to this drone
    LaunchedEffect(Unit) {
        while (true) {
            try {
                val response = NiraiApi.getCases()
                if (response != null) {
                    // Find the first airborne/on_scene/unit_assigned case with a droneId
                    val caseIdPattern = Regex(""""id"\s*:\s*"(case-[^"]+)"""")
                    val reporterPattern = Regex(""""reporterName"\s*:\s*"([^"]+)"""")
                    val addressPattern = Regex(""""address"\s*:\s*"([^"]+)"""")
                    val statusPattern = Regex(""""status"\s*:\s*"([^"]+)"""")

                    val ids = caseIdPattern.findAll(response).map { it.groupValues[1] }.toList()
                    val reporters = reporterPattern.findAll(response).map { it.groupValues[1] }.toList()
                    val addresses = addressPattern.findAll(response).map { it.groupValues[1] }.toList()
                    val statuses = statusPattern.findAll(response).map { it.groupValues[1] }.toList()

                    // Find first active case (airborne, on_scene, or unit_assigned)
                    val activeIdx = statuses.indexOfFirst {
                        it == "airborne" || it == "on_scene" || it == "unit_assigned" || it == "verifying" || it == "raised"
                    }
                    if (activeIdx >= 0 && activeIdx < ids.size) {
                        missionCaseId = ids[activeIdx]
                        missionReporter = reporters.getOrElse(activeIdx) { "Unknown Reporter" }
                        missionAddress = addresses.getOrElse(activeIdx) { "Unknown Location" }
                        missionStatus = statuses.getOrElse(activeIdx) { "UNKNOWN" }.uppercase().replace("_", " ")
                    } else {
                        missionCaseId = null
                        missionReporter = "No Active Mission"
                        missionAddress = "Awaiting C2 dispatch command"
                        missionStatus = "STANDBY"
                    }
                }
            } catch (_: Exception) {}
            delay(10000)
        }
    }

        // Mission Target Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.GpsFixed, contentDescription = null, tint = Color(0xFFF43F5E), modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("ASSIGNED RECON MISSION", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF43F5E))
                    Spacer(modifier = Modifier.weight(1f))
                    Surface(
                        color = if (missionCaseId != null) Color(0xFFF59E0B).copy(alpha = 0.15f) else Color(0xFF334155),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = missionStatus,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (missionCaseId != null) Color(0xFFF59E0B) else Color(0xFF94A3B8),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = if (missionCaseId != null) "${missionCaseId} — Emergency SOS Distress" else "No Active Mission",
                    fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White
                )
                Text("Target: $missionReporter ($missionAddress)", fontSize = 12.sp, color = Color(0xFF94A3B8))
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (hasGpsFix) "Drone GPS: ${String.format("%.4f", currentLat)} N, ${String.format("%.4f", currentLng)} E" else "Acquiring GPS...",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF38BDF8)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Camera Feed
        CameraStreamView(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp),
            nodeLabel = "RECON DRONE CAMERA (DRONE-C1)"
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Control Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    droneStatus = "RETURN_TO_HOME"
                    altitudeMeters = 50
                    telemetryLog = "CMD: Return to Home (Station Dock 1)"
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Home, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("RTH RECALL", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }

            Button(
                onClick = {
                    droneStatus = "HOVER_LOCK"
                    speedKmh = 0
                    telemetryLog = "CMD: Emergency Position Hold"
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.PauseCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("HOVER LOCK", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
private fun TelemetryCell(label: String, value: String, valueColor: Color) {
    Column {
        Text(text = label, fontSize = 9.sp, fontWeight = FontWeight.Medium, color = Color(0xFF94A3B8))
        Text(text = value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = valueColor)
    }
}
