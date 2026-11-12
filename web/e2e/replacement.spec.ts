import { test, expect } from "@playwright/test";
test("public planner, real empty results, and protected wallet", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?screen=8");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByLabel("من أين؟", { exact: true }).selectOption("المعادي");
  await page.getByLabel("إلى أين؟", { exact: true }).selectOption("التجمع");
  await page.getByLabel("وقت الذهاب", { exact: true }).fill("08:15");
  await page
    .getByRole("button", { name: "ابحث عن الرحلات", exact: true })
    .click();
  await expect(page).toHaveURL(/screen=11/);
  await expect(
    page.getByText("لسه مفيش خط مناسب.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".d-result")).toHaveCount(0);
  await page.goto("/?screen=24");
  await expect(page.getByText("سجّل برقم موبايلك عشان نكمل.")).toBeVisible();
  expect(errors).toEqual([]);
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
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/?screen=10&preview=phase2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const category of ["PRIME", "SAVER", "SPACE", "MAX"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(category) }),
      ).toBeVisible();
    }
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

test("phase two: 16 paired views, fixed offers, navigation and preview isolation", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && /supabase|auth\/v1|rest\/v1/.test(r.url()))
      mutations.push(r.url());
  });
  for (const theme of ["dark", "light"]) {
    for (const screen of [8, 10, 11, 12, 13, 14, 29, 15]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/?screen=${screen}&theme=${theme}&preview=phase2`);
      await expect(page.locator(".d-canvas h1")).not.toBeEmpty();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const clipped = await page
        .locator(".d-canvas")
        .evaluate((e) => e.scrollWidth > e.clientWidth + 1);
      expect(clipped).toBe(false);
      await page
        .locator(".d-canvas")
        .screenshot({ path: `../docs/audit/phase2-${screen}-${theme}.png` });
    }
    await page.goto(`/?screen=11&theme=${theme}&preview=phase2`);
    await expect(page.locator(".d-result")).toHaveCount(3);
    await page.getByRole("button", { name: /عرض تفاصيل كابتن محمد/ }).click();
    await expect(page).toHaveURL(/screen=12/);
    await expect(page.locator(".d-offer-facts")).toContainText("أسبوعي");
    await expect(page.locator(".d-offer-facts")).toContainText("ذهاب فقط");
    await expect(page.locator(".d-fixed-price")).toContainText("850");
    await expect(page.locator(".d-canvas button[aria-pressed]")).toHaveCount(0);
    await expect(page.locator(".d-captain,.d-vehicle")).toHaveCount(0);
    await page
      .getByRole("button", { name: "حجز الاشتراك", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("لا ينشئ حجزًا");
    await page.getByRole("button", { name: "تمام", exact: true }).click();
    await page.getByLabel("شاشة المرحلة الثانية").selectOption("10");
    await page.getByRole("button", { name: /MAX/ }).click();
    await page
      .getByRole("button", { name: "عرض النتائج", exact: true })
      .click();
    await expect(page.locator(".d-result")).toHaveCount(0);
    await expect(
      page.getByText("لسه مفيش خط مناسب.", { exact: true }),
    ).toBeVisible();
    await page.goto(`/?screen=14&theme=${theme}&preview=phase2`);
    await page
      .getByRole("button", {
        name: "إزالة المعادي إلى التجمع من المفضلة",
        exact: true,
      })
      .click();
    await expect(page.locator(".d-favorite")).toHaveCount(2);
    await page.goto(`/?screen=15&theme=${theme}&preview=phase2`);
    await expect(
      page.getByLabel("وقت الذهاب", { exact: true }),
    ).toHaveAttribute("type", "time");
    await page
      .getByLabel("ملاحظات إضافية", { exact: true })
      .fill("محطة قريبة من المترو");
    await page
      .getByRole("button", { name: "إرسال الطلب", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "لم يتم إرسال طلب فعلي",
    );
  }
  expect(mutations).toEqual([]);
});
