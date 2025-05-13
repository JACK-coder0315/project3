// script.js
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

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
  data.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes() / 60;
  });

  const cf = crossfilter(data);

  // Dimensions & Groups
  const timeDim    = cf.dimension(d => Math.floor(d.mealHour));
  const personDim  = cf.dimension(d => d.person);
  const allCount   = cf.groupAll();
  const timeGrp    = timeDim.group().reduceCount();

  const carbDim    = cf.dimension(d => Math.floor(d.total_carb / 10) * 10);
  const carbGrp    = carbDim.group().reduceCount();
  const protDim    = cf.dimension(d => Math.floor(d.protein_g / 5) * 5);
  const protGrp    = protDim.group().reduceCount();
  const fatDim     = cf.dimension(d => Math.floor(d.fat_g / 5) * 5);
  const fatGrp     = fatDim.group().reduceCount();
  const sugarDim   = cf.dimension(d => Math.floor(d.sugar_g / 5) * 5);
  const sugarGrp   = sugarDim.group().reduceCount();
  const fiberDim   = cf.dimension(d => Math.floor(d.fiber_g / 2) * 2);
  const fiberGrp   = fiberDim.group().reduceCount();
  const calDim     = cf.dimension(d => Math.floor(d.calorie / 100) * 100);
  const calGrp     = calDim.group().reduceCount();
  const scatterDim = cf.dimension(d => [d.total_carb, d.grow_in_glu]);

  // Chart sizes
  const cw   = document.getElementById('charts').clientWidth;
  const barW = (cw - 32) / 3, barH = 450;
  const scW  = cw - 32, scH = 600;

  // 1. Meal Time Histogram
  dc.barChart("#time-histogram .dc-chart")
    .width(barW).height(barH)
    .dimension(timeDim).group(timeGrp)
    .x(d3.scaleLinear().domain([0, 24])).xUnits(dc.units.fp.precision(1))
    .elasticY(true).brushOn(true);

  // 2. Participant Selection
  dc.selectMenu("#subject-select .dc-chart")
    .dimension(personDim).group(personDim.group())
    .multiple(false).numberVisible(10);

  // 3. Event Count
  dc.numberDisplay("#total-count .dc-chart")
    .formatNumber(d3.format("d")).valueAccessor(d => d)
    .group(allCount);

  // 4-9. Nutrient Histograms
  [
    { id: 'carb-histogram', dim: carbDim, grp: carbGrp, max: d => d.total_carb, precision: 10 },
    { id: 'prot-histogram', dim: protDim, grp: protGrp, max: d => d.protein_g, precision: 5 },
    { id: 'fat-histogram',  dim: fatDim,  grp: fatGrp,  max: d => d.fat_g,      precision: 5 },
    { id: 'sugar-histogram',dim: sugarDim,grp: sugarGrp,max: d => d.sugar_g,    precision: 5 },
    { id: 'fiber-histogram',dim: fiberDim,grp: fiberGrp,max: d => d.fiber_g,    precision: 2 },
    { id: 'calorie-histogram', dim: calDim, grp: calGrp, max: d => d.calorie,    precision: 100 }
  ].forEach(cfg => {
    dc.barChart(`#${cfg.id} .dc-chart`)
      .width(barW).height(barH)
      .dimension(cfg.dim).group(cfg.grp)
      .x(d3.scaleLinear().domain([0, d3.max(data, cfg.max)]))
      .xUnits(dc.units.fp.precision(cfg.precision))
      .elasticY(true).brushOn(true);
  });

  // 10. Scatter Plot
  dc.scatterPlot("#scatter-plot .dc-chart")
    .width(scW).height(scH)
    .dimension(scatterDim).group(scatterDim.group())
    .x(d3.scaleLinear().domain([0, d3.max(data, d => d.total_carb) + 10]))
    .y(d3.scaleLinear().domain([0, d3.max(data, d => d.grow_in_glu) + 10]))
    .symbolSize(8)
    .brushOn(true)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true);

  // Render all charts
  dc.renderAll();

  // Reset filters
  d3.select("#reset-filters").on("click", () => {
    dc.filterAll();
    dc.renderAll();
  });
});