// script.js

// 1. 定义一个解析时间的函数，格式需与 CSV 中的 time_begin 字段匹配
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

// 2. 加载 CSV，并在加载时把各字段转换成合适的类型
d3.csv("all_glu_food.csv", d => ({
  // 将 time_begin 字符串解析成 JS Date 对象
  time_begin:   parseTime(d.time_begin),
  // 数值字段
  total_carb:   +d.total_carb,
  protein_g:    +d.protein,
  fat_g:        +d.total_fat,
  grow_in_glu:  +d.grow_in_glu,
  // 受试者编号，保持为字符串
  person:       d.person
})).then(data => {
  // 3. 预处理：计算进食时刻的小数小时表示
  data.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes() / 60;
  });

  // 4. 初始化 Crossfilter
  const cf = crossfilter(data);

  // 5. 定义各个维度 (dimensions)
  const timeDim    = cf.dimension(d => Math.floor(d.mealHour));            // 按整点小时分箱
  const carbDim    = cf.dimension(d => Math.floor(d.total_carb / 10) * 10); // 每 10g 一档
  const protDim    = cf.dimension(d => Math.floor(d.protein_g / 5) * 5);   // 每 5g 一档
  const scatterDim = cf.dimension(d => [d.total_carb, d.grow_in_glu]);     // 用于散点图
  const personDim  = cf.dimension(d => d.person);                          // 用于受试者筛选

  // 6. 定义各个分组 (groups)
  const timeGroup = timeDim.group().reduceCount();
  const carbGroup = carbDim.group().reduceCount();
  const protGroup = protDim.group().reduceCount();
  const allEvents = cf.groupAll();

  // 7. 配置并渲染图表

  // —— 时间段柱状图 ——
  dc.barChart("#time-histogram .dc-chart")
    .width(300).height(200)
    .dimension(timeDim).group(timeGroup)
    .x(d3.scaleLinear().domain([0, 24]))
    .xUnits(dc.units.fp.precision(1))
    .elasticY(true)
    .brushOn(true);

  // —— 碳水化合物柱状图 ——
  dc.barChart("#carb-histogram .dc-chart")
    .width(300).height(200)
    .dimension(carbDim).group(carbGroup)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.total_carb)]))
    .xUnits(dc.units.fp.precision(10))
    .elasticY(true)
    .brushOn(true);

  // —— 蛋白质柱状图 ——
  dc.barChart("#protein-histogram .dc-chart")
    .width(300).height(200)
    .dimension(protDim).group(protGroup)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.protein_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  // —— 碳水 vs. 血糖上升 散点图 ——
  dc.scatterPlot("#scatter-plot .dc-chart")
    .width(300).height(300)
    .dimension(scatterDim)
    .group(scatterDim.group())
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.total_carb) + 10]))
    .y(d3.scaleLinear().domain([0, d3.max(data, d => d.grow_in_glu) + 10]))
    .symbolSize(5)
    .brushOn(true)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true);

  // —— 受试者筛选下拉菜单 ——
  dc.selectMenu("#subject-select .dc-chart")
    .dimension(personDim)
    .group(personDim.group())
    .multiple(false)
    .numberVisible(10);

  // —— 当前总事件数展示 ——
  dc.numberDisplay("#total-count .dc-chart")
    .formatNumber(d3.format("d"))
    .valueAccessor(d => d)
    .group(allEvents);

  // 8. 最终渲染所有图表
  dc.renderAll();

  // 9. 重置按钮逻辑：清空所有筛选并重新渲染
  d3.select("#reset-filters").on("click", () => {
    dc.filterAll();
    dc.renderAll();
  });
});
