/* 수업계획서 포스터를 캔버스에 그려요. 미리보기와 저장 이미지가 똑같아요. */
(function (g) {
  const W = 1080, SCALE = 2;
  const FONT = '"Pretendard",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const MONTH_EN = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  const THEMES = {
    green: { name: "그린", bg: "#97d4a0", grid: "rgba(255,255,255,.28)", tag: "#3a3ab8", bar: "#f5a300", month: "#6d8a6b", hl: "#fff59a", check: "#8dc63f", swatch: "#97d4a0" },
    sky:   { name: "하늘", bg: "#9cc8ee", grid: "rgba(255,255,255,.30)", tag: "#d9531e", bar: "#ffd23f", month: "#5d7f9f", hl: "#fff3a6", check: "#3d8fd6", swatch: "#9cc8ee" },
    pink:  { name: "분홍", bg: "#f3b6c8", grid: "rgba(255,255,255,.32)", tag: "#2f8f6b", bar: "#ffd23f", month: "#9a6376", hl: "#fff3a6", check: "#e0588a", swatch: "#f3b6c8" },
    lemon: { name: "노랑", bg: "#f3dc7a", grid: "rgba(255,255,255,.35)", tag: "#1f2a4a", bar: "#ff8a3d", month: "#8a7a2c", hl: "#d8f1a8", check: "#7aa326", swatch: "#f3dc7a" }
  };

  const sans = (w, px) => w + " " + px + "px " + FONT;

  function loadFonts() {
    return Promise.all([500, 700, 800].map(w => document.fonts.load(w + " 40px Pretendard", "가나다 1234 ABC"))).catch(() => {});
  }

  function fitText(ctx, text, weight, startPx, maxW, minPx) {
    let px = startPx;
    ctx.font = sans(weight, px);
    while (px > minPx && ctx.measureText(text).width > maxW) { px -= 2; ctx.font = sans(weight, px); }
    return px;
  }

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function drawBackground(ctx, th, H) {
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 22) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (let y = 0; y <= H; y += 22) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();
  }

  function drawPaper(ctx, H) {
    ctx.fillStyle = "#fdfdfc"; ctx.fillRect(46, 100, 990, H - 136);
    ctx.fillStyle = "#e4e4e2"; ctx.fillRect(46, H - 52, 990, 16);
    ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 2.5; ctx.strokeRect(47, 101, 988, H - 138);
    ctx.beginPath(); ctx.moveTo(46, H - 52); ctx.lineTo(1036, H - 52); ctx.lineWidth = 2; ctx.stroke();
  }

  function drawClip(ctx) {
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    /* 철사 고리 */
    ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(522, 100); ctx.lineTo(512, 52); ctx.bezierCurveTo(508, 20, 572, 20, 568, 52); ctx.lineTo(558, 100); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(522, 100); ctx.lineTo(512, 52); ctx.bezierCurveTo(508, 20, 572, 20, 568, 52); ctx.lineTo(558, 100); ctx.stroke();
    /* 몸통 */
    ctx.fillStyle = "#fbe96b"; ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(484, 78); ctx.lineTo(596, 78); ctx.lineTo(590, 134); ctx.lineTo(490, 134); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff6b8";
    ctx.beginPath(); ctx.moveTo(500, 90); ctx.lineTo(520, 90); ctx.lineTo(515, 124); ctx.lineTo(500, 124); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fbe96b"; rr(ctx, 524, 122, 32, 14, 4); ctx.fill(); ctx.stroke();
  }

  function drawTag(ctx, th, x, y, n) {
    const w = 68, h = 58;
    ctx.fillStyle = th.tag; ctx.strokeStyle = th.tag; ctx.lineWidth = 8; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + 44, y + 4); ctx.lineTo(x + w - 4, y + h / 2); ctx.lineTo(x + 44, y + h - 4); ctx.lineTo(x + 10, y + h - 4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = th.bar; rr(ctx, x, y + 6, 11, h - 12, 4); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = sans(800, n > 9 ? 32 : 40); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), x + 34, y + h / 2 + 2);
  }

  /* 한 달 달력: top = 월 숫자 위쪽, 반환 = 달력 아래 y */
  function drawMonth(ctx, th, y, m, startNo, marks) {
    const cx = W / 2;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = th.month; ctx.font = sans(800, 118); ctx.fillText(String(m.m), cx, y + 96);
    ctx.fillStyle = "#7d8a80"; ctx.font = sans(500, 25);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
    ctx.fillText(MONTH_EN[m.m - 1], cx, y + 140);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    const x0 = 68, cw = (1017 - 68) / 7, rh = 86, gy = y + 173;
    const first = new Date(m.y, m.m - 1, 1).getDay(), days = new Date(m.y, m.m, 0).getDate();
    const rows = Math.ceil((first + days) / 7);

    ctx.font = sans(500, 17); ctx.textAlign = "right";
    DOW.forEach((d, i) => { ctx.fillStyle = i === 0 ? "#e5502a" : "#2a2a2a"; ctx.fillText(d, x0 + cw * (i + 1) - 14, gy - 12); });

    ctx.strokeStyle = "#8c8c8a"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) { ctx.moveTo(x0, gy + r * rh); ctx.lineTo(x0 + cw * 7, gy + r * rh); }
    for (let c = 0; c <= 7; c++) { ctx.moveTo(x0 + cw * c, gy); ctx.lineTo(x0 + cw * c, gy + rows * rh); }
    ctx.stroke();

    let no = startNo;
    for (let d = 1; d <= days; d++) {
      const idx = first + d - 1, col = idx % 7, row = Math.floor(idx / 7);
      const cellX = x0 + cw * col, cellY = gy + row * rh;
      const on = marks.has(d);
      if (on) drawTag(ctx, th, cellX + 12, cellY + 8, no++);
      ctx.fillStyle = col === 0 ? "#e5502a" : "#222"; ctx.font = sans(500, 25);
      ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(d), cellX + cw - 14, cellY + 38);
    }
    return { bottom: gy + rows * rh, next: no };
  }

  /* data: {title,time,days:[{y,m,d}]}, opts: {theme, footer} → canvas */
  function render(data, opts, canvas) {
    const th = THEMES[opts.theme] || THEMES.green;
    const months = [...new Map(data.days.map(d => [d.y * 100 + d.m, { y: d.y, m: d.m }])).values()];
    if (!months.length) { const n = new Date(); months.push({ y: n.getFullYear(), m: n.getMonth() + 1 }); }

    /* 높이 계산 */
    let cursor = 420;
    const layout = months.map(m => {
      const first = new Date(m.y, m.m - 1, 1).getDay(), days = new Date(m.y, m.m, 0).getDate();
      const rows = Math.ceil((first + days) / 7), top = cursor;
      cursor = top + 173 + rows * 86 + 44;
      return { m, top };
    });
    const footLines = String(opts.footer || "").split(/\r?\n/).filter(Boolean);
    const footY = Math.max(1145, cursor + 62);
    const H = Math.max(1350, footY + footLines.length * 44 + 130);

    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawBackground(ctx, th, H); drawPaper(ctx, H); drawClip(ctx);

    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#111";
    const title = data.title || "수업 이름";
    fitText(ctx, title, 800, 70, 860, 38);
    ctx.fillText(title, 108, 244);

    const time = data.time || "수업 시간";
    const tpx = fitText(ctx, time, 700, 54, 830, 28);
    const tw = ctx.measureText(time).width;
    ctx.fillStyle = th.hl; rr(ctx, 96, 282, tw + 24, 82, 16); ctx.fill();
    ctx.fillStyle = "#111"; ctx.textBaseline = "middle"; ctx.fillText(time, 108, 324 + 3); ctx.textBaseline = "alphabetic";
    void tpx;

    let no = 1;
    const byMonth = new Map();
    data.days.forEach(d => { const k = d.y * 100 + d.m; if (!byMonth.has(k)) byMonth.set(k, new Set()); byMonth.get(k).add(d.d); });
    layout.forEach(({ m, top }) => { no = drawMonth(ctx, th, top, m, no, byMonth.get(m.y * 100 + m.m) || new Set()).next; });

    /* 안내 문구 */
    ctx.textAlign = "center"; ctx.fillStyle = "#1a1a1a"; ctx.font = sans(700, 32);
    const widest = Math.max(0, ...footLines.map(l => ctx.measureText(l).width));
    footLines.forEach((l, i) => ctx.fillText(l, W / 2 + 20, footY + i * 44));
    if (footLines.length) {
      const cxk = W / 2 + 20 - widest / 2 - 52, cyk = footY + (footLines.length - 1) * 22 - 14;
      ctx.strokeStyle = th.check; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(cxk - 20, cyk); ctx.lineTo(cxk - 6, cyk + 16); ctx.lineTo(cxk + 22, cyk - 22); ctx.stroke();
    }
    return canvas;
  }

  g.Poster = { render, THEMES, loadFonts, W };
})(window);
