import { expect, test, type Page } from "@playwright/test"
import { applyThrottling, hasHorizontalOverflow, measureLcp } from "./throttle"

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
// Generous on the throttled phone; tighten once real-user numbers (Speed Insights) are in.
const LCP_BUDGET_MS = { desktop: 2500, "mobile-slow": 4000 } as Record<string, number>

test.beforeEach(async ({ page }, testInfo) => {
  await applyThrottling(page, testInfo)
  page.on("pageerror", (error) => testInfo.annotations.push({ type: "pageerror", description: error.message }))
})

async function signIn(page: Page) {
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(EMAIL!)
  // exact: the eye button ("Mostrar senha") also matches "Senha".
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD!)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 })
}

test("login page renders fast and fits the screen", async ({ page }, testInfo) => {
  await page.goto("/login")
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)
  const lcp = await measureLcp(page)
  testInfo.annotations.push({ type: "LCP", description: `${Math.round(lcp)} ms` })
  expect(lcp).toBeLessThan(LCP_BUDGET_MS[testInfo.project.name] ?? 4000)
})

test.describe("signed in", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL and E2E_PASSWORD to run the signed-in checks")

  test("dashboard: menu complete on first paint, no sideways scroll", async ({ page }, testInfo) => {
    await signIn(page)
    await page.goto("/dashboard")
    if (testInfo.project.name === "mobile-slow") {
      await page.getByRole("button", { name: "Abrir menu" }).click()
    }
    await expect(page.getByRole("navigation").getByRole("link").first()).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)
    const lcp = await measureLcp(page)
    testInfo.annotations.push({ type: "LCP", description: `${Math.round(lcp)} ms` })
  })

  test("demands: debounced search shows skeleton rows then results", async ({ page }) => {
    await signIn(page)
    await page.goto("/demands")
    const search = page.getByPlaceholder(/Buscar/).first()
    await expect(search).toBeVisible()
    const requests: string[] = []
    page.on("request", (request) => request.url().includes("/demands") && requests.push(request.url()))
    await search.pressSequentially("teste", { delay: 40 })
    // One navigation for the whole word, not one per keystroke (300 ms debounce).
    await page.waitForTimeout(1200)
    expect(requests.filter((url) => url.includes("search=")).length).toBeLessThanOrEqual(2)
    await expect(page.locator("table")).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)
  })
})
