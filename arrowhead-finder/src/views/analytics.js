/* View: Analytics — KPI cards, type/material/size bars, timeline, hotspots. */
(function (global) {
  "use strict";

  function h() { return global.AF.h.apply(null, arguments); }

  function kpi(label, value, sub) {
    return h("div", { class: "kpi-card" }, [
      h("div", { class: "label" }, label),
      h("div", { class: "value" }, value),
      sub ? h("div", { class: "sub" }, sub) : null,
    ]);
  }

  function barList(entries) {
    var max = 0;
    for (var i = 0; i < entries.length; i++) if (entries[i].count > max) max = entries[i].count;
    if (max === 0) max = 1;
    return h("div", { class: "bar-list" },
      entries.map(function (e) {
        var pct = Math.round((e.count / max) * 100);
        return h("div", { class: "bar-item" }, [
          h("div", { class: "label" }, e.label || "—"),
          h("div", { class: "bar-track" }, [h("div", { class: "bar-fill", style: "width:" + pct + "%" })]),
          h("div", { class: "v" }, String(e.count)),
        ]);
      })
    );
  }

  function sizeBars(buckets) {
    var max = 0;
    for (var i = 0; i < buckets.length; i++) if (buckets[i].count > max) max = buckets[i].count;
    if (max === 0) max = 1;
    return h("div", { class: "bar-list" },
      buckets.map(function (b) {
        var pct = Math.round((b.count / max) * 100);
        return h("div", { class: "bar-item" }, [
          h("div", { class: "label" }, b.label),
          h("div", { class: "bar-track" }, [h("div", { class: "bar-fill", style: "width:" + pct + "%" })]),
          h("div", { class: "v" }, String(b.count)),
        ]);
      })
    );
  }

  function renderTimeline(buckets) {
    var max = 0;
    for (var i = 0; i < buckets.length; i++) if (buckets[i].count > max) max = buckets[i].count;
    var tl = h("div", { class: "timeline" },
      buckets.map(function (b) {
        var pct = max === 0 ? 0 : Math.max(2, Math.round((b.count / max) * 100));
        return h("div", {
          class: "bar",
          style: "height:" + pct + "%",
          title: new Date(b.end).toLocaleDateString() + " · " + b.count,
        });
      })
    );
    var legend = h("div", { class: "timeline-legend" }, [
      h("span", null, buckets.length + " weeks ago"),
      h("span", null, "Now"),
    ]);
    return h("div", null, [tl, legend]);
  }

  function render(state, store) {
    var data = state.data;
    var activeGroup = data.activeGroupId ? data.groups[data.activeGroupId] : null;
    var view = h("div", { class: "view" }, []);

    view.appendChild(h("div", { class: "appbar" }, [
      h("div", null, null),
      h("div", null, [
        h("div", { class: "title" }, "Analytics"),
        h("div", { class: "sub" }, activeGroup ? activeGroup.name : "No active group"),
      ]),
      h("div", null, null),
    ]));

    if (!activeGroup) {
      view.appendChild(h("div", { class: "empty" }, [
        h("div", { class: "h" }, "No active group"),
        h("div", { class: "b" }, "Pick or create a group to see stats."),
      ]));
      return view;
    }

    var a = global.AF.analytics.getAnalytics(data, activeGroup.id);

    view.appendChild(h("div", { class: "stats-section" }, [
      h("div", { class: "kpi-grid" }, [
        kpi("Total finds", String(a.totalFinds), "all time"),
        kpi("Days hunted", String(a.daysHunted), "unique dates"),
        kpi("Unique types", String(a.uniqueTypes), null),
        kpi("Largest", a.largestLengthMm ? Math.round(a.largestLengthMm) + " mm" : "—", "by length"),
      ]),
    ]));

    if (a.totalFinds === 0) {
      view.appendChild(h("div", { class: "empty" }, [
        h("div", { class: "h" }, "No data yet"),
        h("div", { class: "b" }, "Log a find to start seeing analytics."),
      ]));
      return view;
    }

    view.appendChild(h("div", { class: "stats-section" }, [
      h("div", { class: "section-title" }, "By type"),
      barList(a.byType),
    ]));

    view.appendChild(h("div", { class: "stats-section" }, [
      h("div", { class: "section-title" }, "By material"),
      barList(a.byMaterial),
    ]));

    view.appendChild(h("div", { class: "stats-section" }, [
      h("div", { class: "section-title" }, "Size distribution"),
      sizeBars(a.sizeBuckets),
    ]));

    view.appendChild(h("div", { class: "stats-section" }, [
      h("div", { class: "section-title" }, "Finds per week (last 12 weeks)"),
      renderTimeline(a.timeline),
    ]));

    view.appendChild(h("div", { class: "stats-section" }, [
      h("div", { class: "section-title" }, "Top hotspots"),
      a.hotspots.length === 0
        ? h("div", { class: "empty", style: "padding:16px;" }, [h("div", { class: "b" }, "Need a few more finds to cluster.")])
        : h("div", { class: "hotspot-list" },
            a.hotspots.map(function (spot, idx) {
              return h("div", { class: "hotspot-row" }, [
                h("div", { class: "rank" }, "#" + (idx + 1)),
                h("div", { class: "coords" }, spot.lat.toFixed(4) + ", " + spot.lng.toFixed(4)),
                h("div", { class: "count" }, spot.count + (spot.count === 1 ? " find" : " finds")),
              ]);
            })),
    ]));

    view.appendChild(h("div", { style: "height: 20px;" }));

    return view;
  }

  global.AF = global.AF || {};
  global.AF.views = global.AF.views || {};
  global.AF.views.analytics = { render: render };
})(window);
