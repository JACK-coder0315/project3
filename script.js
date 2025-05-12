// script.js

// 1. 时间解析器，格式需与 CSV 中 time_begin 字段一致
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

// 2. 加载 CSV 并转换字段类型
d3.csv("all_glu_food.csv", d => ({
  time_begin:  parseTime(d.time_begin),
  total_carb:  +d.total_carb,
  protein_g:   +d.protein,
  fat_g:       +d.total_fat,
  sugar_g:     +d.sugar,
  fiber_g:     +d.dietary_fiber,
  calorie:     +d.calorie,
  grow_in_glu: +d.grow_in_glu,
  person:      d.person
})).then(data => {
  // 3. 预处理：计算进餐时刻的小数小时表示
  data.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes() / 60;
  });

  const cf = crossfilter(data);

  // 4. 定义维度
  const timeDim   = cf.dimension(d => Math.floor(d.mealHour));
  const personDim = cf.dimension(d => d.person);
  const carbDim   = cf.dimension(d => Math.floor(d.total_carb / 10) * 10);
  const protDim   = cf.dimension(d => Math.floor(d.protein_g / 5) * 5);
  const fatDim    = cf.dimension(d => Math.floor(d.fat_g / 5) * 5);
  const sugarDim  = cf.dimension(d => Math.floor(d.sugar_g / 5) * 5);
  const fiberDim  = cf.dimension(d => Math.floor(d.fiber_g / 2) * 2);
  const calDim    = cf.dimension(d => Math.floor(d.calorie / 100) * 100);
  const scatterD  = cf.dimension(d => [d.total_carb, d.grow_in_glu]);

  // 5. 定义分组
  const allCount  = cf.groupAll();
  const timeGrp   = timeDim.group().reduceCount();
  const carbGrp   = carbDim.group().reduceCount();
  const protGrp   = protDim.group().reduceCount();
  const fatGrp    = fatDim.group().reduceCount();
  const sugarGrp  = sugarDim.group().reduceCount();
  const fiberGrp  = fiberDim.group().reduceCount();
  const calGrp    = calDim.group().reduceCount();

  // 6. 设置图表尺寸
  const barW  = 450;
  const barH  = 450;
  const scW   = 900;
  const scH   = 600;

  // 7. 渲染图表

  dc.barChart("#time-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(timeDim).group(timeGrp)
    .x(d3.scaleLinear().domain([0,24]))
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
    .group(allCount);

  dc.barChart("#carb-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(carbDim).group(carbGrp)
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.total_carb)]))
    .xUnits(dc.units.fp.precision(10))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#prot-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(protDim).group(protGrp)
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.protein_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#fat-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(fatDim).group(fatGrp)
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.fat_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#sugar-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(sugarDim).group(sugarGrp)
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.sugar_g)]))
    .xUnits(dc.units.fp.precision(5))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#fiber-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(fiberDim).group(fiberGrp)
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.fiber_g)]))
    .xUnits(dc.units.fp.precision(2))
    .elasticY(true)
    .brushOn(true);

  dc.barChart("#calorie-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(calDim).group(calGrp)
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.calorie)]))
    .xUnits(dc.units.fp.precision(100))
    .elasticY(true)
    .brushOn(true);

  dc.scatterPlot("#scatter-plot .dc-chart")
    .width(scW).height(scH)
    .dimension(scatterD).group(scatterD.group())
    .x(d3.scaleLinear().domain([0,d3.max(data, d=>d.total_carb)+10]))
    .y(d3.scaleLinear().domain([0,d3.max(data, d=>d.grow_in_glu)+10]))
    .symbolSize(8)
    .brushOn(true)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true);

  // 8. 渲染所有
  dc.renderAll();

  // 9. 重置逻辑
  d3.select("#reset-filters").on("click", () => {
    dc.filterAll();
    dc.renderAll();
  });
});
