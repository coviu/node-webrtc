"use strict";

// Which objects keep the event loop alive after everything has been closed?
//
//   STEPS=pc,offer,close node test/process-exit/keepalive.js; echo "exit $?"
//
// Every wrapper that extends AsyncObjectWrapWithLoop owns a uv_async_t and
// Ref()s itself until its Stop() runs, so an object that never reaches its
// "stopped" state keeps the process alive forever and can never be collected.
// The script does its steps, prints what it did, and lets the loop drain. An
// unref'd watchdog fires only if the loop is still alive after WAIT_MS.
//
// Steps (comma separated, applied in this order):
//   track        create an RTCAudioSource and a track from it
//   video        create an RTCVideoSource and a track from it
//   pc           create an RTCPeerConnection
//   addTrack     pc.addTrack(each track)
//   transceiver  pc.addTransceiver("audio")
//   channel      pc.createDataChannel("x")
//   offer        createOffer + setLocalDescription
//   settle       wait 500 ms before closing
//   sink         attach an RTCAudioSink/RTCVideoSink to each track
//   close        pc.close()
//   stop         track.stop() on every track
//   stopsink     sink.stop() on every sink
//   gc           global.gc() (needs --expose-gc)

const fs = require("fs");
const wrtc = require("../..");

const steps = (process.env.STEPS || "pc,offer,close").split(",");
const waitMs = Number(process.env.WAIT_MS || 3000);
function has(s) {
  return steps.includes(s);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { RTCAudioSource, RTCVideoSource, RTCAudioSink, RTCVideoSink } =
    wrtc.nonstandard;
  const tracks = [];
  if (has("track")) tracks.push(new RTCAudioSource().createTrack());
  if (has("video")) tracks.push(new RTCVideoSource().createTrack());
  const pc = has("pc") ? new wrtc.RTCPeerConnection() : null;
  if (pc && has("addTrack")) tracks.forEach((t) => pc.addTrack(t));
  if (pc && has("transceiver")) pc.addTransceiver("audio");
  if (pc && has("channel")) pc.createDataChannel("x");
  if (pc && has("offer")) await pc.setLocalDescription(await pc.createOffer());
  const sinks = has("sink")
    ? tracks.map((t) =>
        t.kind === "audio" ? new RTCAudioSink(t) : new RTCVideoSink(t),
      )
    : [];
  if (has("settle")) await wait(500);
  if (pc && has("close")) pc.close();
  if (has("stop")) tracks.forEach((t) => t.stop());
  if (has("stopsink")) sinks.forEach((s) => s.stop());
  if (has("gc") && global.gc) global.gc();
  fs.writeSync(1, "DONE " + steps.join(",") + "\n");
}

setTimeout(() => {
  fs.writeSync(1, "HUNG after " + waitMs + "ms: " + steps.join(",") + "\n");
  // eslint-disable-next-line no-process-exit
  process.exit(124);
}, waitMs).unref();

main();
