const readline = require("readline");
require("dotenv").config();

const RUN_KEY = process.env.RUN_KEY || "NGALORAja9";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Masukkan key untuk menjalankan bot: ", (input) => {

  if (input !== RUN_KEY) {
    console.log("❌ Key salah. Bot dihentikan.");
    process.exit(1);
  }

  console.log("✅ Key benar. Memulai bot...\n");
  rl.close();

  startBot();
});

function startBot() {
  const TelegramBot = require("node-telegram-bot-api");
  const config = require("./config");
  const handlers = require("./bot/hand");

  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
    polling: true
  });

  console.log("🤖 Bot is running...");

  handlers(bot);
}
