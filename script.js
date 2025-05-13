// script.js
// Override DC.js default color scheme to avoid deprecated d3.schemeCategory20c warning
dc.config.defaultColors(d3.schemeTableau10);

const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

// Load CSV
Promise.all([
  d3.csv("added_food.csv", row => ({
    time_begin:  parseTime(row.time_begin),
    total_carb:  +row.total_carb,
    protein_g:   +row.protein,
    fat_g:       +row.total_fat,
    sugar_g:     +row.sugar,
    fiber_g:     +row.dietary_fiber,
    calorie:     +row.calorie,
    grow_in_glu: +row.grow_in_glu,
    person:      row.person
  })),
]).then(([data]) => {
  // Compute decimal meal hour
  data.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes() / 60;
  });

  const cf = crossfilter(data);
  // Dimensions
  const timeDim    = cf.dimension(d => Math.floor(d.mealHour));
  const personDim  = cf.dimension(d => d.person);
  const carbDim    = cf.dimension(d => Math.floor(d.total_carb/10)*10);
  const protDim    = cf.dimension(d => Math.floor(d.protein_g/5)*5);
  const fatDim     = cf.dimension(d => Math.floor(d.fat_g/5)*5);
  const sugarDim   = cf.dimension(d => Math.floor(d.sugar_g/5)*5);
  const fiberDim   = cf.dimension(d => Math.floor(d.fiber_g/2)*2);
  const calDim     = cf.dimension(d => Math.floor(d.calorie/100)*100);
  const scatterDim = cf.dimension(d => [d.total_carb, d.grow_in_glu]);
  const allCount   = cf.groupAll();

  // Groups
  const timeGrp   = timeDim.group().reduceCount();
  const carbGrp   = carbDim.group().reduceCount();
  const protGrp   = protDim.group().reduceCount();
  const fatGrp    = fatDim.group().reduceCount();
  const sugarGrp  = sugarDim.group().reduceCount();
  const fiberGrp  = fiberDim.group().reduceCount();
  const calGrp    = calDim.group().reduceCount();

  // Chart sizes
  const cw   = document.getElementById('charts').clientWidth;
  const barW = (cw - 32)/3, barH = 450;
  const scW  = cw - 32, scH = 600;

  // 1. Meal Time Histogram
  dc.barChart('#time-histogram .dc-chart')
    .width(barW).height(barH)
    .dimension(timeDim).group(timeGrp)
    .x(d3.scaleLinear().domain([0,24])).xUnits(dc.units.fp.precision(1))
    .elasticY(true).brushOn(true);

  // 2. Participant Selection
  dc.selectMenu('#subject-select .dc-chart')
    .dimension(personDim).group(personDim.group())
    .multiple(false).numberVisible(10);

  // 3. Event Count
  dc.numberDisplay('#total-count .dc-chart')
    .formatNumber(d3.format('d')).valueAccessor(d=>d)
    .group(allCount);

  // 4–9. Nutrient Histograms
  const configs = [
    { id:'carb-histogram', dim:carbDim, grp:carbGrp, max:d=>d.total_carb, precision:10 },
    { id:'prot-histogram', dim:protDim, grp:protGrp, max:d=>d.protein_g, precision:5 },
    { id:'fat-histogram',  dim:fatDim,  grp:fatGrp,  max:d=>d.fat_g,      precision:5 },
    { id:'sugar-histogram',dim:sugarDim,grp:sugarGrp,max:d=>d.sugar_g,    precision:5 },
    { id:'fiber-histogram',dim:fiberDim,grp:fiberGrp,max:d=>d.fiber_g,    precision:2 },
    { id:'calorie-histogram',dim:calDim,grp:calGrp,  max:d=>d.calorie,    precision:100 }
  ];
  configs.forEach(c=>{
    dc.barChart(`#${c.id} .dc-chart`)
      .width(barW).height(barH)
      .dimension(c.dim).group(c.grp)
      .x(d3.scaleLinear().domain([0,d3.max(data,c.max)]))
      .xUnits(dc.units.fp.precision(c.precision))
      .elasticY(true).brushOn(true);
  });

  // Build recordMap for tooltip lookup
  const recordMap = new Map();
  data.forEach(d=>recordMap.set(`${d.total_carb}|${d.grow_in_glu}`, d));

  // 10. Scatter Plot
  const scatter = dc.scatterPlot('#scatter-plot .dc-chart')
    .width(scW).height(scH)
    .dimension(scatterDim).group(scatterDim.group())
    .x(d3.scaleLinear().domain([0,d3.max(data,d=>d.total_carb)+10]))
    .y(d3.scaleLinear().domain([0,d3.max(data,d=>d.grow_in_glu)+10]))
    .symbolSize(8)
    .brushOn(false)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true)
    .renderTitle(false);

  // Attach tooltip on both initial render and redraw
  function attachTooltip(chart) {
    const grp = scatterDim.group().all();
    chart.svg().selectAll('circle.symbol')
      .data(grp)
      .style('cursor','pointer')
      .on('mouseover', (e,pd) => {
        const key = `${pd.key[0]}|${pd.key[1]}`;
        const d = recordMap.get(key);
        if(!d) return;
        d3.select('body').append('div').attr('class','tooltip')
          .html(`
            <strong>Person:</strong> ${d.person}<br/>
            <strong>Carbs:</strong> ${d.total_carb} g<br/>
            <strong>Protein:</strong> ${d.protein_g} g<br/>
            <strong>Fat:</strong> ${d.fat_g} g<br/>
            <strong>Δ Glucose:</strong> ${d.grow_in_glu} mg/dL
          `)
          .style('left',`${e.pageX+10}px`).style('top',`${e.pageY+10}px`);
      })
      .on('mouseout', ()=>d3.selectAll('.tooltip').remove());
  }

  scatter.on('postRender',attachTooltip);
  scatter.on('postRedraw',attachTooltip);

  // Render all
  dc.renderAll();

  // Reset filters
  d3.select('#reset-filters').on('click',()=>{dc.filterAll();dc.renderAll();});
});
