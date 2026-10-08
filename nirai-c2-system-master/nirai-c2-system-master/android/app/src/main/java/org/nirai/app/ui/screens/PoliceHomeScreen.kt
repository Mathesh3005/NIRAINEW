package org.nirai.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
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
import org.nirai.app.ui.theme.NiraiTheme
import org.nirai.app.ui.theme.TabularTypography

data class DispatchItem(
    val id: String,
    val reporter: String,
    val location: String,
    val distance: String,
    val status: String,
    val lat: Double = 0.0,
    val lng: Double = 0.0
)

@Composable
fun PoliceHomeScreen() {
    val context = LocalContext.current
    var isOnDuty by remember { mutableStateOf(true) }
    var dispatchStatus by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val coroutineScope = rememberCoroutineScope()

    val officerUserId = "usr-p1"

    // Real GPS for officer location
    var officerLat by remember { mutableStateOf(13.0850) }
    var officerLng by remember { mutableStateOf(80.2740) }
    var hasGpsFix by remember { mutableStateOf(false) }
    var gpsPermissionGranted by remember { mutableStateOf(false) }

    val gpsPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        gpsPermissionGranted = (permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false) ||
                (permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false)
    }

    LaunchedEffect(Unit) {
        val hasFine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
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

    var dispatches by remember { mutableStateOf<List<DispatchItem>>(emptyList()) }

    // Poll backend for real cases every 8 seconds
    LaunchedEffect(Unit) {
        while (true) {
            try {
                val response = NiraiApi.getCases()
                if (response != null) {
                    val caseIdPattern = Regex(""""id"\s*:\s*"([^"]+)"""")
                    val reporterPattern = Regex(""""reporterName"\s*:\s*"([^"]+)"""")
                    val addressPattern = Regex(""""address"\s*:\s*"([^"]+)"""")
                    val statusPattern = Regex(""""status"\s*:\s*"([^"]+)"""")
                    val latPattern = Regex(""""lat"\s*:\s*([\d.]+)""")
                    val lngPattern = Regex(""""lng"\s*:\s*([\d.]+)""")

                    val ids = caseIdPattern.findAll(response).map { it.groupValues[1] }.filter { it.startsWith("case-") }.toList()
                    val reporters = reporterPattern.findAll(response).map { it.groupValues[1] }.toList()
                    val addresses = addressPattern.findAll(response).map { it.groupValues[1] }.toList()
                    val statuses = statusPattern.findAll(response).map { it.groupValues[1] }.toList()
                    val lats = latPattern.findAll(response).map { it.groupValues[1].toDoubleOrNull() ?: 0.0 }.toList()
                    val lngs = lngPattern.findAll(response).map { it.groupValues[1].toDoubleOrNull() ?: 0.0 }.toList()

                    val items = ids.mapIndexed { i, id ->
                        val dist = if (hasGpsFix && i < lats.size && i < lngs.size) {
                            val dLat = Math.toRadians(lats[i] - officerLat)
                            val dLng = Math.toRadians(lngs[i] - officerLng)
                            val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(Math.toRadians(officerLat)) * Math.cos(Math.toRadians(lats[i])) *
                                Math.sin(dLng / 2) * Math.sin(dLng / 2)
                            val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                            String.format("%.1f km", 6371.0 * c)
                        } else "-- km"
                        DispatchItem(
                            id = id,
                            reporter = reporters.getOrElse(i) { "Unknown" },
                            location = addresses.getOrElse(i) { "Unknown Location" },
                            distance = dist,
                            status = (statuses.getOrElse(i) { "raised" }).uppercase().replace("_", " "),
                            lat = lats.getOrElse(i) { 0.0 },
                            lng = lngs.getOrElse(i) { 0.0 }
                        )
                    }.filter { it.status != "RESOLVED" && it.status != "FALSE ALARM" }
                    dispatches = items
                }
            } catch (_: Exception) {}
            delay(8000)
        }
    }

    // GPS listener
    DisposableEffect(gpsPermissionGranted) {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                officerLat = location.latitude
                officerLng = location.longitude
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
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000, 10f, locationListener)
                }
                if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                    locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000, 10f, locationListener)
                }
                val lastKnown = try {
                    locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                        ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                } catch (_: Exception) { null }

                lastKnown?.let {
                    officerLat = it.latitude
                    officerLng = it.longitude
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

    // Periodic heartbeat to C2
    LaunchedEffect(isOnDuty, hasGpsFix, officerLat, officerLng) {
        while (true) {
            try {
                NiraiApi.updateOfficerLocation(
                    userId = officerUserId,
                    lat = officerLat,
                    lng = officerLng,
                    onDuty = isOnDuty
                )
            } catch (_: Exception) {}
            delay(5000)
        }
    }

    NiraiTheme {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(16.dp)
        ) {
            // Officer Identity Card
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF3B82F6).copy(alpha = 0.3f), RoundedCornerShape(16.dp))
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
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.linearGradient(listOf(Color(0xFF3B82F6), Color(0xFF1D4ED8)))
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Insp. R. Arumugam", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                Text("Badge: TNP-4029 | Patrol Car #04", fontSize = 11.sp, color = Color(0xFF94A3B8))
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = if (isOnDuty) "ON DUTY" else "OFF DUTY",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isOnDuty) Color(0xFF10B981) else Color(0xFFEF4444)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Switch(
                                    checked = isOnDuty,
                                    onCheckedChange = { isOnDuty = it },
                                    modifier = Modifier.height(24.dp)
                                )
                            }
                        }
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
                            text = if (hasGpsFix) "GPS: ${String.format("%.4f", officerLat)}, ${String.format("%.4f", officerLng)}" else "Acquiring GPS...",
                            style = TabularTypography.telemetrySmall,
                            color = if (hasGpsFix) Color(0xFF10B981) else Color(0xFFF59E0B)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("DISPATCH & PROXIMITY QUEUE", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
                Spacer(modifier = Modifier.weight(1f))
                Surface(
                    color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = "${dispatches.size} ACTIVE",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFF59E0B),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(dispatches) { dispatch ->
                    val ackStatus = dispatchStatus[dispatch.id]

                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0xFF334155), RoundedCornerShape(14.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = Color(0xFFEF4444).copy(alpha = 0.2f),
                                        shape = CircleShape,
                                        modifier = Modifier.size(8.dp)
                                    ) {}
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(dispatch.id, style = TabularTypography.telemetryMedium, color = Color(0xFF38BDF8))
                                }
                                Surface(
                                    color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = dispatch.status,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFF59E0B),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text("Reporter: ${dispatch.reporter}", fontSize = 13.sp, color = Color.White)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(dispatch.location, fontSize = 12.sp, color = Color(0xFF94A3B8))
                            }

                            // Dynamic expanded routing view once case is acknowledged
                            AnimatedVisibility(visible = ackStatus == "RESPONDING") {
                                var isDarkMap by remember { mutableStateOf(true) }

                                Column(modifier = Modifier.padding(top = 12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "TACTICAL INTER-ROUTING ENGINE",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary,
                                            letterSpacing = 0.5.sp
                                        )
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier
                                                .clickable { isDarkMap = !isDarkMap }
                                                .padding(horizontal = 4.dp, vertical = 2.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (isDarkMap) Icons.Default.DarkMode else Icons.Default.LightMode,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(12.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = if (isDarkMap) "DARK MAP" else "LIGHT MAP",
                                                fontSize = 8.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(6.dp))

                                    // Dynamic Canvas Map Rendering
                                    ResponseRouteMap(
                                        officerLat = officerLat,
                                        officerLng = officerLng,
                                        incidentLat = dispatch.lat,
                                        incidentLng = dispatch.lng,
                                        isDarkMap = isDarkMap
                                    )

                                    Spacer(modifier = Modifier.height(10.dp))

                                    // Navigation ETA countdown (using tabular numeral monospace font)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text("DESTINATION LOCATION", fontSize = 8.sp, color = Color(0xFF64748B))
                                            Text(
                                                text = "LAT: ${String.format("%.4f", dispatch.lat)} | LNG: ${String.format("%.4f", dispatch.lng)}",
                                                style = TabularTypography.telemetrySmall,
                                                color = Color.White
                                            )
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text("TACTICAL ETA TIMER", fontSize = 8.sp, color = Color(0xFF64748B))
                                            
                                            // Animate descending seconds countdown
                                            var countdownSeconds by remember { mutableStateOf(180) }
                                            LaunchedEffect(Unit) {
                                                while (countdownSeconds > 0) {
                                                    delay(1000)
                                                    countdownSeconds--
                                                }
                                            }
                                            val m = countdownSeconds / 60
                                            val s = countdownSeconds % 60
                                            Text(
                                                text = String.format("%02d:%02d", m, s),
                                                style = TabularTypography.telemetryMedium,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.NearMe, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(dispatch.distance, style = TabularTypography.telemetryMedium, color = Color(0xFF10B981))
                                }

                                if (ackStatus != null) {
                                    Surface(
                                        color = if (ackStatus.contains("FAILED")) Color(0xFFEF4444).copy(alpha = 0.15f) else Color(0xFF10B981).copy(alpha = 0.15f),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text(
                                            text = ackStatus,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (ackStatus.contains("FAILED")) Color(0xFFEF4444) else Color(0xFF10B981),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                        )
                                    }
                                } else {
                                    Button(
                                        onClick = {
                                            coroutineScope.launch {
                                                dispatchStatus = dispatchStatus + (dispatch.id to "SENDING...")
                                                val result = NiraiApi.acknowledgeCase(
                                                    caseId = dispatch.id,
                                                    officerUserId = officerUserId
                                                )
                                                dispatchStatus = dispatchStatus + (dispatch.id to
                                                    if (result != null) "RESPONDING" else "FAILED — RETRY")
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0071E3)),
                                        shape = RoundedCornerShape(12.dp),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Icon(Icons.Default.Send, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("RESPOND", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// Custom Vector Routing Visualizer drawing tactical grids, route line, start/end nodes and animated pulse dots.
@Composable
fun ResponseRouteMap(
    officerLat: Double,
    officerLng: Double,
    incidentLat: Double,
    incidentLng: Double,
    isDarkMap: Boolean,
    modifier: Modifier = Modifier
) {
    val mapBg = if (isDarkMap) Color(0xFF0F172A) else Color(0xFFF1F5F9)
    val streetColor = if (isDarkMap) Color(0xFF1E293B) else Color(0xFFCBD5E1)
    val routeColor = if (isDarkMap) Color(0xFF06B6D4) else Color(0xFF1D4ED8)
    val dotPulseColor = if (isDarkMap) Color(0xFF22D3EE) else Color(0xFF3B82F6)

    // Route travel animation logic
    val infiniteTransition = rememberInfiniteTransition(label = "routePulse")
    val pathProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(6000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "pathProgress"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(130.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(mapBg)
            .border(1.dp, streetColor, RoundedCornerShape(8.dp))
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Draw grid-aligned streets
            val numGridLines = 6
            for (i in 1..numGridLines) {
                // Horizontal streets
                val y = h * (i.toFloat() / (numGridLines + 1))
                drawLine(
                    color = streetColor,
                    start = Offset(0f, y),
                    end = Offset(w, y),
                    strokeWidth = 2.5f
                )
                // Vertical streets
                val x = w * (i.toFloat() / (numGridLines + 1))
                drawLine(
                    color = streetColor,
                    start = Offset(x, 0f),
                    end = Offset(x, h),
                    strokeWidth = 2.5f
                )
            }

            // Route points (L-shaped path starting at officer bottom-left to target top-right)
            val startOffset = Offset(w * 0.15f, h * 0.75f)
            val cornerOffset = Offset(w * 0.75f, h * 0.75f)
            val endOffset = Offset(w * 0.75f, h * 0.25f)

            // Draw route lines with robust contrasting style
            drawLine(
                color = routeColor,
                start = startOffset,
                end = cornerOffset,
                strokeWidth = 5.5f
            )
            drawLine(
                color = routeColor,
                start = cornerOffset,
                end = endOffset,
                strokeWidth = 5.5f
            )

            // Calculate current animated position along the L-route segments
            val currentOffset = if (pathProgress < 0.6f) {
                val t = pathProgress / 0.6f
                Offset(
                    startOffset.x + (cornerOffset.x - startOffset.x) * t,
                    startOffset.y
                )
            } else {
                val t = (pathProgress - 0.6f) / 0.4f
                Offset(
                    cornerOffset.x,
                    cornerOffset.y + (endOffset.y - cornerOffset.y) * t
                )
            }

            // Pulse ring and vehicle core dot
            drawCircle(
                color = dotPulseColor.copy(alpha = 0.35f),
                radius = 11f,
                center = currentOffset
            )
            drawCircle(
                color = dotPulseColor,
                radius = 4.5f,
                center = currentOffset
            )

            // Start node (Officer)
            drawCircle(
                color = Color(0xFF3B82F6),
                radius = 7.5f,
                center = startOffset
            )
            drawCircle(
                color = Color.White,
                radius = 3.5f,
                center = startOffset
            )

            // End node (Incident SOS)
            drawCircle(
                color = Color(0xFFEF4444),
                radius = 7.5f,
                center = endOffset
            )
            drawCircle(
                color = Color.White,
                radius = 3.5f,
                center = endOffset
            )
        }

        // Overlay text labels on route nodes
        Text(
            text = "OFFICER #04",
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF3B82F6),
            modifier = Modifier.padding(start = 14.dp, top = 100.dp)
        )

        Text(
            text = "SOS INCIDENT TARGET",
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFFEF4444),
            modifier = Modifier.padding(start = 180.dp, top = 14.dp)
        )
    }
}
