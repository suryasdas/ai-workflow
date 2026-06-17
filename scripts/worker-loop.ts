import "dotenv/config";
import { AnalysisWorkerService } from "../src/lib/services/analysis-worker-service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const service = new AnalysisWorkerService();
  const pollIntervalMs = 2000;

  console.log(`[worker] Starting analysis worker loop. Poll interval: ${pollIntervalMs}ms`);

  while (true) {
    const result = await service.processNextAvailableJob();

    if (result.outcome === "idle") {
      console.log(`[worker] Sleeping for ${pollIntervalMs}ms before the next poll.`);
      await sleep(pollIntervalMs);
    }
  }
}

main().catch((error) => {
  console.error("[worker] Unhandled worker loop error:", error);
  process.exit(1);
});
