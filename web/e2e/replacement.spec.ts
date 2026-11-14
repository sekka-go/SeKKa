import { publicScreen } from "../src/v2/screenMap";
import { test, expect } from "@playwright/test";
test.use({ locale: "ar-EG" });
test.beforeEach(async ({page}) => {await page.addInitScript(() => {const t=new URLSearchParams(location.search).get('theme');if(t==='dark'||t==='light')localStorage.setItem('theme_preference',t);});});
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
  await page.goto("/?screen=22");
  await expect(page.getByText("سجّل برقم موبايلك عشان نكمل.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("all 73 screen entries render without client errors for guests", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 1; i <= 73; i++) {
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
      await page.goto(
        `/?screen=${publicScreen(screen)}&theme=${theme}&inspect=1`,
      );
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
      page.getByRole("button", { name: "إنشاء كود تجريبي", exact: false }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "إنشاء كود تجريبي" }).click();
    await page.getByLabel("الرقم 1 من كود التحقق", { exact: true }).fill("1111");
    await page.getByRole("button", { name: "تحقق", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("الكود غير صحيح");
    await page
      .getByLabel("الرقم 1 من كود التحقق", { exact: true })
      .fill("1234");
    await expect(
      page.getByLabel("الرقم 4 من كود التحقق", { exact: true }),
    ).toHaveValue("4");
    await expect(
      page.getByRole("button", { name: "تحقق", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "تحقق", exact: true }).click();
    await expect(page).toHaveURL(/screen=6/);
    await page
      .getByLabel("الاسم الكامل", { exact: true })
      .fill("مستخدم تجريبي");
    await page
      .getByRole("button", { name: "متابعة للمعاينة", exact: false })
      .click();
    await expect(page).toHaveURL(/screen=7/);
    await expect(
      page.getByRole("button", { name: "تخطي ومتابعة", exact: false }),
    ).toBeEnabled();
    await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveCount(
      0,
    );
  }
  expect(authRequests).toEqual([]);
});

test("phase two: v3.1 paired views, fixed offers, navigation and preview isolation", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && /supabase|auth\/v1|rest\/v1/.test(r.url()))
      mutations.push(r.url());
  });
  for (const theme of ["dark", "light"]) {
    for (const screen of [8, 9, 10, 11, 12, 14, 15]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `/?screen=${publicScreen(screen)}&theme=${theme}&preview=phase2`,
      );
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
    await page.getByRole("button", { name: /عرض تفاصيل SAVER/ }).click();
    await expect(page).toHaveURL(/screen=12/);
    await expect(page.locator(".d-offer-facts")).toContainText("أسبوعي");
    await expect(page.locator(".d-offer-facts")).toContainText("ذهاب فقط");
    await expect(page.locator(".d-fixed-price")).toContainText("850");
    await expect(page.locator(".d-canvas button[aria-pressed]")).toHaveCount(0);
    await expect(page.locator(".d-captain,.d-vehicle")).toHaveCount(0);
    await page.getByLabel("نقطة الركوب", {exact:true}).selectOption("maadi");
    await page.getByLabel("نقطة النزول", {exact:true}).selectOption("tagamoa");
    await page
      .getByRole("button", { name: "حجز الاشتراك", exact: true })
      .click();
    await expect(page).toHaveURL(/screen=15/);
    await expect(page).toHaveURL(/preview=phase3/);
    await expect(page.locator(".b-offer-tags")).toContainText("أسبوعي");
    await expect(page.locator(".b-offer-tags")).toContainText("ذهاب فقط");
    await expect(page.locator(".b-price-summary")).toContainText("850");
    await page.goto(`/?screen=10&theme=${theme}&preview=phase2`);
    await page.getByLabel("شاشة المرحلة الثانية").selectOption("10");
    await page.getByRole("button", { name: /MAX/ }).click();
    await page
      .getByRole("button", { name: "عرض النتائج", exact: true })
      .click();
    await expect(page.locator(".d-result")).toHaveCount(0);
    await expect(
      page.getByText("لسه مفيش خط مناسب.", { exact: true }),
    ).toBeVisible();
    await page.goto(`/?screen=13&theme=${theme}&preview=phase2`);
    await page
      .getByRole("button", {
        name: "إزالة المعادي إلى التجمع من المفضلة",
        exact: true,
      })
      .click();
    await expect(page.locator(".d-favorite")).toHaveCount(2);
    await page.goto(`/?screen=14&theme=${theme}&preview=phase2`);
    await expect(page.getByRole("button", {name:"تأكيد الطلب",exact:true})).toHaveCount(0);
  }
  expect(mutations).toEqual([]);
});

test("phase three: approved seven screens, fixed quote, security and confirmations", async ({
  page,
}) => {
  test.setTimeout(90000);
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && /supabase|rest\/v1|auth\/v1/.test(r.url()))
      mutations.push(r.url());
  });
  for (const theme of ["dark", "light"]) {
    for (let screen = 16; screen <= 22; screen++) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `/?screen=${publicScreen(screen)}&theme=${theme}&preview=phase3`,
      );
      await expect(page.locator(".b-title")).not.toBeEmpty();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".b-canvas")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      await page
        .locator(".b-canvas")
        .screenshot({ path: `../docs/audit/phase3-${screen}-${theme}.png` });
    }
    await page.goto(`/?screen=15&theme=${theme}&preview=phase3`);
    await expect(page.locator(".b-price-summary")).toContainText("1,527");
    await expect(page.locator(".b-calendar")).toContainText("12 من 22");
    await expect(page.locator(".b-calendar input")).toHaveCount(0);
    await page
      .getByRole("button", { name: "متابعة لتأمين الحجز", exact: true })
      .click();
    await page.getByRole("button", { name: "غير كافي", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "معاينة تأكيد الحجز", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".b-balance-state")).toContainText("60");
    await page.getByRole("button", { name: "شحن الرصيد", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("لم يتم شحن أي مبلغ");
    await page.getByRole("button", { name: "تمام", exact: true }).click();
    await page.getByRole("button", { name: "كافي", exact: true }).click();
    await page
      .getByRole("button", { name: "معاينة تأكيد الحجز", exact: true })
      .click();
    await expect(page).toHaveURL(/screen=17/);
    await page
      .getByRole("button", { name: "شوف تفاصيل اشتراكي", exact: true })
      .click();
    await page
      .getByRole("button", { name: "تأكيد الدفع", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "معاينة متابعة الاستلام", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "دفعت للكابتن قيمة الاشتراك كاملة.",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "معاينة متابعة الاستلام", exact: true })
      .click();
    await expect(page).toHaveURL(/screen=20/);
    await expect(page.locator(".b-timeline")).toContainText("بتفضل محجوزة");
    await page
      .getByRole("button", { name: "تأكيد الطرفين", exact: true })
      .click();
    await expect(page.locator(".b-timeline")).toContainText(
      "100 ج.م رجعت للرصيد المتاح",
    );
    await page
      .getByRole("button", { name: "قيد المراجعة", exact: true })
      .click();
    await expect(page.locator(".b-callout")).toContainText(
      "مفيش مصادرة تلقائية",
    );
    await page
      .getByRole("button", { name: "محتاج مساعدة في الاشتراك؟", exact: true })
      .click();
    await page
      .getByLabel("سبب مراجعة الاشتراك", { exact: true })
      .fill("الكابتن لسه مأكّدش الاستلام");
    await page
      .getByRole("button", { name: "معاينة طلب المراجعة", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "لم يتم إرسال طلب دعم فعلي",
    );
  }
  await page.goto("/?screen=17");
  await expect(page.locator(".b-success-tag")).toHaveCount(0);
  await expect(
    page.getByText("سجّل الدخول الأول عشان تشوف اشتراكك.", { exact: true }),
  ).toBeVisible();
  expect(mutations).toEqual([]);
});

test("phase four wallet states stay isolated from money operations", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark", "light"])
    for (let screen = 24; screen <= 30; screen++) {
      await page.goto(
        `/?screen=${publicScreen(screen)}&theme=${theme}&preview=phase4`,
      );
      await expect(page.locator(".w-canvas h1")).not.toBeEmpty();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator(".w-canvas")
        .screenshot({ path: `../docs/audit/phase4-${screen}-${theme}.png` });
    }
  await page.goto("/?screen=22&preview=phase4");
  await expect(page.locator(".w-balance")).toHaveText("50 ج.م");
  await page.getByRole("button", { name: "شحن الرصيد", exact: true }).click();
  await page.getByLabel("مبلغ الشحن بالجنيه").fill("-1");
  await expect(page.getByRole("alert")).toContainText("أقل مبلغ شحن 100 جنيه");
  await expect(
    page.getByRole("button", { name: "متابعة للدفع — غير مفعّل" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "معاينة حالات الشحن" }),
  ).toBeDisabled();
  await page.getByLabel("مبلغ الشحن بالجنيه").fill("99");
  await expect(
    page.getByRole("button", { name: "معاينة حالات الشحن" }),
  ).toBeDisabled();
  await page.getByLabel("مبلغ الشحن بالجنيه").fill("100");
  await page.getByRole("button", { name: "معاينة حالات الشحن" }).click();
  await page.getByLabel("حالة الشحن التجريبية").selectOption("success");
  await expect(page.getByText("نموذج شحن ناجح")).toBeVisible();
  await page.getByRole("button", { name: "الرجوع للمحفظة" }).click();
  await expect(page.locator(".w-balance")).toHaveText("50 ج.م");
  await page
    .getByRole("button", { name: "سجل المعاملات", exact: true })
    .click();
  await page.getByLabel("نوع العملية").selectOption("reserve");
  await expect(page.locator(".w-transaction")).toHaveCount(2);
  await page.locator(".w-transaction").first().click();
  await expect(page.getByText("demo-3", { exact: true })).toBeVisible();
  await page.getByLabel("معاينة السجل الفارغ").check();
  await expect(page.getByText("لسه مفيش معاملات هنا.")).toBeVisible();
  await page.goto("/?screen=27&preview=phase4");
  await expect(page.getByText("المعادي", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "السابقة", exact: true }).click();
  await expect(page.getByText("الزمالك", { exact: true })).toBeVisible();
  await page.goto("/?screen=24");
  await expect(page.getByText("سجّل برقم موبايلك عشان نكمل.")).toBeVisible();
  expect(writes).toEqual([]);
});

test("phase five communication and account previews are isolated", async ({
  page,
}) => {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark", "light"])
    for (let screen = 31; screen <= 36; screen++) {
      await page.goto(
        `/?screen=${publicScreen(screen)}&theme=${theme}&preview=phase4`,
      );
      await expect(page.locator(".a-canvas h1")).not.toBeEmpty();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator(".a-canvas")
        .screenshot({ path: `../docs/audit/phase5-${screen}-${theme}.png` });
    }
  await page.goto("/?screen=29&preview=phase4");
  await page.getByLabel("دوّر في المحادثات").fill("كريم");
  await expect(page.locator(".a-thread")).toHaveCount(1);
  await page.locator(".a-thread").click();
  await expect(page).toHaveURL(/screen=30/);
  await expect(
    page.getByRole("button", { name: "إضافة للمعاينة" }),
  ).toBeDisabled();
  await page
    .getByLabel("رسالتك", { exact: true })
    .fill("ممكن تفاصيل نقطة الالتقاء؟");
  await page.getByRole("button", { name: "إضافة للمعاينة" }).click();
  await expect(page.locator(".a-bubble.mine")).toContainText(
    "ممكن تفاصيل نقطة الالتقاء؟",
  );
  await expect(page.getByRole("status")).toContainText("ماتبعتتش");
  await page.getByLabel("شاشة المرحلة الرابعة").selectOption("33");
  await page.getByRole("button", { name: "غير المقروءة", exact: true }).click();
  await page
    .getByRole("button", { name: "اعتباره مقروءًا في المعاينة" })
    .click();
  await expect(page.getByText("مفيش إشعارات جديدة.")).toBeVisible();
  await page.getByLabel("شاشة المرحلة الرابعة").selectOption("35");
  await page.getByLabel("الاسم الكامل").fill("منى أحمد");
  await page
    .getByRole("button", { name: "حفظ في المعاينة", exact: true })
    .click();
  await page
    .getByRole("button", { name: "الرجوع لحسابي", exact: true })
    .click();
  await expect(page.locator(".a-profile h2")).toHaveText("منى أحمد");
  await page.getByLabel("شاشة المرحلة الرابعة").selectOption("36");
  await page
    .getByText("تأمين جدية الحجز ده مقابل إيه؟", { exact: true })
    .click();
  await expect(
    page.getByText(
      "هو مبلغ مسترد 100 جنيه، منفصل عن سعر الاشتراك. بيتاح بعد تأكيد الدفع والاستلام من الطرفين، لو مفيش نزاع.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("قولنا نساعدك إزاي؟")
    .fill("محتاج مساعدة في تفاصيل الاشتراك");
  await page.getByRole("button", { name: "معاينة طلب المساعدة" }).click();
  await expect(page.getByRole("status")).toContainText("ماتبعتش للدعم");
  await page.goto("/?screen=29");
  await expect(page.getByText("سجّل برقم موبايلك عشان نكمل.")).toBeVisible();
  await expect(page.locator(".a-thread")).toHaveCount(0);
  await page.goto("/?screen=34");
  await expect(
    page.getByRole("button", { name: "ابعت للدعم", exact: true }),
  ).toBeDisabled();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("phase five captain onboarding validates locally without uploads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  for (const theme of ["dark", "light"])
    for (const screen of [37, 38, 40, 39, 42, 43, 76]) {
      await page.goto(
        `/?screen=${publicScreen(screen)}&theme=${theme}&preview=phase5`,
      );
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  await page.goto("/?screen=36&preview=phase5");
  await expect(
    page.getByRole("button", { name: "متابعة", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("الاسم الكامل").fill("كابتن تجريبي");
  await page.getByRole("button", { name: "متابعة", exact: true }).click();
  const upload = async () => {
    for (const input of await page.locator("input[type=file]").all())
      await input.setInputFiles({
        name: "test.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("demo only"),
      });
  };
  await page.getByLabel("موديل العربية").fill("تويوتا كورولا");
  await page.getByLabel("رقم اللوحة").fill("أ ب ج 123");
  await page.getByLabel("لون العربية").fill("أبيض");
  await page.getByRole("button", { name: /SAVER/ }).click();
  await page.getByRole("button", { name: "متابعة", exact: true }).click();
  await upload();
  await page.getByRole("button", { name: "متابعة", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "معاينة حالة الطلب" }),
  ).toBeDisabled();
  await page.getByLabel("راجعت البيانات التجريبية").check();
  await page.getByRole("button", { name: "معاينة حالة الطلب" }).click();
  await expect(
    page.getByRole("heading", { name: "مثال: طلبك قيد المراجعة" }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.goto("/?screen=38");
  await expect(page.getByText("سجّل بحساب كابتن عشان نكمل.")).toBeVisible();
});

test("canonical map has exactly 73 unique destinations and public results hide identity", async ({
  page,
}) => {
  await page.goto("/?screen=11&preview=phase2");
  await expect(page.locator(".d-result")).toHaveCount(3);
  for (const card of await page.locator(".d-result").all()) {
    await expect(card).not.toContainText(/كابتن|أحمد|محمد|كريم/);
  }
  await page.goto("/?screen=22&preview=phase4");
  await expect(page.locator("main h1")).toContainText("محفظتي");
  await page.goto("/?screen=41&preview=phase5");
  await expect(page.getByText("التفعيل مستني اعتماد الإدارة")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "إدارة خطوطي", exact: true }),
  ).toHaveCount(0);
});

test("phase seven captain operations isolate previews and confirm receipt once", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark", "light"]) {
    for (let screen = 50; screen <= 61; screen++) {
      await page.goto(`/?screen=${screen}&theme=${theme}&preview=phase7`);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.goto("/?screen=51&preview=phase7");
  await page
    .getByRole("button", { name: "تفاصيل الاشتراك", exact: true })
    .first()
    .click();
  await expect(page.locator("main h1")).toHaveText("تفاصيل اشتراك راكب");
  await page.getByRole("button", { name: "متابعة تأكيد الاستلام" }).click();
  const receive = page.getByRole("button", {
    name: "محاكاة تم الاستلام",
    exact: true,
  });
  await expect(receive).toBeDisabled();
  await page.getByLabel("أقر باستلام المبلغ الموضح").check();
  await expect(receive).toBeEnabled();
  await receive.click();
  await expect(
    page.getByText("تمت محاكاة الاستلام وتحرير التأمين في المعاينة فقط."),
  ).toBeVisible();
  await expect(receive).toBeDisabled();
  await page.getByLabel("شاشة المرحلة السابعة").selectOption("60");
  await expect(page.getByText("سجل إقرارات الاستلام")).toBeVisible();
  await expect(page.getByText("تم الإقرار باستلام")).toBeVisible();
  await page.getByLabel("شاشة المرحلة السابعة").selectOption("57");
  await page.locator(".a-thread").first().click();
  await page
    .getByLabel("رسالتك", { exact: true })
    .fill("اختبار معاينة بدون إرسال");
  await page
    .getByRole("button", { name: "إضافة للمعاينة", exact: true })
    .click();
  await expect(
    page.getByText("الرسالة في المعاينة فقط، ماتبعتتش."),
  ).toBeVisible();
  await page.getByLabel("شاشة المرحلة السابعة").selectOption("62");
  await page.getByLabel("تفاصيل المشكلة").fill("مراجعة تأكيد استلام الاشتراك");
  await page.getByRole("button", { name: "معاينة طلب الدعم" }).click();
  await expect(page.getByText("طلب الدعم اتضاف للمعاينة فقط.")).toBeVisible();
  expect(writes).toEqual([]);
  await page.goto("/?screen=50");
  await expect(
    page.getByText("سجّل بحساب كابتن عشان تشوف بيانات تشغيلك."),
  ).toBeVisible();
});

test("phase eight admin preview is responsive and mutations remain local", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"]) {
      for (let screen = 62; screen <= 73; screen++) {
        await page.goto(`/?screen=${screen}&theme=${theme}&preview=phase8`);
        await expect(page.locator("main h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
  }
  await page.goto("/?screen=65&preview=phase8");
  await page
    .getByRole("button", { name: "عرض التفاصيل", exact: true })
    .first()
    .click();
  await page.getByLabel("قرار المعاينة").selectOption("مطلوب تعديل");
  const confirm = page.getByRole("button", {
    name: "تأكيد التغيير في المعاينة",
  });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("سبب الإجراء").fill("الصورة غير واضحة — اختبار محلي");
  await confirm.click();
  await expect(page.getByRole("status")).toContainText(
    "لم يتغير أي حساب حقيقي",
  );
  await expect(page.locator(".ad-audit")).toContainText("D-301");
  await page.getByLabel("بحث السجلات").fill("غير موجود");
  await expect(page.getByText("مفيش نتائج مطابقة")).toBeVisible();
  await page.getByLabel("محاكاة صلاحية").selectOption("المالية");
  await expect(page.getByText("الصلاحية غير متاحة في المعاينة")).toBeVisible();
  await page.goto("/?screen=72&preview=phase8");
  await page.getByLabel("عنوان الرسالة", { exact: true }).fill("تحديث توضيحي");
  await page.getByLabel("المحتوى", { exact: true }).fill("رسالة للمعاينة فقط");
  await page
    .getByRole("button", { name: "معاينة الرسالة", exact: true })
    .click();
  await page.getByRole("button", { name: "حفظ مسودة في المعاينة" }).click();
  await expect(page.locator(".ad-audit")).toContainText("حفظ مسودة");
  await expect(
    page.getByRole("button", { name: "الإرسال الجماعي غير مفعّل" }),
  ).toBeDisabled();
  expect(writes).toEqual([]);
  await page.goto("/?screen=65");
  await expect(page.getByText("دخول الإدارة محمي")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "عرض التفاصيل", exact: true }),
  ).toHaveCount(0);
});
