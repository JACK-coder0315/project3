// app.js

// 1. 并行加载两份 JSON（餐次摘要 + CGM 曲线）
Promise.all([
  d3.json("meal_daily.json"),
  d3.json("cgm_curves.json")
]).then(([meal, curves]) => {

  // 2. 构建 Crossfilter 维度与分组
  const cf      = crossfilter(meal);
  const dateDim = cf.dimension(d => d3.timeDay(new Date(d.date)));
  const hourDim = cf.dimension(d => d.minute_in_day);
  const foodDim = cf.dimension(d => d.food_class);
  const gluDim  = cf.dimension(d => Math.floor(d.grow_in_glu));

  const dateGrp = dateDim.group();
  const hourGrp = hourDim.group(Math.floor).reduceCount();
  const foodGrp = foodDim.group();
  const gluGrp  = gluDim.group();

  // 自定义 reduce：汇总各营养素
  const nutrientKeys = ["calorie","total_carb","protein","total_fat","sugar"];
  const nutrientDim  = cf.dimension(() => "all");
  const nutrientGrp  = nutrientDim.group().reduce(
    (p,v) => { nutrientKeys.forEach(k=>p[k]+=v[k]||0); return p; },
    (p,v) => { nutrientKeys.forEach(k=>p[k]-=v[k]||0); return p; },
    ()    => { let o={}; nutrientKeys.forEach(k=>o[k]=0); return o; }
  );

  // 3. 用 dc.js 创建联动图表
  // ─── 日期条形 + brush ───────────────────────────
  dc.barChart("#date-chart")
    .width(960).height(200)
    .dimension(dateDim).group(dateGrp)
    .x(d3.scaleTime().domain(d3.extent(meal, d=>new Date(d.date))))
    .xUnits(d3.timeDays)
    .brushOn(true)
    .elasticY(true)
    .renderHorizontalGridLines(true);

  // ─── 用餐时间直方 ────────────────────────────────
  dc.barChart("#hour-chart")
    .width(480).height(250)
    .dimension(hourDim).group(hourGrp)
    .x(d3.scaleLinear().domain([0,1440]))
    .xUnits(() => 24)      // 一天分24小时
    .brushOn(true)
    .elasticY(true)
    .barPadding(0.1)
    .gap(1);

  // ─── 食物种类条形 ────────────────────────────────
  dc.rowChart("#food-chart")
    .width(480).height(250)
    .dimension(foodDim).group(foodGrp)
    .elasticX(true);

  // ─── 血糖增量直方 ────────────────────────────────
  dc.barChart("#glu-chart")
    .width(480).height(250)
    .dimension(gluDim).group(gluGrp)
    .x(d3.scaleLinear().domain(d3.extent(meal, d=>d.grow_in_glu)))
    .xUnits(() => 20)
    .brushOn(true)
    .elasticY(true)
    .barPadding(0.1)
    .gap(1);

  // ─── 营养素摄入柱状 ───────────────────────────────
  dc.barChart("#nutrient-chart")
    .width(480).height(250)
    .dimension(nutrientDim).group(nutrientGrp, "calorie")
    .valueAccessor(d => d.value.calorie)
    .x(d3.scaleBand().domain(nutrientKeys))
    .xUnits(dc.units.ordinal)
    .elasticY(true);

  // 渲染所有 dc.js 图表
  dc.renderAll();


  // 4. 折线图：每餐 CGM 曲线（用 D3 手动渲染）
  const svgLine = d3.select("#line-chart");
  const margin  = { top: 20, right: 20, bottom: 30, left: 50 };
  const W       = +svgLine.attr("width")  - margin.left - margin.right;
  const H       = +svgLine.attr("height") - margin.top  - margin.bottom;
  const G       = svgLine.append("g")
                  .attr("transform", `translate(${margin.left},${margin.top})`);

  const xLine = d3.scaleLinear().domain([-30,180]).range([0,W]);
  const yLine = d3.scaleLinear()
                  .domain([
                    d3.min(curves, d=>d.glu),
                    d3.max(curves, d=>d.glu)
                  ])
                  .range([H,0]);

  G.append("g")
   .attr("transform", `translate(0,${H})`)
   .call(d3.axisBottom(xLine).ticks(6).tickFormat(d=>d+"min"));
  G.append("g")
   .call(d3.axisLeft(yLine));

  function redrawLines(){
    // 取当前 hourDim 过滤后的所有 group_id
    const ids = new Set(hourDim.top(Infinity).map(d=>d.group_id));
    // 从 curves 中筛选并分组
    const grp = d3.group(curves.filter(c=>ids.has(c.group_id)), d=>d.group_id);

    // 数据绑定 & enter/update/exit
    const paths = G.selectAll("path.line")
      .data(Array.from(grp.values()), d=>d[0].group_id);

    paths.enter().append("path")
      .attr("class","line")
    .merge(paths)
      .attr("fill","none")
      .attr("stroke","#d62728")
      .attr("stroke-width",1)
      .attr("d", d3.line()
        .x(d=> xLine(d.min_from_meal))
        .y(d=> yLine(d.glu))
      );

    paths.exit().remove();
  }

  // 5. 统计卡片
  function updateCards(){
    const data = hourDim.top(Infinity);
    const mean = d3.mean(data, d=>d.grow_in_glu)    || 0;
    const std  = d3.deviation(data, d=>d.grow_in_glu)|| 0;
    const cnt  = data.length;

    d3.select("#cards").html(`
      <div class="card">平均 ΔGlu：${mean.toFixed(1)}</div>
      <div class="card">标准差：${std.toFixed(1)}</div>
      <div class="card">餐次数：${cnt}</div>
    `);
  }

  // 首次渲染 & 绑定 dc.js 过滤事件
  redrawLines();
  updateCards();
  dc.chartRegistry.list().forEach(c=>{
    c.on("filtered", ()=>{
      redrawLines();
      updateCards();
    });
  });

});  // Promise 结束
