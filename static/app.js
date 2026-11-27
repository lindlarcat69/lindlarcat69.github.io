// 表格排序、搜尋、分類篩選、圖表
(function () {
  // 排序
  document.querySelectorAll("table.sortable").forEach(function (table) {
    var ths = table.querySelectorAll("thead th");
    ths.forEach(function (th, idx) {
      th.addEventListener("click", function () {
        var asc = !th.classList.contains("asc");
        ths.forEach(function (t) { t.classList.remove("asc", "desc"); });
        th.classList.add(asc ? "asc" : "desc");
        var tbody = table.tBodies[0];
        var rows = Array.prototype.slice.call(tbody.rows);
        rows.sort(function (a, b) {
          var x = a.cells[idx].getAttribute("data-v"), y = b.cells[idx].getAttribute("data-v");
          var nx = parseFloat(x), ny = parseFloat(y);
          var r = (!isNaN(nx) && !isNaN(ny) && /^-?[\d.e+]+$/i.test(x) && /^-?[\d.e+]+$/i.test(y))
            ? nx - ny : String(x).localeCompare(String(y), "zh-Hant");
          return asc ? r : -r;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  });

  // 搜尋＋分類
  var q = document.getElementById("q");
  var cat = "";
  function applyFilter() {
    var t = document.getElementById("etf-table");
    if (!t) return;
    var kw = (q && q.value || "").trim().toLowerCase();
    var shown = 0;
    Array.prototype.forEach.call(t.tBodies[0].rows, function (r) {
      var okKw = !kw || r.getAttribute("data-search").toLowerCase().indexOf(kw) >= 0;
      var okCat = !cat || r.getAttribute("data-cat") === cat;
      r.style.display = okKw && okCat ? "" : "none";
      if (okKw && okCat) shown++;
    });
    var empty = document.getElementById("etf-empty");
    if (empty) empty.style.display = shown ? "none" : "";
    t.parentNode.style.display = shown ? "" : "none";
    homeFunds(kw);
  }

  // 首頁搜尋同時找基金
  var homeList = null, homeBox = document.getElementById("home-fund-box");
  if (homeBox) {
    fetch("funds/search.json").then(function (r) { return r.json(); })
      .then(function (d) { homeList = d; applyFilter(); }).catch(function () {});
  }
  function homeFunds(kw) {
    if (!homeBox) return;
    if (!homeList || kw.length < 2) { homeBox.style.display = "none"; return; }
    var words = kw.split(/\s+/);
    var hits = homeList.filter(function (f) {
      var t = (f[1] + " " + f[2]).toLowerCase();
      return words.every(function (w) { return t.indexOf(w) >= 0; });
    });
    if (!hits.length) { homeBox.style.display = "none"; return; }
    var more = hits.length > 30 ? '<li><a href="funds/index.html">共 ' + hits.length + ' 檔，到基金頁看更多 →</a></li>' : "";
    document.getElementById("home-fund-results").innerHTML = hits.slice(0, 30).map(function (f) {
      return '<li><a href="funds/' + encodeURIComponent(f[0]) + '.html">' + f[1].replace(/</g, "&lt;") + "</a>（" + f[2].replace(/</g, "&lt;") + "）</li>";
    }).join("") + more;
    homeBox.style.display = "";
  }
  if (q) q.addEventListener("input", applyFilter);
  document.querySelectorAll(".cat-buttons button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".cat-buttons button").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      cat = b.getAttribute("data-cat");
      applyFilter();
    });
  });

  // 比較頁清單篩選
  var ql = document.getElementById("q-list");
  if (ql) ql.addEventListener("input", function () {
    var kw = ql.value.trim().toLowerCase();
    document.querySelectorAll("#pair-list li").forEach(function (li) {
      li.style.display = !kw || li.textContent.toLowerCase().indexOf(kw) >= 0 ? "" : "none";
    });
  });

  // 基金搜尋（資料放在 funds/search.json）
  var fq = document.getElementById("fund-q");
  if (fq) {
    var list = null, box = document.getElementById("fund-results");
    fetch("search.json").then(function (r) { return r.json(); }).then(function (d) { list = d; })
      .catch(function () { box.innerHTML = "<li>搜尋需要透過網址開啟網站（例如 preview.bat），無法直接開啟檔案使用。</li>"; });
    fq.addEventListener("input", function () {
      var kw = fq.value.trim().toLowerCase();
      if (!list) return;
      if (!kw) { box.innerHTML = ""; return; }
      var words = kw.split(/\s+/);
      var hits = list.filter(function (f) {
        var t = (f[1] + " " + f[2]).toLowerCase();
        return words.every(function (w) { return t.indexOf(w) >= 0; });
      }).slice(0, 60);
      box.innerHTML = hits.length ? hits.map(function (f) {
        return '<li><a href="' + encodeURIComponent(f[0]) + '.html">' + f[1].replace(/</g, "&lt;") + "</a>（" + f[2].replace(/</g, "&lt;") + "）</li>";
      }).join("") : "<li>找不到符合的基金</li>";
    });
  }

  // 圖表
  var colors = ["#1f4e79", "#e07b00", "#2e7d32", "#8e24aa"];
  function draw() {
    if (!window.Chart || !window.CHARTS) return;
    window.CHARTS.forEach(function (c) {
      var el = document.getElementById(c.id);
      if (!el) return;
      new Chart(el, {
        type: "line",
        data: {
          labels: c.labels,
          datasets: c.datasets.map(function (d, i) {
            var col = d.color || colors[i % colors.length];
            return { label: d.label, data: d.data, borderColor: col, backgroundColor: col,
              borderWidth: d.width || 2, borderDash: d.dash ? [4, 4] : [], pointRadius: 0,
              tension: 0.15, spanGaps: true, nolegend: !!d.nolegend };
          })
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: c.datasets.length > 1, labels: { filter: function (item, data) { return !data.datasets[item.datasetIndex].nolegend; } } },
            tooltip: { filter: function (item) { return !item.dataset.nolegend; } }
          },
          scales: { x: { ticks: { maxTicksLimit: 8 } } }
        }
      });
    });
  }
  if (document.readyState === "complete") draw(); else window.addEventListener("load", draw);
})();