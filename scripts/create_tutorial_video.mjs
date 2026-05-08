import { copyFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const url = "http://localhost:8780/index.html";
const videoDir = resolve("artifacts/videos");
await mkdir(videoDir, { recursive: true });

const finalVideoPath = resolve(videoDir, `action_pipeline_tutorial_${timestamp()}.webm`);
const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: videoDir,
    size: { width: 1366, height: 768 },
  },
});
const page = await context.newPage();
const messages = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    const text = message.text();
    if (!text.includes("WebGL") && !text.includes("GPU stall") && !text.includes("CONTEXT_LOST_WEBGL")) {
      messages.push(`${message.type()}: ${text}`);
    }
  }
});
page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("#rigCanvas", { timeout: 10000 });
await page.waitForFunction(() => Boolean(window.__motionDebug), { timeout: 10000 });
await installTutorialOverlay();

await caption("动作生成流水线演示", "这段短片演示第一阶段的完整闭环：加载假人、创建骨架、创建 IK、套用走路模板、播放、验证、导出和撤销重做。", 1500);
await clickStep("#loadTestDummyButton", "第 1 步：加载测试假人", "点击“加载测试假人”，视口中会出现一个用于演示的简化角色。");
await clickStep("#createSkeletonButton", "第 2 步：创建标准人形骨架", "点击“创建人形骨架”，软件生成固定命名的 Humanoid_v1 骨架。");
await clickStep("#createIkButton", "第 3 步：创建 IK 控制器", "点击“创建 IK 控制器”，脚、手、骨盆和极向目标会出现在视口中。");
await clickStep("#applyWalkButton", "第 4 步：应用 8 姿势走路模板", "点击“应用 8 姿势走路模板”，底部时间轴会出现 8 个关键姿势。");
await clickStep("#playButton", "第 5 步：播放走路循环", "点击“播放”，骨架会按 24 FPS 在 1-24 帧时间轴内循环播放。", 1800);
await clickStep("#validateMotionButton", "第 6 步：验证动作", "点击“验证动作”，软件检查脚底滑动、膝盖翻转、循环断点和骨骼身份错误。");
await clickStep("#exportJsonButton", "第 7 步：导出动作 JSON", "点击“导出动作 JSON”，右侧文本框会生成包含骨架、IK 控制器、关键帧和验证报告的数据。");
await clickStep("#undoButton", "第 8 步：撤销", "点击“撤销”，状态回退，命令日志和重做栈会更新。");
await clickStep("#redoButton", "第 9 步：重做", "点击“重做”，恢复刚才导出的动作状态。");
await caption("演示完成", "使用时按这条流水线从左到右执行；右侧“命令接口调试”可以确认每一步命令是否成功。", 1800);

const summary = await page.evaluate(() => window.__motionDebug.getMotionStateSummary());
const rawVideoPathPromise = page.video().path();
await context.close();
await browser.close();
const rawVideoPath = await rawVideoPathPromise;
await copyFile(rawVideoPath, finalVideoPath);
const videoStat = await stat(finalVideoPath);

const result = {
  failed: messages.length > 0 || videoStat.size < 100_000,
  videoPath: finalVideoPath,
  bytes: videoStat.size,
  summary,
  browserMessages: messages,
};

console.log(JSON.stringify(result, null, 2));
if (result.failed) {
  process.exitCode = 1;
}

async function installTutorialOverlay() {
  await page.addStyleTag({
    content: `
      #tutorialCaption {
        position: fixed;
        left: 18px;
        top: 104px;
        z-index: 99999;
        width: min(520px, calc(100vw - 380px));
        padding: 12px 14px;
        border: 1px solid rgba(184, 148, 255, 0.72);
        border-radius: 8px;
        background: rgba(8, 12, 20, 0.84);
        color: #edf4ff;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
        pointer-events: none;
      }
      #tutorialCaption strong {
        display: block;
        margin-bottom: 5px;
        color: #ffffff;
        font-size: 18px;
      }
      #tutorialCaption span {
        display: block;
        color: #cfe0f5;
        font-size: 13px;
        line-height: 1.45;
      }
      #tutorialCursor {
        position: fixed;
        z-index: 100000;
        width: 22px;
        height: 22px;
        border: 3px solid #ffc84a;
        border-radius: 999px;
        background: rgba(255, 200, 74, 0.18);
        box-shadow: 0 0 0 6px rgba(255, 200, 74, 0.16);
        pointer-events: none;
        transform: translate(-50%, -50%);
        transition: left 0.34s ease, top 0.34s ease, transform 0.12s ease;
      }
      .tutorial-highlight {
        outline: 2px solid #ffc84a !important;
        box-shadow: 0 0 0 4px rgba(255, 200, 74, 0.18) !important;
      }
    `,
  });
  await page.evaluate(() => {
    const caption = document.createElement("div");
    caption.id = "tutorialCaption";
    caption.innerHTML = "<strong></strong><span></span>";
    document.body.appendChild(caption);
    const cursor = document.createElement("div");
    cursor.id = "tutorialCursor";
    cursor.style.left = "48px";
    cursor.style.top = "48px";
    document.body.appendChild(cursor);
  });
}

async function caption(title, body, holdMs = 900) {
  await page.evaluate(({ titleText, bodyText }) => {
    document.querySelector("#tutorialCaption strong").textContent = titleText;
    document.querySelector("#tutorialCaption span").textContent = bodyText;
    document.querySelectorAll(".tutorial-highlight").forEach((node) => node.classList.remove("tutorial-highlight"));
  }, { titleText: title, bodyText: body });
  await page.waitForTimeout(holdMs);
}

async function clickStep(selector, title, body, holdAfterMs = 850) {
  const target = page.locator(selector);
  await target.waitFor({ state: "visible", timeout: 12000 });
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(`Cannot locate ${selector}`);
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(({ sel, xPos, yPos, titleText, bodyText }) => {
    document.querySelector("#tutorialCaption strong").textContent = titleText;
    document.querySelector("#tutorialCaption span").textContent = bodyText;
    document.querySelectorAll(".tutorial-highlight").forEach((node) => node.classList.remove("tutorial-highlight"));
    document.querySelector(sel)?.classList.add("tutorial-highlight");
    const cursor = document.querySelector("#tutorialCursor");
    cursor.style.left = `${xPos}px`;
    cursor.style.top = `${yPos}px`;
  }, { sel: selector, xPos: x, yPos: y, titleText: title, bodyText: body });
  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    document.querySelector("#tutorialCursor").style.transform = "translate(-50%, -50%) scale(0.72)";
  });
  await page.mouse.click(x, y);
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    document.querySelector("#tutorialCursor").style.transform = "translate(-50%, -50%) scale(1)";
  });
  await page.waitForTimeout(holdAfterMs);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "_");
}
