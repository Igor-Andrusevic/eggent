export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureCronSchedulerStarted } = await import("@/lib/cron/runtime");
    await ensureCronSchedulerStarted();
  }
}
