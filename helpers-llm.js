require("dotenv").config();
const b = require("blessed"),
  fs = require("fs"),
  path = require("path"),
  m = require("gray-matter"),
  chokidar = require("chokidar"),
  diff = require("diff");
const LLMHelper = require("./helpers-llm");

const d = process.env.DRAFTS_DIR,
  s = b.screen({ smartCSR: true }),
  main = b.box({ parent: s, top: 0, left: 0, width: "100%", height: "100%" }),
  title = b.text({
    parent: main,
    top: 0,
    left: "center",
    content: "Draft Assistant",
  }),
  status = b.text({ parent: main, bottom: 0, left: 0, right: 0, height: 1 }),
  draftList = b.list({
    parent: main,
    top: 2,
    left: 0,
    width: "100%",
    height: "100%-3",
    keys: true,
    vi: true,
    mouse: true,
    items: [],
    style: { selected: { inverse: true } },
  }),
  content = b.box({
    parent: main,
    top: 2,
    left: 0,
    width: "100%",
    height: "100%-3",
    hidden: true,
    content: "",
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    wrap: true,
    tags: true,
  });

const gdi = (f) => {
    try {
      const c = fs.readFileSync(path.join(d, f), "utf-8"),
        { data, content: body } = m(c);
      return {
        f,
        dek: data.dek || "No dek",
        mt: fs.statSync(path.join(d, f)).mtime,
        content: body,
        wc: body.split(/\s+/).length,
        hc: body.split("\n").filter((l) => l.startsWith("#")).length,
        ...data,
      };
    } catch (e) {
      return null;
    }
  },
  ft = (t) =>
    t
      .replace(/\*\*(.*?)\*\*/g, "{bold}$1{/bold}")
      .replace(/\*(.*?)\*/g, "{italic}$1{/italic}")
      .replace(/`(.*?)`/g, "{underline}$1{/underline}")
      .replace(/^# (.*$)/gm, "{bold}$1{/bold}")
      .replace(/^## (.*$)/gm, "{bold}$1{/bold}")
      .replace(/^### (.*$)/gm, "{bold}$1{/bold}");

let dDrafts = [],
  cDraft,
  vInd = "|",
  editCount = 0;

const uVI = () => {
    vInd = ["|", "/", "-", "\\"][(["|", "/", "-", "\\"].indexOf(vInd) + 1) % 4];
    uStatus();
  },
  uStatus = () => {
    status.setContent(
      `${vInd} ${
        cDraft ? `${cDraft.f} (${cDraft.wc} words)` : "No draft"
      } | Edits: ${editCount} | ↑↓/jk:Nav | Enter:Select | z:Zoom | q:Quit`
    );
    s.render();
  },
  ld = () => {
    try {
      const a = fs
        .readdirSync(d)
        .filter((f) => f.endsWith(".md") && !f.startsWith("!"))
        .map(gdi)
        .filter((d) => d !== null)
        .sort((a, b) => b.mt - a.mt);
      dDrafts = [
        ...a.slice(0, 3),
        ...a
          .slice(3)
          .sort(() => 0.5 - Math.random())
          .slice(0, 2),
        ...a.slice(3),
      ];
      draftList.setItems(
        dDrafts.map(
          (d, i) =>
            `${i < 3 ? "▶" : i < 5 ? "?" : "✧"} ${d.f} - ${d.dek} (${
              d.wc
            } words, ${d.hc} headers)`
        )
      );
      if (!cDraft) {
        draftList.select(0);
        draftList.focus();
        draftList.show();
        content.hide();
      }
      uStatus();
    } catch (e) {
      status.setContent(`Error: ${e.message}`);
    }
  },
  gt = async (d) => {
    content.setContent("Analyzing...");
    draftList.hide();
    content.show();
    content.focus();
    s.render();
    try {
      const completion = await LLMHelper.createChatCompletion([
        { role: "user", content: `Analyze:\n\n${d.content}` },
      ]);
      content.setContent(ft(completion.content));
      s.render();
    } catch (e) {
      content.setContent(`Error: ${e.message}`);
    }
    uStatus();
  };

setInterval(uVI, 250);
ld();

chokidar
  .watch(d, { ignored: /(^|[\/\\])\../, persistent: true })
  .on("change", (p) => {
    const newDraft = gdi(path.basename(p));
    if (cDraft && cDraft.f === path.basename(p)) {
      editCount++;
      cDraft = newDraft;
      if (content.visible) gt(cDraft);
    }
    ld();
  });

draftList.on("select", (_, i) => {
  cDraft = dDrafts[i];
  gt(cDraft);
});

s.key(["escape", "q"], () => process.exit(0));
s.key(["b"], () => {
  cDraft = null;
  content.hide();
  draftList.show();
  draftList.focus();
  uStatus();
});
s.key(["z"], () => {
  if (draftList.visible) {
    const d = dDrafts[draftList.selected];
    if (d) {
      const m = Object.entries(d)
        .filter(([k]) => !["f", "content", "mt"].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      content.setContent(m);
      draftList.hide();
      content.show();
      uStatus();
    }
  }
});
s.key(["j"], () => {
  draftList.down(1);
  s.render();
});
s.key(["k"], () => {
  draftList.up(1);
  s.render();
});

s.render();
