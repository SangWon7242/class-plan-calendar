(function () {
  const $ = id => document.getElementById(id);
  const DEFAULT_FOOTER = "차시별 진행 수업은 함께 보내드린\n수업계획안을 참고해주세요~";
  const state = { classes: [], example: true, theme: "green", year: new Date().getFullYear(), footer: DEFAULT_FOOTER, rawGroups: [] };

  /* ---------- 설정 패널 ---------- */
  $("year").value = state.year;
  $("footer").value = state.footer;
  const themesBox = $("themes");
  Object.entries(Poster.THEMES).forEach(([key, th]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch"; b.setAttribute("role", "radio");
    b.setAttribute("aria-label", th.name); b.title = th.name; b.dataset.theme = key;
    b.style.background = th.swatch; b.setAttribute("aria-checked", String(key === state.theme));
    themesBox.appendChild(b);
  });
  themesBox.addEventListener("click", e => {
    const b = e.target.closest(".swatch"); if (!b) return;
    state.theme = b.dataset.theme;
    themesBox.querySelectorAll(".swatch").forEach(s => s.setAttribute("aria-checked", String(s === b)));
    redrawAll();
  });
  $("footer").addEventListener("input", e => { state.footer = e.target.value; redrawAll(); });
  $("year").addEventListener("change", e => {
    const y = parseInt(e.target.value, 10);
    if (!y) { e.target.value = state.year; return; }
    state.year = y;
    if (!state.example) rebuildFromGroups();
  });

  /* ---------- 렌더링 ---------- */
  let raf = 0;
  const opts = () => ({ theme: state.theme, footer: state.footer });
  function redraw(c) { Poster.render(c, opts(), c.canvas); }
  function redrawAll() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => state.classes.forEach(c => c.canvas && redraw(c)));
  }

  function dateSummary(c) {
    if (!c.days.length) return "수업일 없음";
    const ms = [...new Set(c.days.map(d => d.m))];
    return ms.join("·") + "월 · " + c.days.length + "회";
  }
  function fileName(c) {
    const m = c.days.length ? c.days[0].m + "월" : "";
    return (m + "_수업계획서_" + (c.names.join("_") || c.title || "반")).normalize("NFKC").replace(/[\\/:*?"<>|\s]+/g, "_") + ".png";
  }

  function cardEl(c, i) {
    const el = document.createElement("article"); el.className = "card";
    el.innerHTML =
      '<div class="poster-wrap"></div><div class="warn" hidden></div>' +
      '<div class="card-meta"><p class="names"></p><span class="dates"></span></div>' +
      '<div class="edit">' +
      '<div class="field wide"><label for="t-' + i + '">제목</label><input type="text" id="t-' + i + '" data-k="title"></div>' +
      '<div class="field wide"><label for="m-' + i + '">수업 시간</label><input type="text" id="m-' + i + '" data-k="time"></div>' +
      '</div><div class="card-actions"><button type="button" class="btn primary" data-save>이미지 저장</button></div>';
    c.canvas = document.createElement("canvas");
    c.canvas.setAttribute("role", "img");
    el.querySelector(".poster-wrap").appendChild(c.canvas);
    el.querySelector(".names").textContent = c.names.join(", ") || "예시 반";
    el.querySelector(".dates").textContent = dateSummary(c);
    if (c.noDates.length) {
      const w = el.querySelector(".warn"); w.hidden = false;
      w.textContent = "'" + c.noDates.join("', '") + "' 줄의 수업일을 읽지 못했어요. '11월 3일,10일'처럼 적어 주세요.";
    }
    el.querySelector("#t-" + i).value = c.title;
    el.querySelector("#m-" + i).value = c.time;
    c.canvas.setAttribute("aria-label", (c.title || "수업") + " 수업계획서 미리보기");
    el.addEventListener("input", e => {
      const k = e.target.dataset.k; if (!k) return;
      c[k] = e.target.value; redraw(c);
      if (k === "title") c.canvas.setAttribute("aria-label", c.title + " 수업계획서 미리보기");
    });
    el.querySelector("[data-save]").addEventListener("click", async e => {
      const b = e.currentTarget, old = b.textContent; b.disabled = true;
      try { download(await toBlob(c), fileName(c)); b.textContent = "저장했어요"; } catch (_) { b.textContent = "저장하지 못했어요"; }
      setTimeout(() => { b.textContent = old; b.disabled = false; }, 1600);
    });
    return el;
  }

  async function renderAll() {
    await Poster.loadFonts();
    const box = $("cards"); box.innerHTML = "";
    state.classes.forEach((c, i) => { box.appendChild(cardEl(c, i)); redraw(c); });
    $("stageTitle").textContent = state.example ? "예시" : "만들어진 수업계획서";
    $("stageCount").textContent = state.example ? "엑셀을 올리면 여기에 반마다 나와요" : state.classes.length + "개 반";
    $("saveAll").hidden = state.example || state.classes.length < 2;
  }

  const toBlob = c => new Promise((res, rej) => c.canvas.toBlob(b => b ? res(b) : rej(new Error("blob")), "image/png"));
  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $("saveAll").addEventListener("click", async e => {
    const btn = e.currentTarget, old = btn.textContent; btn.disabled = true; btn.textContent = "만드는 중…";
    try {
      const zip = new JSZip(), used = new Set();
      for (const c of state.classes) {
        let n = fileName(c), k = 2;
        while (used.has(n)) n = fileName(c).replace(/\.png$/, "(" + k++ + ").png");
        used.add(n); zip.file(n, await toBlob(c));
      }
      const m = state.classes.find(c => c.days.length)?.days[0].m;
      download(await zip.generateAsync({ type: "blob" }), (m ? m + "월_" : "") + "수업계획서_전체.zip");
    } finally { btn.disabled = false; btn.textContent = old; }
  });

  /* ---------- 엑셀 읽기 ---------- */
  function setStatus(msg, kind) { const s = $("status"); s.textContent = msg; s.className = "status" + (kind ? " " + kind : ""); }

  function rebuildFromGroups() {
    state.classes = state.rawGroups.map(g => Plan.buildClass(g, state.year));
    return renderAll();
  }

  async function handleFile(f) {
    if (!f) return;
    setStatus("엑셀을 읽는 중이에요…");
    try {
      const groups = Plan.groupRows(Plan.readRows(await f.arrayBuffer()));
      if (!groups.length) throw new Error("수업 정보가 있는 줄을 찾지 못했어요.");
      state.example = false; state.rawGroups = groups;
      await rebuildFromGroups();
      const nd = state.classes.filter(c => c.noDates.length).length;
      setStatus(groups.length + "개 반을 만들었어요." + (nd ? " 수업일을 못 읽은 반이 " + nd + "개 있어요." : ""), "ok");
    } catch (e) {
      setStatus("엑셀을 읽지 못했어요. " + (e.message || "") + " 양식을 확인하고 다시 올려 주세요.", "err");
    }
  }

  const fileIn = $("file"), drop = $("drop");
  fileIn.addEventListener("change", () => { handleFile(fileIn.files[0]); fileIn.value = ""; });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });

  /* ---------- 양식 내려받기 (브라우저에서 직접 만들어요) ---------- */
  $("template").addEventListener("click", () => {
    const y = state.year, mo = 11;
    const rows = [
      ["No", "팀 여부", "이름", "수업요일", "단계", "수업일", "특이사항"],
      [1, "팀", "학생A", "화요일 2:10~3:20", "과학탐탐", mo + "월 3일,10일,17일,24일", ""],
      ["", "", "학생B", "", "", "", ""],
      [2, "개인", "학생C", "수요일 3:00~4:00", "논리1", mo + "월 4일,11일,18일,25일", ""]
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [6, 8, 10, 20, 14, 26, 14].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "수업계획서_양식.xlsx");
    void y;
  });

  /* ---------- 예시 ---------- */
  const y = state.year;
  state.classes = [{
    names: [], title: "세계문화,지리", time: "목요일 4시 50분 ~ 6시 10분", noDates: [],
    days: [5, 12, 19, 26].map(d => ({ y, m: 11, d }))
  }];
  renderAll();
  window.__app = { state, handleFile };
})();
