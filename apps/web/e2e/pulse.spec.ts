// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import JSZip from "jszip";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Mật khẩu quản trị").fill("e2e-pass");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/pulse/);
}

async function answerAll(request: APIRequestContext, url: string, scale: number, supp: number) {
  const token = url.split("/").pop()!;
  const q = await (await request.get(`/api/pulse/survey/${token}`)).json();
  const answers = Object.fromEntries(q.questions.map((x: { id: string; type: string; options?: { value: number }[] }) => [x.id, x.type === "supp" ? (x.options!.find((o) => o.value === supp) ? supp : x.options![0].value) : scale]));
  const r = await request.post(`/api/pulse/survey/${token}`, { data: { answers } });
  expect(r.status()).toBe(201);
}

test("gate: /pulse redirects to login; survey link works without login", async ({ page }) => {
  await page.goto("/pulse");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/pulse/s/not-a-token");
  await expect(page.getByText("hết hạn")).toBeVisible();
});

test("full round: organisation → links → answers → close → radar → prescriptions → kit", async ({ page, request }) => {
  await login(page);
  await page.goto("/pulse/new");
  await page.getByLabel("Tên tổ chức").fill("Công ty E2E");
  await page.getByLabel(/Mã ngắn/).fill("e2e");
  await page.getByLabel("Ngành").fill("retail");
  await page.getByLabel(/Phòng ban/).fill("cskh, Chăm sóc khách hàng\nkd, Kinh doanh");
  await page.getByLabel(/Quy trình lõi/).fill("Xử lý yêu cầu khách hàng");
  await page.getByRole("button", { name: "Mở đợt đo" }).click();
  await expect(page).toHaveURL(/\/pulse\/a\//);
  const id = page.url().split("/").pop()!;

  // survey page renders one question per screen on this device
  const links = (await (await page.request.get(`/api/pulse/assessments/${id}`)).json()).links as { tier: string; url: string }[];
  await page.goto(links.find((l) => l.tier === "staff")!.url);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByText(/Câu 1\//)).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.documentElement.clientWidth));

  // answer via API for all three tiers, then close
  await answerAll(page.request, links.find((l) => l.tier === "executive")!.url, 4, 1);
  await answerAll(page.request, links.find((l) => l.tier === "manager")!.url, 3, 0.66);
  await answerAll(page.request, links.find((l) => l.tier === "staff")!.url, 2, 0.33);
  await page.goto(`/pulse/a/${id}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Chốt đợt đo" }).click();
  await expect(page.getByText("Radar HPDI")).toBeVisible();
  await expect(page.getByText(/Mức DTI \d\/5/)).toBeVisible();

  // the closed round refuses new answers
  const late = await page.request.post(`/api/pulse/survey/${links[0].url.split("/").pop()}`, { data: { answers: {} } });
  expect(late.status()).toBe(410);

  // prescriptions
  await page.getByRole("link", { name: "Kê đơn" }).click();
  await expect(page.getByText("Lộ trình P → D → I")).toBeVisible();
  await expect(page.getByText(/Ma trận 5 RÕ: Xử lý yêu cầu khách hàng/)).toBeVisible();

  // kit
  await page.goto(`/pulse/a/${id}/kit`);
  await page.getByLabel(/Dự án đang chạy/).fill("Website mới");
  await page.getByRole("button", { name: "Tạo bộ kỷ luật" }).click();
  await expect(page.getByText("Đã tạo bộ kỷ luật.")).toBeVisible();
  const zip = await JSZip.loadAsync(await (await page.request.get(`/api/pulse/assessments/${id}/kit`)).body());
  expect(Object.keys(zip.files)).toContain("[E2E] DX-OS/1. [P] PROJECTS/Website mới/README.md");
  expect(Object.keys(zip.files)).toContain("[E2E] DX-OS/3. [R] RESOURCES/40. ASSETS/41. Structured_Data/README.md");

  // latest for the interview stage
  const latest = await (await page.request.get("/api/pulse/latest")).json();
  expect(latest.maturity.assessment_id).toBe(id);
  expect(["spear", "kite", "illusion", "diamond", "transitional"]).toContain(latest.maturity.shape);
});
