// 1. 读取 CSV 并预处理
d3.csv("all_glu_food.csv", d3.autoType).then(data => {
  data.forEach(d => {
    // 计算小时（带小数）
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes()/60;
  });

  // 2. 初始化 Crossfilter
  const cf = crossfilter(data);

  // 3. 定义维度（dimension）
  const timeDim    = cf.dimension(d => Math.floor(d.mealHour));         // 整点小时
  const carbDim    = cf.dimension(d => Math.floor(d.total_carb / 10)*10);  // 每 10g 一箱
  const protDim    = cf.dimension(d => Math.floor(d.protein_g / 5)*5);    // 每 5g 一箱
  const scatterDim = cf.dimension(d => [d.total_carb, d.grow_in_glu]);  // 散点图
  const subjectDim = cf.dimension(d => d.subject_id);                 // 受试者

  // 4. 定义分组（group）
  const timeGroup   = timeDim.group().reduceCount();
  const carbGroup   = carbDim.group().reduceCount();
  const protGroup   = protDim.group().reduceCount();
  const allEvents   = cf.groupAll();

  // 5. 配置并渲染各图表

  // —— 5.1 进食时段柱状图 ——
  dc.barChart("#time-histogram .dc-chart")
    .width(300).height(200)
    .dimension(timeDim).group(timeGroup)
    .x(d3.scaleLinear().domain([0,24]))
    .xUnits(dc.units.fp.precision(1))
    .elasticY(true)
    .brushOn(true);

  // —— 5.2 碳水柱状图 ——
  dc.barChart("#carb-histogram .dc-chart")
    .width(300).height(200)
    .dimension(carbDim).group(carbGroup)
    .x(d3.scaleLinear().domain([0, d3.max(data, d=>d.total_carb)]))
    .xUnits(dc.units.fp.precision(10))
    .elasticY(true)
    .brushOn(true);

  // —— 5.3 蛋白质柱状图 ——
  dc.barChart("#protein-histogram .dc-chart")
    .width(300).height(200)
    .dimension(protDim).group(protGroup)
    .x(d3.scaleLinear().domain([0, d3.max(data, d=>d.protein_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  // —— 5.4 碳水 vs 血糖上升 散点图 ——
  dc.scatterPlot("#scatter-plot .dc-chart")
    .width(300).height(300)
    .x(d3.scaleLinear().domain([0, d3.max(data, d=>d.total_carb)+10]))
    .y(d3.scaleLinear().domain([0, d3.max(data, d=>d.grow_in_glu)+10]))
    .symbolSize(5)
    .dimension(scatterDim)
    .group(scatterDim.group())
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true)
    .brushOn(true);

  // —— 5.5 受试者下拉筛选 ——
  dc.selectMenu("#subject-select .dc-chart")
    .dimension(subjectDim).group(subjectDim.group())
    .multiple(false).numberVisible(10);

  // —— 5.6 总事件数展示 ——
  dc.numberDisplay("#total-count .dc-chart")
    .formatNumber(d3.format("d"))
    .valueAccessor(d => d)
    .group(allEvents);

  // 6. 全部渲染
  dc.renderAll();

  // 7. 重置按钮
  d3.select("#reset-filters").on("click", () => {
    dc.filterAll();
    dc.renderAll();
  });
});
