const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const gtts = require("gtts");

class Engine {
  constructor() {
    this.voiceRaw = "./stor/voice/voice_raw.mp3";
    this.voiceFinal = "./stor/voice/voice_final.mp3";
    console.log("VoiceRaw:", this.voiceRaw);
    console.log("Exists:", fs.existsSync(this.voiceRaw));
  }

  // =========================
  // SPLIT TEXT (GOOGLE LIMIT)
  // =========================
  splitText(text, max = 180) {
    const parts = [];
    let current = "";

    text.split(" ").forEach(word => {
      if ((current + word).length > max) {
        parts.push(current.trim());
        current = "";
      }
      current += word + " ";
    });

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  // =========================
  // GENERATE TTS
  // =========================
  async generateTTS(text) {
    console.log("🎤 Generate TTS...");

    const parts = this.splitText(text, 180);
    const tempFiles = [];

    for (let i = 0; i < parts.length; i++) {
      const tempFile = `./stor/voice/part_${i}.mp3`;
      tempFiles.push(tempFile);

      await new Promise((resolve, reject) => {
        const tts = new gtts(parts[i], "id"); // Bahasa Indonesia
        tts.save(tempFile, (err) => {
          if (err) return reject(err);

          // LOG SUKSES
          const stats = fs.statSync(tempFile);
          console.log(
            `✅ Part ${i + 1}/${parts.length} berhasil dibuat: ${tempFile} (${(stats.size / 1024).toFixed(1)} KB)`
          );
          resolve();
        });
      });
    }

    // Gabungkan semua part
    const listFile = "./stor/voice/list.txt";
    fs.writeFileSync(
  listFile,
  tempFiles.map(f => `file '${path.resolve(f)}'`).join("\n")
);

    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:a libmp3lame "${this.voiceRaw}"`;
      exec(cmd, (err) => {
        if (err) return reject(err);
        const stats = fs.statSync(this.voiceRaw);
        console.log(
          `🎉 Semua part digabung menjadi: ${this.voiceRaw} (${(stats.size / 1024).toFixed(1)} KB)`
        );
        resolve();
      });
    });

    // Hapus file sementara
    tempFiles.forEach(f => fs.unlinkSync(f));
    fs.unlinkSync(listFile);

    console.log("✅ Semua part digabung ke voice_raw.mp3");
  }

  // =========================
  // ENHANCE VOICE
  // =========================
  async enhanceVoice() {
    return new Promise((resolve, reject) => {
      const filter = "asetrate=44100*0.7,atempo=1.1,aresample=44100,lowpass=f=1200";
      const command = `ffmpeg -y -i "${this.voiceRaw}" -af "${filter}" -ac 1 -ar 24000 -c:a libmp3lame "${this.voiceFinal}"`;

      console.log("🎛 FFmpeg Command:");
      console.log(command);

      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.log("❌ FFmpeg Error:", stderr);
          return reject(err);
        }
        console.log("✅ Voice enhanced success");
        resolve();
      });
    });
  }

  // =========================
  // GET DURATION
  // =========================
  getDuration(file) {
    return new Promise((resolve, reject) => {
      exec(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`,
        (err, stdout) => {
          if (err) return reject(err);
          resolve(parseFloat(stdout));
        }
      );
    });
  }

  // =========================
  // LOOP VIDEO IF NEEDED
  // =========================
  async loopVideoIfNeeded(videoPath, outputPath, targetDuration) {
    return new Promise((resolve, reject) => {
      const command = `
        ffmpeg -y -stream_loop -1 -i "${videoPath}"
        -t ${targetDuration}
        -c copy "${outputPath}"
      `;
      exec(command, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

module.exports = new Engine();
