/* 엑셀 → 반(group) 목록. 화면과 무관한 순수 로직. */
(function (g) {
  const WD = "일월화수목금토";
  const norm = s => String(s ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  const clean = s => String(s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

  /* "11월 3일,10일,17일" / "11/3, 11/10" → [{y,m,d}] (달이 줄어들면 해를 넘겨요) */
  function parseDates(text, baseYear) {
    const out = [];
    const s = String(text ?? "").normalize("NFKC");
    const re = /(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일|(\d{1,2})\s*[\/.]\s*(\d{1,2})/g;
    let t, curM = null, y = baseYear, prevM = null;
    while ((t = re.exec(s))) {
      let mm, dd;
      if (t[2]) { mm = t[1] ? +t[1] : curM; dd = +t[2]; } else { mm = +t[3]; dd = +t[4]; }
      if (!mm || !dd || mm > 12 || dd > 31) continue;
      if (prevM !== null && mm < prevM) y += 1;
      prevM = curM = mm;
      out.push({ y, m: mm, d: dd });
    }
    return out;
  }

  /* "화요일 2:10~3:20" → "화요일 2시 10분 ~ 3시 20분" */
  function formatTime(raw) {
    const hm = (h, m) => h + "시" + (+m ? " " + (+m) + "분" : "");
    return String(raw ?? "").normalize("NFKC").split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line =>
      line.replace(/(\d{1,2})\s*:\s*(\d{2})\s*~\s*(\d{1,2})\s*:\s*(\d{2})/g, (_, a, b, c, d) => hm(+a, b) + " ~ " + hm(+c, d))
          .replace(/(\d{1,2})\s*:\s*(\d{2})/g, (_, a, b) => hm(+a, b))
    ).join(" / ");
  }

  function readRows(buf) {
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rg = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const rows = [];
    for (let r = 0; r <= rg.e.r; r++) {
      const row = [];
      for (let c = 0; c <= rg.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        row[c] = cell ? String(cell.w ?? cell.v ?? "") : "";
      }
      rows.push(row);
    }
    /* 병합된 셀은 첫 칸 값을 병합 범위 전체에 채워요 */
    (ws["!merges"] || []).forEach(mg => {
      const v = (rows[mg.s.r] || [])[mg.s.c];
      for (let r = mg.s.r; r <= mg.e.r; r++) for (let c = mg.s.c; c <= mg.e.c; c++)
        if (r !== mg.s.r || c !== mg.s.c) { rows[r] = rows[r] || []; rows[r][c] = v; }
    });
    return rows;
  }

  function groupRows(rows) {
    const hi = rows.findIndex(r => r.some(c => norm(c) === "이름") && r.some(c => norm(c) === "단계"));
    if (hi < 0) throw new Error("첫 줄에서 '이름'과 '단계' 칸을 찾지 못했어요.");
    const H = rows[hi].map(norm);
    const col = k => H.findIndex(h => h === k || h.startsWith(k));
    const cNo = col("no"), cTeam = col("팀여부"), cName = col("이름"), cTime = col("수업요일"), cStage = col("단계"), cDate = col("수업일");
    const groups = []; let cur = null;
    for (const r of rows.slice(hi + 1)) {
      const name = clean(r[cName]), stage = clean(r[cStage]), dates = clean(r[cDate]);
      const no = cNo >= 0 ? clean(r[cNo]) : "";
      if (!name && !stage && !dates) continue;
      const team = cTeam >= 0 ? norm(r[cTeam]) : "";
      let same;
      if (!cur) same = false;
      else if (no) same = no === cur.no;
      else if (!stage && !dates) same = true;
      else same = !team.includes("개인");
      if (!same) { cur = { no, names: [], time: "", segs: [] }; groups.push(cur); }
      if (name && !cur.names.includes(name)) cur.names.push(name);
      if (!cur.time && cTime >= 0 && r[cTime]) cur.time = formatTime(r[cTime]);
      if (stage || dates) {
        const key = norm(stage) + "|" + norm(dates);
        if (!cur.segs.some(s => s.key === key)) cur.segs.push({ key, stage, dates });
      }
    }
    return groups.filter(g => g.segs.length);
  }

  /* 단계 이름 → 과정 번호(없으면 -1). 호수·단계 표기 차이는 느슨하게 맞춰요 */
  function matchCourse(stage, catalog) {
    const n = norm(stage);
    if (!n) return -1;
    let i = catalog.courses.findIndex(c => c.aliases.some(a => norm(a) === n) || norm(c.name) === n);
    if (i >= 0) return i;
    const loose = s => norm(s).replace(/단계/g, "").replace(/호$/, "");
    const l = loose(stage);
    return catalog.courses.findIndex(c => c.aliases.some(a => loose(a) === l) || loose(c.name) === l);
  }

  /* segs(과정+날짜) → days(달력 표시일)·sessions(차시별 카드)·기본 제목 */
  function derive(c, catalog) {
    const t = d => Date.UTC(d.y, d.m - 1, d.d);
    const multi = c.segs.length > 1, rows = [];
    c.segs.forEach(s => {
      const course = catalog.courses[s.course];
      s.dates.slice().sort((a, b) => t(a) - t(b)).forEach((d, i) => {
        const se = course && course.sessions[i];
        rows.push({ ...d, course: course ? course.name : (s.stage || "과정"), no: (i + 1) + "차시",
          label: course ? (course.label || "교과연계") : "교과연계",
          tag: se ? se.tag : "", book: se ? se.book : "", desc: se ? se.desc : "", link: se ? (se.link || "") : "" });
      });
    });
    rows.sort((a, b) => t(a) - t(b));
    const seen = new Set();
    c.sessions = rows.filter(r => { const k = t(r); if (seen.has(k)) return false; seen.add(k); return true; });
    c.sessions.forEach(r => { r.wd = WD[new Date(r.y, r.m - 1, r.d).getDay()]; r.lab = multi ? r.course + " " + r.no : r.no; });
    c.days = c.sessions.map(r => ({ y: r.y, m: r.m, d: r.d }));
    c.autoTitle = [...new Set(c.segs.map(s => catalog.courses[s.course]?.name || s.stage).filter(Boolean))].join(", ");
    c.noDates = c.segs.filter(s => !s.dates.length).map(s => s.stage);
    c.missing = c.segs.filter(s => s.course < 0).map(s => s.stage);
    return c;
  }

  /* group → 포스터 데이터 */
  function buildClass(g, year, catalog) {
    const segs = g.segs.map(s => ({ stage: s.stage, course: matchCourse(s.stage, catalog), dates: parseDates(s.dates, year) }));
    const c = { names: g.names, time: g.time, segs, titleEdited: false };
    derive(c, catalog);
    c.title = c.autoTitle;
    return c;
  }

  g.Plan = { WD, parseDates, formatTime, readRows, groupRows, buildClass, derive, matchCourse };
})(window);
