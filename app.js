// app.js

Promise.all([
  d3.json("meal_daily.json"),
  d3.json("cgm_curves.json")
]).then(([meal, curves]) => {

  // -------- 1. Crossfilter 建模 --------
  const cf = crossfilter(meal);

  // 维度
  const personDim = cf.dimension(d => d.person);
  const timeDim   = cf.dimension(d => Math.floor(d.minute_in_day / 5) * 5);
  const groupDim  = cf.dimension(d => d.group_id);

  // 营养素汇总维度
  const nutDim    = cf.dimension(() => "all");
  // ΔGlu 维度 (10 mg/dL 分箱)
  const deltaDim  = cf.dimension(d => Math.floor(d.grow_in_glu / 10) * 10);

  // 分组
  const personGrp = personDim.group();
  const timeGrp   = timeDim.group();
  const deltaGrp  = deltaDim.group();
  const nutGrp    = nutDim.group().reduce(
    (p, v) => { p.carb += v.total_carb; p.fat += v.total_fat; p.protein += v.protein; return p; },
    (p, v) => { p.carb -= v.total_carb; p.fat -= v.total_fat; p.protein -= v.protein; return p; },
    () => ({ carb: 0, fat: 0, protein: 0 })
  );

  // -------- 2. 受试者编号 柱状筛选 --------
  dc.barChart("#person-chart")
    .width(600).height(100)
    .dimension(personDim).group(personGrp)
    .x(d3.scaleLinear().domain([0.5,16.5]))
    .xUnits(() => 16)
    .centerBar(true)
    .barPadding(0.1).gap(1)
    .brushOn(true)
    .elasticY(false)
    .yAxis().ticks(0).tickFormat("");

  // -------- 3. 用餐时间 (5min bin)筛选 --------
  dc.barChart("#time-chart")
    .width(960).height(80)
    .dimension(timeDim).group(timeGrp)
    .x(d3.scaleLinear().domain([0,1440]))
    .xUnits(() => 1440/5)
    .brushOn(true)
    .elasticY(false)
    .renderHorizontalGridLines(false)
    .yAxis().ticks(0).tickFormat("")
    .renderlet(chart => chart.select("g.y").style("display","none"));

  // -------- 4. 宏量营养素 堆叠比例柱状 --------
  const totalNut = d => d.value.carb + d.value.fat + d.value.protein;
  dc.barChart("#nutrient-chart")
    .width(480).height(250)
    .dimension(nutDim).group(nutGrp, "碳水", d => d.value.carb / totalNut(d))
    .valueAccessor(d => d.value.carb / totalNut(d))
    .stack(nutGrp, "脂肪",   d => d.value.fat / totalNut(d))
    .stack(nutGrp, "蛋白质", d => d.value.protein / totalNut(d))
    .x(d3.scaleBand().domain(["all"]))
    .xUnits(dc.units.ordinal)
    .legend(new dc.Legend().x(380).y(10))
    .elasticY(true)
    .yAxis().tickFormat(d3.format(".0%"));

  // -------- 5. ΔGlu 直方图 --------
  dc.barChart("#delta-chart")
    .width(960).height(250)
    .dimension(deltaDim).group(deltaGrp)
    .x(d3.scaleLinear()
      .domain([
        d3.min(meal, d => d.grow_in_glu),
        d3.max(meal, d => d.grow_in_glu)
      ]))
    .xUnits(() => 20)
    .brushOn(false)
    .elasticY(true)
    .yAxisLabel("餐次数")
    .xAxisLabel("ΔGlu (mg/dL)");

  // 渲染前面所有 dc.js 图表
  dc.renderAll();

  // -------- 6. 折线图 & 统计卡片 --------
  // 折线图画布
  const svg = d3.select("#line-chart"),
        margin = { top:20, left:50, bottom:30, right:20 },
        W = +svg.attr("width") - margin.left - margin.right,
        H = +svg.attr("height") - margin.top - margin.bottom,
        G = svg.append("g").attr("transform",
                `translate(${margin.left},${margin.top})`);

  const xLine = d3.scaleLinear().domain([-30,180]).range([0,W]);
  const yLine = d3.scaleLinear()
                  .domain([
                    d3.min(curves, d => d.glu),
                    d3.max(curves, d => d.glu)
                  ])
                  .range([H,0]);

  G.append("g")
   .attr("transform", `translate(0,${H})`)
   .call(d3.axisBottom(xLine).ticks(6).tickFormat(d => d + "min"));

  G.append("g")
   .call(d3.axisLeft(yLine));

  // 画折线
  function redrawLines(){
    // 当前已筛选的 group_id 列表
    const gids = new Set(groupDim.top(Infinity).map(d => d.group_id));
    const grouped = d3.group(
      curves.filter(c => gids.has(c.group_id)),
      d => d.group_id
    );

    const paths = G.selectAll("path.line")
      .data(Array.from(grouped.values()), d => d[0].group_id);

    paths.enter().append("path")
      .attr("class","line")
      .attr("fill","none")
      .attr("stroke","#d62728")
      .attr("stroke-width",1)
      .attr("opacity",0.2)
    .merge(paths)
      .attr("d", d3.line()
        .x(d => xLine(d.min_from_meal))
        .y(d => yLine(d.glu))
      );

    paths.exit().remove();
  }

  // 更新统计卡片
  function updateCards(){
    const recs = groupDim.top(Infinity);
    const mean = d3.mean(recs, d => d.grow_in_glu) || 0;
    const std  = d3.deviation(recs, d => d.grow_in_glu) || 0;
    const cnt  = recs.length;

    d3.select("#cards").html(`
      <div class="card">平均 ΔGlu：${mean.toFixed(1)}</div>
      <div class="card">标准差：${std.toFixed(1)}</div>
      <div class="card">餐次数：${cnt}</div>
    `);
  }

  // 首次渲染 & 绑定联动
  redrawLines();
  updateCards();
  dc.chartRegistry.list().forEach(ch =>
    ch.on("filtered", () => {
      redrawLines();
      updateCards();
    })
  );

});
