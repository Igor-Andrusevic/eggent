export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
    const { ensureCronSchedulerStarted } = await import("@/lib/cron/runtime");
    await ensureCronSchedulerStarted();
  }
}
