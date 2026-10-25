#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runCli } from "./cli/run.js";

const code = await runCli(process.argv.slice(2), {
  out: (l) => console.log(l),
  err: (l) => console.error(l),
  readStdin: () => readFileSync(0, "utf8"),
});
process.exit(code);
