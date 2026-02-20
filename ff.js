const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const gtts = require("gtts");

class Engine {

  constructor() {
    this.videoPath = "./stor/temp/input.mp4";
    this.outputDir = "./stor/output";
    this.voiceDir = "./stor/voice";
    this.endImage = "./stor/end.png";

    this.rawTTS = path.join(this.voiceDir, "voice_raw.mp3");
    this.ttsAudio = path.join(this.voiceDir, "voice_final.opus");
    this.subtitleFile = path.join(this.voiceDir, "subtitle.ass");
    this.finalVideo = path.join(this.outputDir, "final_cinematic.mp4");

    if (!fs.existsSync(this.outputDir))
      fs.mkdirSync(this.outputDir, { recursive: true });

    if (!fs.existsSync(this.voiceDir))
      fs.mkdirSync(this.voiceDir, { recursive: true });
  }

  runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      const ff = spawn("ffmpeg", args);
      ff.stderr.on("data", d => process.stdout.write(d));
      ff.on("close", code => code === 0 ? resolve() : reject("FFmpeg error"));
    });
  }

  format(sec){
  const h=0;
  const m=Math.floor(sec/60);
  const s=(sec%60).toFixed(2);
  return `${h}:${String(m).padStart(2,'0')}:${s.padStart(5,'0')}`;
  }

async getDuration(file) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

async getDominantColor() {

  const tempFrame = "./stor/temp/frame.jpg";

await this.runFFmpeg([
  "-y",
  "-i", this.videoPath,
  "-ss", "00:00:01",
  "-frames:v", "1",
  "-update", "1",
  tempFrame
]);

  const { Vibrant } = require("node-vibrant/node");
  const palette = await Vibrant.from(tempFrame).getPalette();

  const color = palette.Vibrant || palette.Muted;

  if (!color) return "90EE90";

  const [r, g, b] = color.rgb.map(v => Math.round(v));

  const hex =
    b.toString(16).padStart(2,"0") +
    g.toString(16).padStart(2,"0") +
    r.toString(16).padStart(2,"0");

  return hex.toUpperCase();
}

async generateTTS(text) {
  console.log("🎤 Generate TTS...");

  const sentences = text
  .split(/\n|\./)
  .map(s => s.trim())
  .filter(s => s.length > 0);

  const parts = [];

  for (let i = 0; i < sentences.length; i++) {

    const file = `${this.voiceDir}/part_${i}.mp3`;

    try {
      await new Promise((res, rej) => {
        new gtts(sentences[i], "id")
          .save(file, err => err ? rej(err) : res());
      });

      if (fs.existsSync(file)) {
        parts.push(file);
      }

    } catch (err) {
      console.log("⚠️ Gagal generate part:", i);
    }
  }

  if (parts.length === 0) {
    throw new Error("TTS gagal total, tidak ada audio part");
  }

  const listFile = `${this.voiceDir}/list.txt`;

  fs.writeFileSync(
    listFile,
    parts.map(f => `file '${path.resolve(f)}'`).join("\n")
  );

  await this.runFFmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listFile,
    "-c:a", "libmp3lame",
    this.rawTTS
  ]);

  parts.forEach(f => {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  });

  if (fs.existsSync(listFile)) {
    fs.unlinkSync(listFile);
  }

await this.runFFmpeg([
  "-y",
  "-i", this.rawTTS,
  "-af",
  "asetrate=24000*1.25,atempo=0.96,highpass=f=300,lowpass=f=3200,equalizer=f=2500:t=q:w=1:g=5",
  "-ac","1",
  "-ar","24000",
  "-c:a","libopus",
  "-b:a","256k",
  this.ttsAudio
]);

  if (fs.existsSync(this.rawTTS)) {
    fs.unlinkSync(this.rawTTS);
  }

  console.log("✅ TTS selesai");
}

async generateSubtitle(text) {
  console.log("📝 Generate Subtitle..");

  const sentences = text
    .split(/\n|\./)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const highlightColor = await this.getDominantColor();
  const totalDuration = await this.getDuration(this.ttsAudio);
  const allWords = sentences.join(" ").split(" ");
  const totalWords = allWords.length;
  const perWordGlobal = (totalDuration / totalWords);

  let currentTime = 0.15;
  let lines = [];

  sentences.forEach(sentence => {

    const words = sentence.split(" ");
    const sentenceDuration = perWordGlobal * words.length;

    let karaokeText = "";
    let wordOffset = 0;

    words.forEach(word=>{
      const k = Math.floor(perWordGlobal * 100);
      const ms = k * 10;

      const start = wordOffset;
      const end   = wordOffset + ms;

      karaokeText += `{\\k${k}` +
        `\\bord0\\blur0\\1c&HFFFFFF&` +
        `\\t(${start},${end},\\1c&H${highlightColor}&\\3c&H${highlightColor}&\\bord1\\blur4)` +
        `\\t(${end},${end+1},\\1c&HFFFFFF&\\bord0\\blur0)` +
      `}${word} `;

      wordOffset += ms;
    });

    const startTime = currentTime;
    const endTime   = currentTime + sentenceDuration;

    lines.push(
      `Dialogue: 0,${this.format(startTime)},${this.format(endTime)},Default,,0,0,0,,${karaokeText}`
    );

    currentTime = endTime;
  });

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 576
PlayResY: 1024

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Arial,35,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,40,40,200,0

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;

  fs.writeFileSync(this.subtitleFile, header + "\n" + lines.join("\n"));

  console.log("✅ Subtitle ready");
}

async boostFinalAudio() {
  console.log("🔊 HARD BOOST FINAL AUDIO...");

  const boostedOutput = this.finalVideo.replace(".mp4", "_BOOST.mp4");

  await this.runFFmpeg([
    "-y",
    "-i", this.finalVideo,
    "-filter:a",
    "volume=4.0,alimiter=limit=0.95",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "256k",
    boostedOutput
  ]);

  console.log("🔥 EXTREME BOOST READY:", boostedOutput);
}

async loopVideo(loopCount) {

  console.log("🔁 Looping video...");

  const loopedOutput = "./stor/temp/looped.mp4";

  await this.runFFmpeg([
    "-y",
    "-stream_loop", (loopCount - 1).toString(),
    "-i", this.videoPath,
    "-c", "copy",
    loopedOutput
  ]);

  this.videoPath = loopedOutput;

  console.log("✅ Loop selesai:", this.videoPath);
}

async renderFinal(){

  console.log("🎬 Checking duration...");

  const ttsDur = await this.getDuration(this.ttsAudio);
  const vidDur = await this.getDuration(this.videoPath);

  if (ttsDur > vidDur) {

    console.log("⚠️ Video lebih pendek dari TTS");

    return {
      status: "SHORT_VIDEO",
      ttsDur,
      vidDur
    };
  }

  console.log("🎬 Rendering final cinematic...");

  const duration = ttsDur;
  const imageStart = duration - 0.9;

  await this.runFFmpeg([
    "-y",
    "-i", this.videoPath,
    "-i", this.ttsAudio,
    "-i", this.endImage,
    "-t", duration.toString(),

"-filter_complex",
`[0:v]eq=contrast=1.1:brightness=-0.03:saturation=1.25,colorbalance=rs=0.08:gs=-0.02:bs=0.12,ass=${this.subtitleFile}[base];` +
`[2:v]scale=144:144,format=yuva420p,colorchannelmixer=aa=0.6[img];` +
`[base][img]overlay=x=(main_w-w)/2:y=main_h-h-50:enable='gte(t,${imageStart})'[v];` +
`[0:a]volume=1[a0];` +
`[1:a]volume=1.8[a1];` +
`[a0][a1]amix=inputs=2:duration=shortest[aout]`,

    "-map","[v]",
    "-map","[aout]",

    "-c:v","libx264",
    "-profile:v","baseline",
    "-level","3.0",
    "-pix_fmt","yuv420p",
    "-preset","veryfast",
    "-crf","23",

    "-c:a","aac",
    "-b:a","256k",

    "-movflags","+faststart",
    this.finalVideo
  ]);

await this.boostFinalAudio();

fs.readdir(this.voiceDir, (err, files) => {
  if (err) {
    console.log("Gagal baca folder:", err);
    return;
  }

  files.forEach(file => {
    if (file.endsWith(".mp3")) {
      const filePath = path.join(this.voiceDir, file);
      try {
        fs.unlinkSync(filePath);
        console.log("🗑️ Deleted:", file);
      } catch (err) {
        console.log("Gagal hapus:", file);
      }
    }
  });
});

console.log("🔥 FINAL VIDEO READY:", this.finalVideo);
}
}
module.exports = new Engine();
