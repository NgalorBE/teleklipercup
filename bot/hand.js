const fs = require("fs");
const https = require("https");
const path = require("path");
const engine = require("../ff");
const queue = require("../que/que");
const config = require("../config");

const VIDEO_PATH = "./stor/temp/input.mp4";

let currentText = null;
let shortVideoData = null;

module.exports = function (bot) {

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      "🎬 Kirim link TikTok + teks cerita tanpa tanda - dll Cup!\Gunakan . untuk baris baru tanpa ada spasi Okok\nContoh:\nhttps://vt.tiktok.com/xxxx Cerita kamu di sini...");
  });

bot.onText(/\/lanjut/, async (msg) => {

  const chatId = msg.chat.id;

  if (msg.from.id !== config.OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu Bukan Orang Baik");
  }
  await bot.sendMessage(chatId, "👨‍💻 Ini Rucup, memulai proses..");

  if (!shortVideoData) {
    return bot.sendMessage(chatId, "❌ Tidak ada proses yang perlu dilanjutkan.");
  }

  if (queue.isRunning()) {
    return bot.sendMessage(chatId, "⏳ Masih ada proses berjalan.");
  }

  bot.sendMessage(chatId, "🔁 Melakukan loop video..");

  queue.run(async () => {
    try {

      const loopCount = Math.ceil(shortVideoData.ttsDur / shortVideoData.vidDur);

      console.log("Loop count:", loopCount);

      await engine.loopVideo(loopCount);

      console.log("🎬 Rendering ulang setelah loop..");
      const result = await engine.renderFinal();

      if (result?.status === "SHORT_VIDEO") {
        return bot.sendMessage(chatId, "❌ Masih kurang panjang. Coba video lain.");
      }

      console.log("✅ Video selesai:", engine.finalVideo);

      shortVideoData = null;

      await bot.sendVideo(chatId, engine.finalVideo);

    } catch (err) {
      console.log("❌ Error saat lanjut:", err);
      bot.sendMessage(chatId, "❌ Error saat proses lanjut.");
    }
  });

});

  bot.on("text", async (msg) => {
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    if (msg.from.id !== config.OWNER_ID) {
      return;
    }

    if (text.includes("tiktok.com")) {

    shortVideoData = null;
      const parts = text.split(" ");
      const link = parts[0];
      const story = parts.slice(1).join(" ");

      currentText = story;

      bot.sendMessage(chatId, "📥 Mengambil video dari TikTok..");

      try {
        const axios = require("axios");

        const res = await axios.post(
          "https://www.tikwm.com/api/",
          { url: link }
        );

        if (!res.data || !res.data.data) {
          return bot.sendMessage(chatId, "❌ API tidak mengembalikan data.");
        }

        const videoUrl = res.data.data.play;

        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(VIDEO_PATH);
          https.get(videoUrl, (response) => {
            response.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve();
            });
          }).on("error", reject);
        });

        bot.sendMessage(chatId, "✅ Video berhasil di download.");

        if (!story || story.length < 5) {
          return bot.sendMessage(chatId, "❌ Teks cerita terlalu pendek.");
        }

        if (queue.isRunning()) {
          return bot.sendMessage(chatId, "⏳ Masih ada proses berjalan.");
        }

        bot.sendMessage(chatId, "🧠 Memproses..");

        queue.run(async () => {
          try {

            console.log("🎤 Generate TTS..");
            await engine.generateTTS(currentText);

            console.log("📝 Generate Subtitle...");
            await engine.generateSubtitle(currentText);

            console.log("🎬 Rendering Final Video...");
const result = await engine.renderFinal();

if (result?.status === "SHORT_VIDEO") {

  shortVideoData = result;

  return bot.sendMessage(chatId,
`⚠️ Durasi video kurang!

Durasi TTS : ${engine.formatDuration(result.ttsDur)}
Durasi Video : ${engine.formatDuration(result.vidDur)}

Ketik:
/lanjut → untuk loop video
atau kirim link TikTok baru`
  );
}

console.log("✅ Video selesai:", engine.finalVideo);

await bot.sendVideo(chatId, engine.finalVideo);

          } catch (err) {
            console.log("❌ Error di queue:", err);
            bot.sendMessage(chatId, "❌ Error saat proses.");
          }
        });

      } catch (err) {
        console.log("❌ ERROR API:", err);
        bot.sendMessage(chatId, "❌ Gagal download video.");
      }

      return;
    }

    currentText = text;

    if (!fs.existsSync(VIDEO_PATH)) {
      return bot.sendMessage(chatId, "❌ Kirim link TikTok dulu.");
    }

    if (queue.isRunning()) {
      return bot.sendMessage(chatId, "⏳ Masih ada proses berjalan.");
    }

    bot.sendMessage(chatId, "🧠 Memproses...");

    queue.run(async () => {
      try {

        console.log("🎤 Generate TTS...");
        await engine.generateTTS(currentText);

        console.log("📝 Generate Subtitle...");
        await engine.generateSubtitle(currentText);

console.log("🎬 Rendering Final Video...");
const result = await engine.renderFinal();

if (result?.status === "SHORT_VIDEO") {

  shortVideoData = result;

  return bot.sendMessage(chatId,
`⚠️ Durasi video kurang!

Durasi TTS : ${engine.formatDuration(result.ttsDur)}
Durasi Video : ${engine.formatDuration(result.vidDur)}

Ketik:
/lanjut → untuk loop video
atau kirim link TikTok baru`
  );
}

console.log("✅ Video selesai:", engine.finalVideo);

await bot.sendVideo(chatId, engine.finalVideo);

      } catch (err) {
        console.log("❌ Error:", err);
        bot.sendMessage(chatId, "❌ Error saat proses.");
      }
    });

  });

};
