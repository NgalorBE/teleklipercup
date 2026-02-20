require("dotenv").config();

module.exports = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  OWNER_ID: Number(process.env.OWNER_ID), // tambahkan ini

  STORAGE: {
    TEMP: "./stor/temp",
    OUTPUT: "./stor/output"
  },

  LIMITS: {
    MAX_VIDEO_MB: 100,
    MAX_TEXT_LENGTH: 5000
  }
};
