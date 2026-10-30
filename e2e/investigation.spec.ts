import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { skipPrologue, skipIntro, offlineArsenal } from "./helpers";
import { caseFiles, locations, suspects, evidenceSpots } from "../src/investigation.js";
import { emptyArsenal } from "../src/arsenal.js";

const savedCase = (id: string) => ({ version: 1, solved: 0, flawless: 0, active: { id } });
async function seed(page: Page, id: string) {
  await page.addInitScript(data => {
    if (!localStorage.getItem("lastshot-investigation")) localStorage.setItem("lastshot-investigation", JSON.stringify(data));
  }, savedCase(id));
}
async function enter(page: Page) {
  await page.goto("/"); await skipPrologue(page); await page.locator("#investigation-start").click();
  await expect(page.locator("#investigation")).toBeVisible();
}
async function act(page: Page, selector: string, touch = false) {
  if (touch) await page.locator(selector).tap(); else await page.locator(selector).click();
}
async function gather(page: Page, touch = false) {
  for (const location of locations) {
    await act(page, `#case-locations [data-location="${location.id}"]`, touch);
    for (const spot of evidenceSpots.filter(s => s.location === location.id)) {
      await act(page, `#case-hotspots [data-evidence="${spot.id}"]`, touch);
      await expect(page.locator("#case-detail-title")).toHaveText(spot.name);
      await act(page, "#case-collect", touch);
      await expect(page.locator("#case-detail-dialog")).not.toBeVisible();
    }
  }
}
async function verifyAlibis(page: Page, file: typeof caseFiles[number], touch = false) {
  for (const person of suspects) {
    await act(page, `#case-locations [data-location="${person.location}"]`, touch);
    await act(page, `#case-witness [data-person="${person.id}"]`, touch);
    await expect(page.locator("#case-detail-text")).toContainText(file.testimonies[person.id]);
    await page.locator("#case-proof").selectOption(file.proofs[person.id][0]);
    await act(page, "#case-present", touch);
    await expect(page.locator("#case-detail-feedback")).toContainText(person.id === file.culprit ? "Алиби опровергнуто" : "Алиби подтверждено");
    await act(page, "#case-detail-close", touch);
  }
}
async function report(page: Page, person: string, method: string, cache: string, touch = false) {
  await page.locator("#case-accused").selectOption(person);
  await page.locator("#case-method").selectOption(method);
  await page.locator("#case-cache").selectOption(cache);
  await act(page, "#case-accuse", touch);
}

for (const [id, errors] of [["case-1", 0], ["case-3", 1], ["case-5", 2], ["case-6", 0]] as const) {
  test(`${id}: inspect, cross-check testimony and solve through native input with ${errors} accusation errors`, async ({ page }) => {
    test.setTimeout(90000); const file = caseFiles.find(f => f.id === id)!;
    const failures: string[] = []; page.on("pageerror", e => failures.push(e.message));
    await seed(page, id); await enter(page);
    const campaign = await page.evaluate(() => localStorage.getItem("lastshot-progress"));
    await page.locator("#case-notebook-open").click(); await expect(page.locator("#case-accuse")).toBeDisabled();
    await page.keyboard.press("Escape"); await expect(page.locator("#investigation")).toBeVisible();
    await gather(page); await verifyAlibis(page, file);
    await expect(page.locator("#case-progress")).toContainText("Улики 6/6 · Алиби 3/3");
    await page.screenshot({path:`test-results/investigation-${id}.png`,fullPage:true});
    await page.locator("#case-notebook-open").click(); await expect(page.locator("#case-accuse")).toBeEnabled();
    for (let i = 0; i < errors; i++) {
      await report(page, file.culprit, file.method === "key" ? "pry" : "key", file.cache);
      await expect(page.locator("#case-report-feedback")).toContainText("Судья отклонил");
    }
    await report(page, file.culprit, file.method, file.cache);
    await expect(page.locator("#case-outcome-title")).toHaveText("Дело раскрыто. Казна возвращена!");
    const reward = 1500 - 300 * errors;
    const state = await page.evaluate(() => ({ arsenal: JSON.parse(localStorage.getItem("lastshot-arsenal")!),
      record: JSON.parse(localStorage.getItem("lastshot-investigation")!), campaign: localStorage.getItem("lastshot-progress") }));
    expect(state.arsenal.balance).toBe(reward); expect(state.arsenal.stats).toEqual(emptyArsenal().stats);
    expect(state.record).toMatchObject({solved:1,flawless:errors ? 0 : 1,active:{id,phase:"won",errors}});
    expect(state.campaign).toBe(campaign);
    await page.locator("#case-notebook-open").click(); await expect(page.locator("#case-report")).toBeHidden();
    await page.keyboard.press("Escape");
    await page.locator("#case-outcome-back").click(); await expect(page.locator("#menu-wallet")).toHaveText(reward.toLocaleString("ru-RU"));
    await page.reload(); await skipPrologue(page); await page.locator("#investigation-start").click();
    await expect(page.locator("#case-outcome-title")).toContainText("Дело раскрыто");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-arsenal")!).balance)).toBe(reward);
    await page.locator("#case-new").click();
    const nextId = await page.evaluate(() => JSON.parse(localStorage.getItem("lastshot-investigation")!).active.id);
    expect(nextId).not.toBe(id); await expect(page.locator("#case-progress")).toHaveText("Улики 0/6 · Алиби 0/3 · Ошибки 0/3");
    expect(failures).toEqual([]);
  });
}

test("three false accusations close the case without payment and reveal the supported explanation", async ({ page }) => {
  test.setTimeout(90000); await seed(page,"case-2"); await enter(page);
  const file = caseFiles[1]; await gather(page); await verifyAlibis(page,file);
  await page.locator("#case-notebook-open").click();
  for (let i=0;i<3;i++) await report(page,"bell","key","bar");
  await expect(page.locator("#case-outcome-title")).toHaveText("Обвинение рассыпалось");
  await expect(page.locator("#case-outcome-text")).toContainText("Элиас Рид");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("lastshot-investigation")!))).toMatchObject({solved:0,active:{phase:"lost",errors:3}});
  expect(await page.evaluate(()=>localStorage.getItem("lastshot-arsenal"))).toBeNull();
  await page.reload(); await skipPrologue(page); await page.locator("#investigation-start").click();
  await expect(page.locator("#case-outcome-title")).toHaveText("Обвинение рассыпалось");
});

test("partial investigation persists, unrelated proof has no penalty and combat inputs never spend ammunition", async ({ page }) => {
  await seed(page,"case-4"); await enter(page);
  await page.locator('[data-evidence="lock"]').click(); await page.locator("#case-collect").click();
  await page.locator('[data-person="reed"]').click(); await page.locator("#case-proof").selectOption("lock");
  await page.locator("#case-present").click(); await expect(page.locator("#case-detail-feedback")).toContainText("не проверяет его алиби");
  await page.keyboard.press("Escape"); await expect(page.locator('[data-person="reed"]')).toBeFocused();
  for (const key of ["r","a","d","s","w"]) await page.keyboard.press(key);
  const ammo = await page.evaluate(async()=>{const {game}=await import("/src/main.ts");const s=game.scene.getScene("town") as any;s.shoot(300,300);s.reload();return s.ammo;});
  expect(ammo).toBe(6);
  await page.locator('#case-locations [data-location="street"]').click(); await page.locator("#case-back").click();
  await expect(page.locator("#investigation-best")).toContainText("ПРОДОЛЖИТЬ");
  await page.reload(); await skipPrologue(page); await page.locator("#investigation-start").click();
  await expect(page.locator("#case-location-title")).toHaveText("Городская улица");
  await expect(page.locator("#case-progress")).toHaveText("Улики 1/6 · Алиби 0/3 · Ошибки 0/3");
  await page.locator("#case-back").click(); await page.locator(".level").first().click(); await skipIntro(page);
  await expect(page.locator("#stats")).toContainText("Патроны 6/6");
  await expect(page.locator("#investigation")).toBeHidden();
  await page.locator("#back").click(); await page.locator("#telegraph-start").click(); await skipIntro(page);
  await page.keyboard.press("s"); await page.locator("#relay-interact").click(); await expect(page.locator("#relay-dialog")).toBeVisible();
});

test("offline touch investigation completes at narrow widths and reuses all local artwork without requests", async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({offline:true,isMobile:true,hasTouch:true,viewport:{width:320,height:568}});
  try {
    const page=await context.newPage(), requests:string[]=[], failures:string[]=[];
    await offlineArsenal(page,emptyArsenal());
    await page.evaluate(data=>localStorage.setItem("lastshot-investigation",JSON.stringify(data)),savedCase("case-2"));
    page.on("request",r=>requests.push(r.url())); page.on("pageerror",e=>failures.push(e.message));
    await page.setContent(await readFile("lastshot.html","utf8")); await skipPrologue(page); await page.locator("#investigation-start").tap();
    for (const [width,height] of [[280,653],[320,568],[844,390],[480,240]]) {
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      for (const location of locations) {
        await page.locator(`#case-locations [data-location="${location.id}"]`).tap();
        for (const spot of evidenceSpots.filter(s=>s.location===location.id)) {
          await page.locator(`[data-evidence="${spot.id}"]`).tap();
          await expect(page.locator("#case-detail-dialog")).toBeVisible();
          const dimensions=await page.locator("#case-detail-dialog").evaluate(d=>({width:d.scrollWidth,client:d.clientWidth}));
          expect(dimensions.width).toBeLessThanOrEqual(dimensions.client+1);
          await page.locator("#case-detail-close").tap();
        }
      }
    }
    await page.setViewportSize({width:320,height:568});
    await page.screenshot({path:"test-results/investigation-mobile.png",fullPage:true});
    await gather(page,true); await verifyAlibis(page,caseFiles[1],true);
    await page.locator("#case-notebook-open").tap();
    expect(await page.locator("#case-notebook-dialog").evaluate(d=>d.scrollWidth<=d.clientWidth+1)).toBe(true);
    await report(page,"reed","pry","wagon",true);
    await expect(page.locator("#case-outcome-title")).toContainText("Дело раскрыто");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("lastshot-arsenal")!).balance)).toBe(1500);
    expect(requests).toEqual([]); expect(failures).toEqual([]);
  } finally {await context.close();}
});

test("blocked storage still supports a complete case and keeps the single reward within this session", async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(()=>Object.defineProperty(window,"localStorage",{get(){throw Error("blocked");}}));
  await enter(page); await expect(page.locator("#case-save-note")).toContainText("Сохранение недоступно");
  const title=await page.locator("#case-title").textContent(), number=Number(title!.match(/№ (\d+)/)![1]);
  const file=caseFiles[number-1]; await gather(page); await verifyAlibis(page,file);
  await page.locator("#case-notebook-open").click(); await report(page,file.culprit,file.method,file.cache);
  await expect(page.locator("#case-outcome-reward")).toContainText("сохранение недоступно");
  await page.locator("#case-outcome-back").click(); await expect(page.locator("#menu-wallet")).toHaveText(/1\s500/);
  await page.locator("#investigation-start").click(); await page.locator("#case-outcome-back").click();
  await expect(page.locator("#menu-wallet")).toHaveText(/1\s500/);
});
