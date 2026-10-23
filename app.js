const $ = (id) => document.getElementById(id);

const WORD_RE = /[A-Za-zА-Яа-яЁё0-9]+(?:-[A-Za-zА-Яа-яЁё0-9]+)*/;
const TOKEN_RE = /[A-Za-zА-Яа-яЁё0-9]+(?:-[A-Za-zА-Яа-яЁё0-9]+)*|[,.!?;:…—–]/g;

let nextTimer = 0;
let task = null; // { sentences, correct, words: [{w, comma, rule}] }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (w) => w.toLowerCase().replace(/ё/g, "е");

// Разбивает текст на слова; у каждого слова: есть ли после него запятая и что за знак стоит после.
function parse(text) {
  const tokens = text.match(TOKEN_RE) || [];
  const words = [];
  for (const tok of tokens) {
    if (WORD_RE.test(tok) && tok.match(WORD_RE)[0] === tok) {
      words.push({ w: tok, comma: false, after: "" });
    } else if (words.length) {
      const last = words[words.length - 1];
      if (tok === ",") last.comma = true;
      last.after += tok;
    }
  }
  return words;
}

let count = 3; // от 1 до 10

function pickSentences() {
  const n = count;
  const pool = SENTENCES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function newTask() {
  const sentences = pickSentences();
  const words = [];
  for (const s of sentences) {
    const ws = parse(s.t);
    let k = 0;
    for (const w of ws) if (w.comma) w.rule = s.r[k++];
    words.push(...ws);
  }
  const correct = sentences.map((s) => s.t).join(" ");
  clearTimeout(nextTimer);
  $("checkBtn").disabled = false;
  task = { sentences, correct, words, picks: new Array(words.length).fill(false), revealed: false };
  $("taskText").textContent = correct.replace(/,/g, "");
  $("answer").value = "";
  $("result").hidden = true;
  renderClick();
}

// Режим кликов: после каждого слова (кроме конца предложения) — место для запятой.
function renderClick() {
  $("clickText").innerHTML = task.words.map((w, i) => {
    const rest = w.after.replace(",", "");
    const gap = rest ? "" : `<button class="gap${task.picks[i] ? " on" : ""}" data-gap="${i}" aria-label="Запятая после «${esc(w.w)}»" aria-pressed="${task.picks[i]}">${task.picks[i] ? "," : ""}</button>`;
    return `<span class="wd">${esc(w.w)}${esc(rest)}${gap}</span>`;
  }).join(" ");
}

// Подложка переключателя «перетекает»: растягивается на обе кнопки, затем сжимается на новой.
function movePill(seg, animate) {
  const pill = seg.querySelector(".pill");
  const btn = seg.querySelector('[aria-selected="true"]');
  if (!pill || !btn) return;
  const x1 = btn.offsetLeft, w1 = btn.offsetWidth;
  const x0 = +pill.dataset.x, w0 = +pill.dataset.w;
  pill.dataset.x = x1; pill.dataset.w = w1;
  pill.style.transform = `translateX(${x1}px)`;
  pill.style.width = w1 + "px";
  if (!animate || !(w0 > 0) || x0 === x1 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const left = Math.min(x0, x1), right = Math.max(x0 + w0, x1 + w1);
  pill.animate([
    { transform: `translateX(${x0}px)`, width: w0 + "px" },
    { transform: `translateX(${x1 > x0 ? x0 : left}px)`, width: (x1 > x0 ? right - x0 : x0 + w0 - left) + "px", offset: 0.45 },
    { transform: `translateX(${x1}px)`, width: w1 + "px" }
  ], { duration: 480, easing: "cubic-bezier(.65,0,.35,1)" });
  btn.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// Мини-меню «Предложения»: список от 1 до 10.
function setCount(n) {
  count = n;
  $("countVal").textContent = n;
  $("countList").querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", +b.dataset.count === n));
  try { localStorage.setItem("commaCount", n); } catch (e) {}
}
function toggleCount(open) {
  $("countDd").classList.toggle("open", open);
  $("countBtn").setAttribute("aria-expanded", open);
  if (open) ($("countList").querySelector('[aria-selected="true"]') || $("countList").querySelector("button")).focus({ preventScroll: true });
}
$("countList").innerHTML = Array.from({ length: 10 }, (_, i) =>
  `<li style="--i:${i}"><button role="option" data-count="${i + 1}">${i + 1}</button></li>`).join("");
$("countBtn").onclick = (e) => { e.stopPropagation(); toggleCount(!$("countDd").classList.contains("open")); };
$("countList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-count]");
  if (!b) return;
  e.stopPropagation();
  setCount(+b.dataset.count);
  toggleCount(false);
  $("countBtn").focus();
  newTask();
});
$("countList").addEventListener("keydown", (e) => {
  const items = [...$("countList").querySelectorAll("button")];
  const k = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(k + 1, items.length - 1)].focus(); }
  if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(k - 1, 0)].focus(); }
});
document.addEventListener("click", (e) => { if (!e.target.closest("#countDd")) toggleCount(false); });

let mode = "write";
function setMode(m, animate) {
  mode = m;
  $("modeWrite").setAttribute("aria-selected", m === "write");
  $("modeClick").setAttribute("aria-selected", m === "click");
  movePill($("modeSeg"), animate);
  $("writeBox").hidden = m !== "write";
  $("clickBox").hidden = m !== "click";
  $("fillBtn").hidden = m !== "write";
  $("result").hidden = true;
  try { localStorage.setItem("commaMode", m); } catch (e) {}
}

function clickAnswer() {
  return task.words.map((w, i) => {
    const rest = w.after.replace(",", "");
    return { w: w.w, comma: task.picks[i], after: (task.picks[i] ? "," : "") + rest };
  });
}

// Сопоставление слов задания и слов ученика (наибольшая общая подпоследовательность).
function align(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = norm(a[i].w) === norm(b[j].w) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const map = new Array(n).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (norm(a[i].w) === norm(b[j].w)) { map[i] = j; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return map;
}

function ruleLink(id) {
  return `<a href="#" data-rule="${id}">${esc(RULES[id].title)}</a>`;
}

function check() {
  const user = mode === "click" ? clickAnswer() : parse($("answer").value);
  const res = $("result");
  res.hidden = false;

  if (!user.length) {
    res.innerHTML = `<p class="verdict bad">Неправильно</p><p>Поле пустое — перепиши текст задания и расставь запятые.</p>`;
    return;
  }

  const ref = task.words;
  const map = align(ref, user);
  const back = new Array(user.length).fill(-1);
  map.forEach((j, i) => { if (j >= 0) back[j] = i; });

  const marks = new Array(user.length).fill(null); // ok | miss | extra
  const errors = [];
  const missingWords = ref.filter((_, i) => map[i] < 0).map((w) => w.w);

  ref.forEach((w, i) => {
    const j = map[i];
    if (j < 0 || !w.comma) return;
    if (user[j].comma) marks[j] = "ok";
    else {
      marks[j] = "miss";
      errors.push({ i, type: "miss", rule: w.rule });
    }
  });
  user.forEach((w, j) => {
    const i = back[j];
    if (i < 0 || !w.comma || ref[i].comma) return;
    marks[j] = "extra";
    errors.push({ i, type: "extra" });
  });
  errors.sort((a, b) => a.i - b.i);

  // Текст ученика с пометками
  let marked = "";
  user.forEach((w, j) => {
    marked += esc(w.w);
    const rest = w.after.replace(",", "");
    if (marks[j] === "ok") marked += `<span class="c-ok">,</span>`;
    else if (marks[j] === "miss") marked += `<span class="c-miss" title="Здесь нужна запятая">,</span>`;
    else if (marks[j] === "extra") marked += `<span class="c-extra" title="Лишняя запятая">,</span>`;
    else if (w.comma) marked += ",";
    marked += esc(rest) + " ";
  });

  const ctx = (i) => {
    const a = ref[i].w, b = ref[i + 1] ? ref[i + 1].w : "";
    return `<q>${esc(a)} _ ${esc(b)}</q>`;
  };

  // В режиме кликов подсвечиваем запятые прямо в тексте
  if (mode === "click") {
    $("clickText").querySelectorAll("[data-gap]").forEach((g) => {
      g.classList.remove("g-ok", "g-miss", "g-extra");
      if (marks[+g.dataset.gap]) g.classList.add("g-" + marks[+g.dataset.gap]);
    });
  }

  let html = "";
  const solved = !errors.length && !missingWords.length;
  if (solved) {
    html += `<p class="verdict ok">Правильно! Все запятые на месте.</p>`;
    if (task.revealed) html += `<p class="note">Ответ не засчитан — ты смотрел(а) правильный ответ.</p>`;
    else bumpScore();
    html += `<p class="note">Новый текст через 2 секунды…</p><div class="next-bar"><i></i></div>`;
    $("checkBtn").disabled = true;
    nextTimer = setTimeout(newTask, 2000);
  } else if (!errors.length) {
    html += `<p class="verdict ok">Запятые верно!</p>`;
  } else {
    html += `<p class="verdict bad">Неправильно</p>`;
  }

  if (missingWords.length) {
    html += `<div class="warn">Некоторые слова отличаются от задания или пропущены: <b>${esc(missingWords.slice(0, 8).join(", "))}${missingWords.length > 8 ? "…" : ""}</b>. Проверь, что текст переписан точно — иначе часть запятых не проверить.</div>`;
  }

  html += `<div class="marked">${marked}</div>`;
  if (errors.length) {
    html += `<p class="legend"><span class="c-miss">,</span> — пропущена &nbsp; <span class="c-extra">,</span> — лишняя &nbsp; <span class="c-ok">,</span> — верно</p>`;
    html += `<ul class="errors">` + errors.map((e) => {
      if (e.type === "miss") {
        return `<li><div class="where">Неправильно: ${ctx(e.i)} — здесь нужна запятая после «${esc(ref[e.i].w)}».</div>
          <div class="rule">Правило: ${ruleLink(e.rule)}. ${esc(RULES[e.rule].text.split(". ")[0])}.</div></li>`;
      }
      return `<li><div class="where">Неправильно: ${ctx(e.i)} — здесь запятая не нужна.</div>
        <div class="rule">Смотри: ${ruleLink("none")}.</div></li>`;
    }).join("") + `</ul>`;
  }
  res.innerHTML = html;
  res.scrollIntoView({ behavior: "smooth", block: "start" });
}

function askShowAnswer() {
  if (task.revealed) return showAnswer();
  const dlg = $("confirmDlg");
  if (typeof dlg.showModal === "function") dlg.showModal();
  else if (confirm("Если вы подтвердите, то ответ не будет засчитан.")) showAnswer();
}
$("confirmYes").onclick = () => { $("confirmDlg").close(); showAnswer(); };
$("confirmNo").onclick = () => $("confirmDlg").close();
$("confirmDlg").addEventListener("click", (e) => { if (e.target === $("confirmDlg")) $("confirmDlg").close(); });

function showAnswer() {
  task.revealed = true;
  const res = $("result");
  res.hidden = false;
  const html = task.sentences.map((s) => {
    let k = 0;
    return esc(s.t).replace(/,/g, () => `<b title="${esc(RULES[s.r[k++]].title)}">,</b>`);
  }).join(" ");
  const used = [...new Set(task.sentences.flatMap((s) => s.r))];
  res.innerHTML = `<p class="verdict">Правильный ответ</p><div class="answer-text">${html}</div>
    <p class="legend" style="margin-top:12px">Правила в этом тексте: ${used.map(ruleLink).join(", ")}</p>`;
}

// Счёт
function bumpScore() {
  let n = 0;
  try { n = +localStorage.getItem("commaScore") || 0; n++; localStorage.setItem("commaScore", n); } catch (e) { n = (+$("score").dataset.n || 0) + 1; }
  $("score").dataset.n = n;
  $("score").textContent = "✓ " + n;
}
try { $("score").textContent = "✓ " + (+localStorage.getItem("commaScore") || 0); } catch (e) {}

// Выдвижное меню с правилами
function renderRules() {
  $("rulesList").innerHTML = Object.entries(RULES).map(([id, r]) => `
    <div class="rule-item" id="rule-${id}">
      <h3>${esc(r.title)}</h3>
      ${r.text.split("\n").map((p) => `<p>${esc(p)}</p>`).join("")}
      <p class="ex">${esc(r.ex).replace(/,/g, "<b>,</b>")}</p>
    </div>`).join("");
}
function openDrawer(ruleId) {
  $("drawer").classList.add("open");
  $("drawer").setAttribute("aria-hidden", "false");
  $("menuBtn").setAttribute("aria-expanded", "true");
  $("overlay").hidden = false;
  requestAnimationFrame(() => $("overlay").classList.add("show"));
  if (ruleId) {
    const el = $("rule-" + ruleId);
    el.scrollIntoView({ block: "start" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }
}
function closeDrawer() {
  $("drawer").classList.remove("open");
  $("drawer").setAttribute("aria-hidden", "true");
  $("menuBtn").setAttribute("aria-expanded", "false");
  $("overlay").classList.remove("show");
  setTimeout(() => { $("overlay").hidden = true; }, 250);
}

$("menuBtn").onclick = () => ($("drawer").classList.contains("open") ? closeDrawer() : openDrawer());
$("closeBtn").onclick = closeDrawer;
$("overlay").onclick = closeDrawer;
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if ($("countDd").classList.contains("open")) { toggleCount(false); $("countBtn").focus(); }
  else closeDrawer();
});
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-rule]");
  if (a) { e.preventDefault(); openDrawer(a.dataset.rule); return; }
  const g = e.target.closest("[data-gap]");
  if (g) {
    const i = +g.dataset.gap;
    task.picks[i] = !task.picks[i];
    g.classList.toggle("on", task.picks[i]);
    g.textContent = task.picks[i] ? "," : "";
    g.setAttribute("aria-pressed", task.picks[i]);
    g.classList.remove("g-ok", "g-miss", "g-extra");
  }
});
$("modeWrite").onclick = () => setMode("write", true);
$("modeClick").onclick = () => setMode("click", true);
const syncPills = () => movePill($("modeSeg"), false);
window.addEventListener("resize", syncPills);
if (document.fonts) document.fonts.ready.then(syncPills);

$("checkBtn").onclick = check;
$("showBtn").onclick = askShowAnswer;
$("newBtn").onclick = newTask;
$("fillBtn").onclick = () => { $("answer").value = $("taskText").textContent; $("answer").focus(); };
$("answer").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) check(); });

renderRules();
let savedCount = 3;
try { savedCount = Math.min(10, Math.max(1, Math.floor(+localStorage.getItem("commaCount") || 3))); } catch (e) {}
setCount(savedCount);
newTask();
let savedMode = "write";
try { savedMode = localStorage.getItem("commaMode") === "click" ? "click" : "write"; } catch (e) {}
setMode(savedMode);
