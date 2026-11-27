// K 線圖：日K／週K／月K、可勾選均線、成交量＋均量、KDJ（含超買超賣標記），可滾輪縮放與拖曳
// 使用 TradingView Lightweight Charts（開源，Apache 2.0 授權）
(function () {
  var raw = window.KLINE_DATA;
  var mainEl = document.getElementById("kline-main");
  var volEl = document.getElementById("kline-vol");
  var kdjEl = document.getElementById("kline-kdj");
  if (!raw || !mainEl || !window.LightweightCharts) {
    if (mainEl) mainEl.innerHTML = '<p class="note" style="padding:16px">圖表元件載入失敗，請確認網路連線後重新整理。</p>';
    return;
  }
  var LC = window.LightweightCharts;
  var UP = "#d32f2f", DOWN = "#2e7d32";
  var MAS = [
    { n: 5, color: "#1f78c8", on: true }, { n: 10, color: "#e0a100", on: true },
    { n: 20, color: "#d81b60", on: true }, { n: 60, color: "#43a047", on: true },
    { n: 120, color: "#7e57c2", on: false }, { n: 240, color: "#f4511e", on: false }
  ];
  var MV = [{ n: 5, color: "#1f78c8" }, { n: 20, color: "#d81b60" }];
  var PERIOD_NAME = { D: "日K", W: "週K", M: "月K" };
  var PERIOD_DESC = { D: "每根 K 棒＝1 個交易日", W: "每根 K 棒＝1 週", M: "每根 K 棒＝1 個月" };
  var UNIT = { D: "日", W: "週", M: "月" };

  // ---------- 資料整理 ----------
  function bars(period) {
    if (period === "D") {
      return raw.map(function (r) { return { time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }; });
    }
    var out = [], cur = null, curKey = null;
    raw.forEach(function (r) {
      var key;
      if (period === "M") {
        key = r[0].slice(0, 7);
      } else {
        var d = new Date(r[0] + "T00:00:00Z");
        var day = (d.getUTCDay() + 6) % 7;
        key = new Date(d.getTime() - day * 86400000).toISOString().slice(0, 10);
      }
      if (key !== curKey) {
        if (cur) out.push(cur);
        curKey = key;
        cur = { time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] };
      } else {
        cur.high = Math.max(cur.high, r[2]);
        cur.low = Math.min(cur.low, r[3]);
        cur.close = r[4];
        cur.volume += r[5];
      }
    });
    if (cur) out.push(cur);
    return out;
  }

  function avg(b, n, key) {
    var out = [], sum = 0;
    for (var i = 0; i < b.length; i++) {
      sum += b[i][key];
      if (i >= n) sum -= b[i - n][key];
      if (i >= n - 1) out.push({ time: b[i].time, value: +(sum / n).toFixed(4) });
    }
    return out;
  }

  function kdj(b) {
    var K = [], D = [], J = [], k = 50, d = 50;
    for (var i = 8; i < b.length; i++) {
      var hh = -Infinity, ll = Infinity;
      for (var j = i - 8; j <= i; j++) { hh = Math.max(hh, b[j].high); ll = Math.min(ll, b[j].low); }
      var rsv = hh > ll ? (b[i].close - ll) / (hh - ll) * 100 : 50;
      k = k * 2 / 3 + rsv / 3;
      d = d * 2 / 3 + k / 3;
      K.push({ time: b[i].time, value: +k.toFixed(2) });
      D.push({ time: b[i].time, value: +d.toFixed(2) });
      J.push({ time: b[i].time, value: +(3 * k - 2 * d).toFixed(2) });
    }
    return { K: K, D: D, J: J };
  }

  // ---------- 建立三張圖 ----------
  var common = {
    autoSize: true,
    layout: { background: { color: "#ffffff" }, textColor: "#374151", fontSize: 12 },
    grid: { vertLines: { color: "#f0f0f0" }, horzLines: { color: "#f0f0f0" } },
    rightPriceScale: { borderColor: "#e5e7eb", minimumWidth: 70 },
    timeScale: { borderColor: "#e5e7eb", rightOffset: 3, minBarSpacing: 1 },
    crosshair: { mode: 0 },
    localization: { locale: "zh-TW", dateFormat: "yyyy-MM-dd" },
    handleScroll: true, handleScale: true
  };
  function opts(showTime) {
    return Object.assign({}, common, { timeScale: Object.assign({}, common.timeScale, { visible: showTime }) });
  }
  var main = LC.createChart(mainEl, opts(false));
  var volc = LC.createChart(volEl, opts(false));
  var sub = LC.createChart(kdjEl, opts(true));
  var charts = [main, volc, sub];

  var line = function (chart, color, width) {
    return chart.addLineSeries({ color: color, lineWidth: width || 1, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false });
  };
  var candle = main.addCandlestickSeries({
    upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
    priceLineVisible: false
  });
  MAS.forEach(function (m) { m.series = line(main, m.color, 1.3); m.series.applyOptions({ visible: m.on }); });

  var volS = volc.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false });
  MV.forEach(function (m) { m.series = line(volc, m.color, 1.2); });

  var kS = line(sub, "#1f78c8", 1.5), dS = line(sub, "#d81b60", 1.5), jS = line(sub, "#9e9e9e", 1);
  [80, 20].forEach(function (v) {
    kS.createPriceLine({ price: v, color: "#bbbbbb", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" });
  });

  // 三張圖同步捲動、縮放
  var syncing = false;
  charts.forEach(function (a) {
    a.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
      if (syncing || !r) return;
      syncing = true;
      charts.forEach(function (b) { if (b !== a) b.timeScale().setVisibleLogicalRange(r); });
      syncing = false;
    });
  });

  // ---------- 圖例 ----------
  var cur = { period: "D", bars: [], ma: {}, mv: {}, kdj: { K: [], D: [], J: [] } };
  var idx = {};  // time -> bar index
  function f(v, n) { return v == null ? "—" : Number(v).toFixed(n == null ? 2 : n); }
  function at(list, time) {
    var i = list._idx ? list._idx[time] : undefined;
    return i === undefined ? null : list[i];
  }
  function indexList(list) { list._idx = {}; list.forEach(function (x, i) { list._idx[x.time] = i; }); return list; }
  function arrow(list, time) {
    var i = list._idx ? list._idx[time] : undefined;
    if (i === undefined || i === 0) return "";
    var a = list[i].value, b = list[i - 1].value;
    return a > b ? '<span class="up">↑</span>' : a < b ? '<span class="down">↓</span>' : "";
  }
  function legend(time) {
    var b = cur.bars;
    if (!b.length) return;
    var bar = time ? b[idx[time]] : b[b.length - 1];
    if (!bar) return;
    var t = bar.time, c = bar.close >= bar.open ? "up" : "down", u = UNIT[cur.period];
    document.getElementById("kline-ohlc").innerHTML =
      "<b>" + t + "</b>　開 <span class=" + c + ">" + f(bar.open) + "</span>　高 <span class=" + c + ">" + f(bar.high) +
      "</span>　低 <span class=" + c + ">" + f(bar.low) + "</span>　收 <span class=" + c + ">" + f(bar.close) + "</span>";
    MAS.forEach(function (m) {
      var x = at(cur.ma[m.n], t);
      document.getElementById("ma-val-" + m.n).innerHTML = (x ? f(x.value) : "—") + (x ? arrow(cur.ma[m.n], t) : "");
    });
    var mv = MV.map(function (m) {
      var x = at(cur.mv[m.n], t);
      return '<span style="color:' + m.color + '">MV' + m.n + " " + (x ? Math.round(x.value).toLocaleString() : "—") +
        "</span>" + (x ? arrow(cur.mv[m.n], t) : "");
    }).join("　");
    document.getElementById("vol-legend").innerHTML = "成交量　" + mv + "　量 <b>" + Math.round(bar.volume).toLocaleString() + "</b> " + (window.KLINE_UNIT || "張");
    var kk = at(cur.kdj.K, t), dd = at(cur.kdj.D, t), jj = at(cur.kdj.J, t);
    document.getElementById("kdj-legend").innerHTML = "KDJ(9,3,3)　" +
      '<span style="color:#1f78c8">K ' + (kk ? f(kk.value) : "—") + "</span>" + (kk ? arrow(cur.kdj.K, t) : "") + "　" +
      '<span style="color:#d81b60">D ' + (dd ? f(dd.value) : "—") + "</span>" + (dd ? arrow(cur.kdj.D, t) : "") + "　" +
      '<span style="color:#757575">J ' + (jj ? f(jj.value) : "—") + "</span>　" +
      '<span class="note">K 值 &gt; 80 標紅點、&lt; 20 標綠點</span>';
  }

  // 十字線：三張圖同步顯示在同一根 K 棒
  var moving = false;
  var anchor = [[main, candle, "close"], [volc, volS, "value"], [sub, kS, "value"]];
  anchor.forEach(function (a) {
    a[0].subscribeCrosshairMove(function (p) {
      if (moving) return;
      var t = p && p.time ? p.time : null;
      legend(t);
      if (typeof a[0].setCrosshairPosition !== "function") return;
      moving = true;
      anchor.forEach(function (o) {
        if (o[0] === a[0]) return;
        if (!t) { o[0].clearCrosshairPosition(); return; }
        var x = o[1] === kS ? at(cur.kdj.K, t) : cur.bars[idx[t]];
        if (x) o[0].setCrosshairPosition(o[2] === "close" ? x.close : (o[1] === volS ? x.volume : x.value), t, o[1]);
        else o[0].clearCrosshairPosition();
      });
      moving = false;
    });
  });

  // ---------- 均線勾選 ----------
  var box = document.getElementById("ma-toggles");
  box.innerHTML = MAS.map(function (m) {
    return '<label style="color:' + m.color + '"><input type="checkbox" data-n="' + m.n + '"' + (m.on ? " checked" : "") +
      '> MA' + m.n + ' <b id="ma-val-' + m.n + '">—</b></label>';
  }).join("");
  box.querySelectorAll("input").forEach(function (cb) {
    cb.addEventListener("change", function () {
      var m = MAS.filter(function (x) { return x.n === +cb.getAttribute("data-n"); })[0];
      m.on = cb.checked;
      m.series.applyOptions({ visible: m.on });
    });
  });

  // ---------- 繪製 ----------
  function render(period) {
    cur.period = period;
    var b = bars(period);
    cur.bars = b;
    idx = {};
    b.forEach(function (x, i) { idx[x.time] = i; });
    candle.setData(b.map(function (x) { return { time: x.time, open: x.open, high: x.high, low: x.low, close: x.close }; }));
    MAS.forEach(function (m) { cur.ma[m.n] = indexList(avg(b, m.n, "close")); m.series.setData(cur.ma[m.n]); });
    volS.setData(b.map(function (x) {
      return { time: x.time, value: x.volume, color: x.close >= x.open ? "rgba(211,47,47,0.75)" : "rgba(46,125,50,0.75)" };
    }));
    MV.forEach(function (m) { cur.mv[m.n] = indexList(avg(b, m.n, "volume")); m.series.setData(cur.mv[m.n]); });
    var k = kdj(b);
    cur.kdj = { K: indexList(k.K), D: indexList(k.D), J: indexList(k.J) };
    kS.setData(k.K); dS.setData(k.D); jS.setData(k.J);
    var marks = [];
    k.K.forEach(function (x) {
      if (x.value > 80) marks.push({ time: x.time, position: "inBar", color: UP, shape: "circle", size: 0.6 });
      else if (x.value < 20) marks.push({ time: x.time, position: "inBar", color: DOWN, shape: "circle", size: 0.6 });
    });
    if (kS.setMarkers) kS.setMarkers(marks);

    var show = period === "D" ? 120 : period === "W" ? 60 : b.length;
    main.timeScale().setVisibleLogicalRange({ from: Math.max(0, b.length - show) - 0.5, to: b.length + 2 });
    document.getElementById("kline-period").textContent = PERIOD_NAME[period];
    document.querySelector(".kline-title").lastChild.textContent = "（" + PERIOD_DESC[period] + "）";
    legend(null);
  }
  document.querySelectorAll(".kline-btns button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".kline-btns button").forEach(function (x) { x.classList.remove("on"); });
      btn.classList.add("on");
      render(btn.getAttribute("data-p"));
    });
  });
  render("D");
})();
