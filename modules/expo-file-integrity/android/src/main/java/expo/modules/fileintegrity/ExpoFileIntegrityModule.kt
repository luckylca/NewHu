package expo.modules.fileintegrity

import android.net.Uri
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest
import kotlin.coroutines.coroutineContext

class ExpoFileIntegrityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoFileIntegrity")

    AsyncFunction("sha256File") Coroutine { fileUri: String ->
      sha256File(fileUri)
    }
  }

  private suspend fun sha256File(fileUri: String): String = withContext(Dispatchers.IO) {
    val uri = Uri.parse(fileUri)
    require(uri.scheme == "file" && !uri.path.isNullOrBlank()) {
      "SHA-256 verification requires a local file URI"
    }

    val file = File(requireNotNull(uri.path))
    require(file.isFile) { "SHA-256 verification target is not a file" }

    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(HASH_BUFFER_BYTES)
    file.inputStream().buffered(HASH_BUFFER_BYTES).use { input ->
      while (true) {
        coroutineContext.ensureActive()
        val count = input.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }

    val hash = digest.digest()
    val hex = CharArray(hash.size * 2)
    var index = 0
    for (byte in hash) {
      val value = byte.toInt() and 0xff
      hex[index++] = HEX[value ushr 4]
      hex[index++] = HEX[value and 0x0f]
    }
    String(hex)
  }

  private companion object {
    const val HASH_BUFFER_BYTES = 64 * 1024
    const val HEX = "0123456789abcdef"
  }
}
