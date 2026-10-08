package org.nirai.app.ui.components

import android.content.Context
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.hardware.Camera
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.view.SurfaceHolder
import android.view.SurfaceView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.nirai.app.network.NiraiApi
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

@Composable
fun CameraStreamView(
    modifier: Modifier = Modifier,
    nodeLabel: String = "LIVE C2 STREAM",
    streamId: String = "drone-c1",
    onStreamActive: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    var isNightVision by remember { mutableStateOf(false) }
    var isFlashOn by remember { mutableStateOf(false) }
    var streamFps by remember { mutableStateOf(30) }
    var micDecibel by remember { mutableStateOf(45) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (isNightVision) Color(0xFF064E3B) else Color(0xFF0F172A))
            .border(1.dp, if (isNightVision) Color(0xFF10B981) else Color(0xFF38BDF8), RoundedCornerShape(16.dp))
    ) {
        // Native Android Camera Hardware Surface + Live Audio Record Sampler
        AndroidView(
            factory = { ctx ->
                CameraPreviewSurface(ctx, streamId) { db ->
                    micDecibel = db
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Tactical HUD Overlays
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top HUD Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Color.Black.copy(alpha = 0.65f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = Color(0xFFEF4444),
                            shape = CircleShape,
                            modifier = Modifier.size(8.dp)
                        ) {}
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "$nodeLabel • $streamFps FPS • 1080P",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Live Audio Decibel Capsule
                    Surface(
                        color = Color.Black.copy(alpha = 0.65f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                color = if (micDecibel > 75) Color(0xFFEF4444) else Color(0xFF30D158),
                                shape = CircleShape,
                                modifier = Modifier.size(6.dp)
                            ) {}
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "MIC $micDecibel dB",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (micDecibel > 75) Color(0xFFFCA5A5) else Color(0xFFA7F3D0)
                            )
                        }
                    }

                    // Optical/IR Mode Badge
                    Surface(
                        color = if (isNightVision) Color(0xFF10B981).copy(alpha = 0.3f) else Color(0xFF06B6D4).copy(alpha = 0.3f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = if (isNightVision) "IR NIGHT RECON" else "OPTICAL FEED",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isNightVision) Color(0xFFA7F3D0) else Color(0xFFCFFAFE),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            // Central Reticle
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    color = Color.Transparent,
                    modifier = Modifier
                        .size(100.dp)
                        .border(1.dp, Color.White.copy(alpha = 0.4f), CircleShape)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Surface(
                            color = Color(0xFFEF4444),
                            shape = CircleShape,
                            modifier = Modifier.size(4.dp)
                        ) {}
                    }
                }
            }

            // Bottom Control Toolbar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "A/V Uplink → C2 Dashboard (siteon-47a8f)",
                    fontSize = 10.sp,
                    color = Color.White.copy(alpha = 0.85f),
                    fontWeight = FontWeight.Medium
                )

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Surface(
                        color = if (isNightVision) Color(0xFF10B981) else Color(0xFF334155),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.clickable { isNightVision = !isNightVision }
                    ) {
                        Text(
                            text = "IR THERMAL",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }

                    Surface(
                        color = if (isFlashOn) Color(0xFFF59E0B) else Color(0xFF334155),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.clickable { isFlashOn = !isFlashOn }
                    ) {
                        Text(
                            text = if (isFlashOn) "TORCH ON" else "TORCH OFF",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * SurfaceView for rendering hardware camera preview frames & streaming live video + audio feed.
 * @param targetStreamId The unique stream identifier sent to the backend (e.g. "drone-c1" or "case-1234").
 * @param onAudioDecibelChange Callback invoked when ambient microphone RMS decibels are sampled.
 */
class CameraPreviewSurface(
    context: Context,
    private val targetStreamId: String = "drone-c1",
    private val onAudioDecibelChange: (Int) -> Unit = {}
) : SurfaceView(context), SurfaceHolder.Callback {

    private var camera: Camera? = null
    private var lastFrameTime = 0L

    // Audio sampling state
    private var audioRecord: AudioRecord? = null
    @Volatile private var isRecordingAudio = false
    @Volatile private var latestAudioBase64: String? = null
    @Volatile private var latestDecibel: Int = 45

    init {
        holder.addCallback(this)
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        // Start microphone audio capture loop
        startAudioSampling()

        // Start hardware camera preview
        try {
            if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
                Camera.getNumberOfCameras() > 0) {
                camera = Camera.open()
                camera?.setPreviewDisplay(holder)
                setupPreviewCallback()
                camera?.startPreview()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            camera = null
        }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        if (holder.surface == null || camera == null) return
        try {
            camera?.stopPreview()
        } catch (e: Exception) {}

        try {
            camera?.setPreviewDisplay(holder)
            setupPreviewCallback()
            camera?.startPreview()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        // Stop audio sampling
        stopAudioSampling()

        // Stop camera
        try {
            camera?.setPreviewCallback(null)
            camera?.stopPreview()
            camera?.release()
            camera = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startAudioSampling() {
        if (isRecordingAudio) return
        if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return
        }

        val sampleRate = 16000
        val channelConfig = AudioFormat.CHANNEL_IN_MONO
        val audioFormat = AudioFormat.ENCODING_PCM_16BIT
        val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        if (minBufferSize <= 0) return

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                minBufferSize * 2
            )
            audioRecord?.startRecording()
            isRecordingAudio = true

            Thread {
                val buffer = ShortArray(minBufferSize)
                while (isRecordingAudio && audioRecord != null) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read > 0) {
                        var sum = 0.0
                        for (i in 0 until read) {
                            sum += buffer[i] * buffer[i]
                        }
                        val rms = Math.sqrt(sum / read)
                        val db = if (rms > 1.0) (20 * Math.log10(rms)).toInt().coerceIn(30, 95) else 35
                        latestDecibel = db
                        onAudioDecibelChange(db)

                        // Convert short buffer to little-endian byte array for PCM Base64 transmission
                        val byteBuf = ByteBuffer.allocate(read * 2).order(ByteOrder.LITTLE_ENDIAN)
                        for (i in 0 until read) {
                            byteBuf.putShort(buffer[i])
                        }
                        latestAudioBase64 = "data:audio/pcm;base64," + Base64.encodeToString(byteBuf.array(), Base64.NO_WRAP)
                    }
                    Thread.sleep(150)
                }
            }.apply { isDaemon = true; start() }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAudioSampling() {
        isRecordingAudio = false
        try {
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {}
    }

    private fun setupPreviewCallback() {
        camera?.setPreviewCallback { data, cam ->
            val now = System.currentTimeMillis()
            if (now - lastFrameTime > 200 && data != null) { // ~5 FPS stream
                lastFrameTime = now
                try {
                    val size = cam.parameters?.previewSize ?: return@setPreviewCallback
                    val base64 = processNv21ToJpegBase64(data, size.width, size.height)
                    if (base64 != null) {
                        val currentAudio = latestAudioBase64
                        val currentDb = latestDecibel
                        CoroutineScope(Dispatchers.IO).launch {
                            NiraiApi.sendDroneFrame(
                                droneId = targetStreamId,
                                frameBase64 = base64,
                                audioBase64 = currentAudio,
                                decibelLevel = currentDb
                            )
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    private fun processNv21ToJpegBase64(data: ByteArray, width: Int, height: Int): String? {
        return try {
            val yuvImage = YuvImage(data, ImageFormat.NV21, width, height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, width, height), 40, out)
            val imageBytes = out.toByteArray()
            "data:image/jpeg;base64," + Base64.encodeToString(imageBytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        }
    }
}
