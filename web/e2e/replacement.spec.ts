import { test, expect } from "@playwright/test";
test("public discovery, typed search, and protected wallet", async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/?screen=8");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "مشوارك اليومي منين لفين؟" }),
  ).toBeVisible();
  await page
    .getByLabel("منين؟", { exact: true })
    .pressSequentially("مدينة نصر");
  await expect(page.getByLabel("منين؟", { exact: true })).toHaveValue(
    "مدينة نصر",
  );
  await page.getByLabel("لفين؟", { exact: true }).fill("التجمع");
  await page.getByRole("button", { name: "شوف الخطوط المناسبة" }).click();
  await expect(page).toHaveURL(/screen=11/);
  await expect(
    page.getByText("لسه مفيش خط مناسب.", { exact: false }),
  ).toBeVisible();
  await page.goto("/?screen=24");
  await expect(page.getByText("سجّل برقم موبايلك عشان نكمل.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تم الدفع", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(requests.filter((u) => u.includes("__sekka-api"))).toEqual([]);
});
test("all 75 screen entries render without client errors for guests", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 1; i <= 75; i++) {
    await page.goto(`/?screen=${i}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main h2").first()).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});
test("mobile RTL and desktop have no horizontal overflow", async ({ page }) => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/?screen=8");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByText("PRIME", { exact: true })).toBeVisible();
    await expect(page.getByText("SAVER", { exact: true })).toBeVisible();
    await expect(page.getByText("SPACE", { exact: true })).toBeVisible();
    await expect(page.getByText("MAX", { exact: true })).toBeVisible();
    await page.screenshot({
      path: `../docs/audit/home-${size.width}.png`,
      fullPage: true,
    });
  }
});
