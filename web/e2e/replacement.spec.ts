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
    await expect(page.locator("main h1, main h2").first()).not.toBeEmpty();
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
    await expect(page.getByRole("button", { name: /^PRIME / })).toBeVisible();
    await expect(page.getByRole("button", { name: /^SAVER / })).toBeVisible();
    await expect(page.getByRole("button", { name: /^SPACE / })).toBeVisible();
    await expect(page.getByRole("button", { name: /^MAX / })).toBeVisible();
    await page.screenshot({
      path: `../docs/audit/home-${size.width}.png`,
      fullPage: true,
    });
  }
});

test("phase one: all seven paired designs render and auth stays disconnected", async ({
  page,
}) => {
  const authRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/auth\/v1\//.test(request.url())) authRequests.push(request.url());
  });
  for (const theme of ["dark", "light"]) {
    for (let screen = 1; screen <= 7; screen++) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/?screen=${screen}&theme=${theme}&inspect=1`);
      await expect(page.locator(".phase-canvas")).toBeVisible();
      await expect(page.locator(".phase-canvas h1")).not.toBeEmpty();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator(".phase-canvas")
        .screenshot({ path: `../docs/audit/phase1-${screen}-${theme}.png` });
    }
    await page.goto(`/?screen=3&theme=${theme}&inspect=1`);
    await page.getByRole("radio", { name: "كابتن", exact: false }).click();
    await expect(
      page.getByRole("radio", { name: "كابتن", exact: false }),
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "متابعة", exact: false }).click();
    await expect(
      page.getByLabel("رقم الموبايل", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("رقم الموبايل", { exact: true }).fill("01012345678");
    await expect(
      page.getByRole("button", { name: "إرسال كود التحقق", exact: false }),
    ).toBeDisabled();
    await page.goto(`/?screen=5&theme=${theme}&inspect=1`);
    await page
      .getByLabel("الرقم 1 من كود التحقق", { exact: true })
      .fill("1234");
    await expect(
      page.getByLabel("الرقم 4 من كود التحقق", { exact: true }),
    ).toHaveValue("4");
    await expect(
      page.getByRole("button", { name: "تحقق", exact: true }),
    ).toBeDisabled();
    await page.goto(`/?screen=7&theme=${theme}&inspect=1`);
    await page.getByLabel("كلمة المرور", { exact: true }).fill("preview-only");
    await page
      .getByRole("button", { name: "إظهار كلمة المرور", exact: true })
      .click();
    await expect(
      page.getByLabel("كلمة المرور", { exact: true }),
    ).toHaveAttribute("type", "text");
    await expect(
      page.getByRole("button", { name: "إنشاء حساب", exact: false }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "متابعة بجوجل", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "متابعة بفيسبوك", exact: true }),
    ).toBeDisabled();
  }
  expect(authRequests).toEqual([]);
});
