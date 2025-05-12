// script.js

// 1. 设置时间解析器，格式需与 CSV 中的 time_begin 字段一致
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

// 2. 加载 CSV 并在加载时把各字段转换成合适的类型
d3.csv("all_glu_food.csv", d => ({
  time_begin:  parseTime(d.time_begin),      // 转成 JS Date
  total_carb:  +d.total_carb,
  protein_g:   +d.protein,
  fat_g:       +d.total_fat,
  sugar_g:     +d.sugar,
  fiber_g:     +d.dietary_fiber,
  calorie:     +d.calorie,
  grow_in_glu: +d.grow_in_glu,
  person:      d.person
})).then(data => {
  // 3. 预处理：计算进餐时刻的小时小数表示
  data.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes() / 60;
  });

  // 4. 初始化 Crossfilter
  const cf = crossfilter(data);

  // 5. 定义各维度（dimension）
  const timeDim   = cf.dimension(d => Math.floor(d.mealHour));
  const personDim = cf.dimension(d => d.person);
  const carbDim   = cf.dimension(d => Math.floor(d.total_carb / 10) * 10);
  const protDim   = cf.dimension(d => Math.floor(d.protein_g / 5) * 5);
  const fatDim    = cf.dimension(d => Math.floor(d.fat_g / 5) * 5);
  const sugarDim  = cf.dimension(d => Math.floor(d.sugar_g / 5) * 5);
  const fiberDim  = cf.dimension(d => Math.floor(d.fiber_g / 2) * 2);
  const calDim    = cf.dimension(d => Math.floor(d.calorie / 100) * 100);
  const scatterD  = cf.dimension(d => [d.total_carb, d.grow_in_glu]);

  // 6. 定义各分组（group）
  const countAll  = cf.groupAll();
  const timeGrp   = timeDim.group().reduceCount();
  const carbGrp   = carbDim.group().reduceCount();
  const protGrp   = protDim.group().reduceCount();
  const fatGrp    = fatDim.group().reduceCount();
  const sugarGrp  = sugarDim.group().reduceCount();
  const fiberGrp  = fiberDim.group().reduceCount();
  const calGrp    = calDim.group().reduceCount();

  // 7. 配置并渲染图表

  dc.barChart("#time-histogram .dc-chart")
    .width(300).height(300)
    .dimension(timeDim).group(timeGrp)
    .x(d3.scaleLinear().domain([0, 24]))
    .xUnits(dc.units.fp.precision(1))
    .elasticY(true)
    .brushOn(true);

  dc.selectMenu("#subject-select .dc-chart")
    .dimension(personDim)
    .group(personDim.group())
    .multiple(false)
    .numberVisible(10);

  dc.numberDisplay("#total-count .dc-chart")
    .formatNumber(d3.format("d"))
    .valueAccessor(d => d)
    .group(countAll);

  dc.barChart("#carb-histogram .dc-chart")
    .width(300).height(300)
    .dimension(carbDim).group(carbGrp)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.total_carb)]))
    .xUnits(dc.units.fp.precision(10))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#prot-histogram .dc-chart")
    .width(300).height(300)
    .dimension(protDim).group(protGrp)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.protein_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#fat-histogram .dc-chart")
    .width(300).height(300)
    .dimension(fatDim).group(fatGrp)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.fat_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#sugar-histogram .dc-chart")
    .width(300).height(300)
    .dimension(sugarDim).group(sugarGrp)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.sugar_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#fiber-histogram .dc-chart")
    .width(300).height(300)
    .dimension(fiberDim).group(fiberGrp)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.fiber_g)]))
    .xUnits(dc.units.fp.precision(2))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#calorie-histogram .dc-chart")
    .width(300).height(300)
    .dimension(calDim).group(calGrp)
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.calorie)]))
    .xUnits(dc.units.fp.precision(100))
    .elasticY(true)
    .brushOn(true);

  dc.scatterPlot("#scatter-plot .dc-chart")
    .width(700).height(400)
    .dimension(scatterD).group(scatterD.group())
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.total_carb) + 10]))
    .y(d3.scaleLinear().domain([0, d3.max(data, d => d.grow_in_glu) + 10]))
    .symbolSize(6)
    .brushOn(true)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true);

  // 最后渲染
  dc.renderAll();

  // 重置所有筛选
  d3.select("#reset-filters").on("click", () => {
    dc.filterAll();
    dc.renderAll();
  });
});
