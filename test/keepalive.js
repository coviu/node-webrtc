"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const test = require("tape");

const script = path.join(__dirname, "process-exit", "keepalive.js");

// Each case runs test/process-exit/keepalive.js in a child process with the
// given STEPS and asserts that the child exits on its own once everything it
// created has been stopped or closed. The child prints HUNG and exits 124 if
// the event loop is still alive after three seconds.
//
// A segfault at exit (see test/process-exit.js) also counts as "exited" here:
// this test is only about whether the loop drains.
const cases = [
  {
    name: "control: stopped track and closed peer connection",
    steps: "track,pc,addTrack,offer,close,stop",
    expectExit: true,
  },
  {
    name: "a sink whose track has been stopped",
    steps: "track,sink,stop",
    expectExit: true,
  },
  {
    name: "a video sink whose track has been stopped",
    steps: "video,sink,stop",
    expectExit: true,
  },
  {
    name: "an unstopped local track that is unreachable from JavaScript",
    steps: "track,gc",
    expectExit: true,
  },
  {
    name: "an unstopped local track after its peer connection closed",
    steps: "track,pc,addTrack,offer,close",
    expectExit: true,
  },
];

cases.forEach(function (c) {
  test("process exits with " + c.name, function (t) {
    const result = spawnSync(process.execPath, ["--expose-gc", script], {
      env: Object.assign({}, process.env, { STEPS: c.steps }),
      encoding: "utf8",
      timeout: 30000,
    });
    const lastLine = result.stdout.trim().split("\n").pop();
    const hung = result.status === 124 || /^HUNG/.test(lastLine);
    t.equal(
      hung,
      !c.expectExit,
      "STEPS=" + c.steps + " -> " + (hung ? "loop still alive" : "exited"),
    );
    t.end();
  });
});
