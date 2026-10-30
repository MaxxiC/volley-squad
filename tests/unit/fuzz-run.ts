// npm run test:fuzz: le partite a caso del Live in quantità. Quante: argomento o FUZZ_RUNS (di base
// 2000), es. `npm run test:fuzz -- 5000`; FUZZ_SEED=n per ripartire da un seme preciso.
import { spawnSync } from "node:child_process";

const runs = process.argv[2] ?? process.env.FUZZ_RUNS ?? "2000";
const res = spawnSync("npx", ["tsx", "--test", "--test-reporter=spec", "tests/unit/live-fuzz.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FUZZ_RUNS: runs },
});
process.exit(res.status ?? 1);
