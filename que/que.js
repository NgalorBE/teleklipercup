class SimpleQueue {
  constructor() {
    this.running = false;
  }

  async run(job) {
    if (this.running) {
      console.log("⏳ Masih proses sebelumnya...");
      return false;
    }

    this.running = true;

    try {
      await job();
    } catch (err) {
      console.log("Queue Error:", err);
    }

    this.running = false;
    return true;
  }

  isRunning() {
    return this.running;
  }
}

module.exports = new SimpleQueue();
