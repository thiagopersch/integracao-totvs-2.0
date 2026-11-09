import type { Page, TestInfo } from "@playwright/test"

/** Chrome DevTools "Slow 4G" + 4× CPU slowdown, applied only in the mobile-slow project. */
export async function applyThrottling(page: Page, testInfo: TestInfo) {
  if (!testInfo.project.metadata?.throttle) return
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
}

/** Largest Contentful Paint of the current page, in ms (0 when the browser reported none). */
export async function measureLcp(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let lcp = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime)
        }).observe({ type: "largest-contentful-paint", buffered: true })
        setTimeout(() => resolve(lcp), 500)
      })
  )
}

/** True when the page scrolls sideways (broken mobile layout). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}
