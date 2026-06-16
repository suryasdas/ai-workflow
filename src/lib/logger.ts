export function workflowLog(message: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();

  if (details) {
    console.log(`[support-workflow] ${timestamp} ${message}`, details);
    return;
  }

  console.log(`[support-workflow] ${timestamp} ${message}`);
}
