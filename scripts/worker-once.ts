import "dotenv/config";
import { AnalysisWorkerService } from "../src/lib/services/analysis-worker-service";

async function main() {
  console.log("[worker] Running one worker cycle.");
  const result = await new AnalysisWorkerService().processNextAvailableJob();

  if (result.outcome === "idle") {
    console.log("[worker] No queued jobs were available.");
  } else if (result.outcome === "processed") {
    console.log(`[worker] Processed job ${result.jobId} for ticket ${result.ticketId}.`);
  } else {
    console.error(`[worker] Failed job ${result.jobId} for ticket ${result.ticketId}: ${result.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[worker] Unhandled worker error:", error);
  process.exit(1);
});
