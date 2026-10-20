/* 과정 데이터(차시별 수업 계획)를 엑셀로 내보내고, 새 달 엑셀을 올려 교체해요. */
(function (g) {
  const KEY = "class-plan-catalog-v1";
  const HEAD = ["구분", "과정명", "정식 이름", "엑셀 표기(쉼표로 구분)", "교과연계 라벨", "차시", "수업 주제", "필독서", "한 줄 소개", "교과연계"];
  const KIND = { monthly: "월간", series: "호별" };
  const clean = v => String(v ?? "").normalize("NFKC").replace(/[　\s]+/g, " ").trim();
  const text = v => String(v ?? "").replace(/\r/g, "").trim();

  function toWorkbook(cat) {
    const rows = [HEAD];
    cat.courses.forEach(c => c.sessions.forEach((s, i) => rows.push([
      KIND[c.kind] || "호별", c.name, c.full && c.full !== c.name ? c.full : "", (c.aliases || []).join(", "), c.label || "",
      i + 1, s.tag || "", s.book || "", s.desc || "", s.link || ""])));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [7, 16, 18, 30, 12, 6, 16, 34, 56, 34].map(wch => ({ wch }));
    const meta = XLSX.utils.aoa_to_sheet([["연도", cat.year], ["월", cat.month], ["", ""], ["안내", "과정 시트의 한 줄이 한 차시예요. 같은 과정명이 한 과정으로 묶여요."]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "과정");
    XLSX.utils.book_append_sheet(wb, meta, "설정");
    return wb;
  }

  function fromWorkbook(buf, fallback) {
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets["과정"] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    const hi = rows.findIndex(r => r.some(c => clean(c) === "과정명"));
    if (hi < 0) throw new Error("첫 줄에서 '과정명' 칸을 찾지 못했어요. 「현재 과정 데이터 내려받기」 양식을 써 주세요.");
    const H = rows[hi].map(clean), col = k => H.findIndex(h => h.startsWith(k));
    const c = { kind: col("구분"), name: col("과정명"), full: col("정식"), alias: col("엑셀표기") >= 0 ? col("엑셀표기") : col("엑셀 표기"),
      label: col("교과연계 라벨"), no: col("차시"), tag: col("수업 주제"), book: col("필독서"), desc: col("한 줄"), link: H.findIndex(h => h === "교과연계") };
    if (c.book < 0) throw new Error("'필독서' 칸이 없어요.");
    const map = new Map();
    rows.slice(hi + 1).forEach(r => {
      const name = text(r[c.name]); if (!name) return;
      if (!map.has(name)) map.set(name, { name, full: text(r[c.full]) || name,
        kind: /호별|series/i.test(text(r[c.kind])) ? "series" : "monthly",
        label: text(r[c.label]), aliases: [], sessions: [] });
      const co = map.get(name);
      if (c.alias >= 0) text(r[c.alias]).split(/[,，、]/).map(clean).filter(Boolean).forEach(a => { if (!co.aliases.includes(a)) co.aliases.push(a); });
      const s = { n: parseInt(r[c.no], 10) || co.sessions.length + 1, tag: text(r[c.tag]), book: text(r[c.book]), desc: text(r[c.desc]) };
      if (c.link >= 0 && text(r[c.link])) s.link = text(r[c.link]);
      if (s.book || s.desc || s.tag) co.sessions.push(s);
    });
    const courses = [...map.values()].filter(co => co.sessions.length).map(co => {
      co.sessions.sort((a, b) => a.n - b.n).forEach(s => delete s.n);
      [co.name, co.full].forEach(a => { if (!co.aliases.some(x => clean(x) === clean(a))) co.aliases.push(a); });
      if (!co.label) delete co.label;
      return co;
    });
    if (!courses.length) throw new Error("차시가 적힌 과정이 없어요.");
    const meta = wb.Sheets["설정"] ? XLSX.utils.sheet_to_json(wb.Sheets["설정"], { header: 1, raw: false }) : [];
    const pick = k => parseInt((meta.find(r => clean(r[0]) === k) || [])[1], 10);
    return { year: pick("연도") || fallback.year, month: pick("월") || fallback.month, courses };
  }

  const save = cat => { try { localStorage.setItem(KEY, JSON.stringify(cat)); return true; } catch (_) { return false; } };
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.courses && v.courses.length ? v : null; } catch (_) { return null; } };
  const reset = () => { try { localStorage.removeItem(KEY); } catch (_) {} };

  g.Catalog = { toWorkbook, fromWorkbook, save, load, reset };
})(window);
