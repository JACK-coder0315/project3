// script.js（纯 D3 实现）

// 1. 全局配置
const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
const margin = {top: 20, right: 20, bottom: 30, left: 40};

// 全局 state
const filters = {
  person: 'All',
  timeRange: [0,24]  // 0–24h
};

// 各图尺寸（可根据需要调整）
const WIDTH   = document.getElementById('charts').clientWidth;
const BAR_W   = (WIDTH - 32) / 3, BAR_H = 250;
const SCAT_W  = WIDTH - 32,     SCAT_H = 400;

// 容器选择器
const selectMenuDiv  = d3.select('#subject-select .dc-chart');
const numberDiv      = d3.select('#total-count .dc-chart');
const timeHistDiv    = d3.select('#time-histogram .dc-chart');
const histIds        = ['carb','prot','fat','sugar','fiber','calorie'];
const scatDiv        = d3.select('#scatter-plot .dc-chart');

// 2. 加载并预处理数据
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
}))
.then(rawData => {
  // 计算 mealHour
  rawData.forEach(d => {
    d.mealHour = d.time_begin.getHours() + d.time_begin.getMinutes()/60;
  });

  // 全部唯一 participants
  const people = ['All']
    .concat(Array.from(new Set(rawData.map(d=>d.person))).sort());

  // 3. 构建下拉菜单
  selectMenuDiv.append('select')
    .on('change', function() {
      filters.person = this.value;
      updateAll();
    })
    .selectAll('option')
    .data(people).enter()
    .append('option')
      .attr('value', d=>d)
      .text(d=>d);

  // 4. 初始化所有 SVG 画布
  // 4.1 时间直方图
  const svgTime = timeHistDiv.append('svg')
    .attr('width', BAR_W).attr('height', BAR_H+margin.top+margin.bottom)
    .append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  svgTime.append('g').attr('class','x-axis').attr('transform',`translate(0,${BAR_H})`);
  svgTime.append('g').attr('class','y-axis');

  // 4.2 营养直方图（6个放到两行三列）
  const svgHists = {};
  histIds.forEach((id,i) => {
    const div = d3.select(`#${id}-histogram .dc-chart`);
    svgHists[id] = div.append('svg')
      .attr('width', BAR_W).attr('height', BAR_H+margin.top+margin.bottom)
      .append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    svgHists[id].append('g').attr('class','x-axis')
      .attr('transform',`translate(0,${BAR_H})`);
    svgHists[id].append('g').attr('class','y-axis');
  });

  // 4.3 散点图
  const svgScat = scatDiv.append('svg')
    .attr('width', SCAT_W).attr('height', SCAT_H+margin.top+margin.bottom)
    .append('g').attr('transform',`translate(${margin.left},${margin.top})`);
  svgScat.append('g').attr('class','x-axis').attr('transform',`translate(0,${SCAT_H})`);
  svgScat.append('g').attr('class','y-axis');

  // Tooltip DIV（隐藏）
  d3.select('body').append('div')
    .attr('class','tooltip')
    .style('position','absolute')
    .style('display','none');

  // 5. 更新并重绘所有图表
  function updateAll() {
    // 5.1 过滤数据
    const filtered = rawData.filter(d => {
      return (filters.person==='All' || d.person===filters.person)
          && d.mealHour >= filters.timeRange[0]
          && d.mealHour <= filters.timeRange[1];
    });

    // 5.2 更新事件总数
    numberDiv.text(filtered.length);

    // 5.3 时间直方图
    drawHistogram({
      svg: svgTime,
      data: filtered.map(d=>d.mealHour),
      domain: [0,24],
      bins: d3.range(0,25),
      xLabel: 'Hour',
      width: BAR_W- margin.left - margin.right,
      height: BAR_H
    });

    // 5.4 营养直方图
    const configs = [
      {id:'carb',    accessor:d=>d.total_carb,  domain:[0,d3.max(rawData,d=>d.total_carb)],   step:10, label:'Carbs (g)'},
      {id:'prot',    accessor:d=>d.protein_g,   domain:[0,d3.max(rawData,d=>d.protein_g)],    step:5,  label:'Protein (g)'},
      {id:'fat',     accessor:d=>d.fat_g,       domain:[0,d3.max(rawData,d=>d.fat_g)],        step:5,  label:'Fat (g)'},
      {id:'sugar',   accessor:d=>d.sugar_g,     domain:[0,d3.max(rawData,d=>d.sugar_g)],      step:5,  label:'Sugar (g)'},
      {id:'fiber',   accessor:d=>d.fiber_g,     domain:[0,d3.max(rawData,d=>d.fiber_g)],      step:2,  label:'Fiber (g)'},
      {id:'calorie', accessor:d=>d.calorie,     domain:[0,d3.max(rawData,d=>d.calorie)],      step:100,label:'Calories'}
    ];
    configs.forEach(cfg => {
      drawHistogram({
        svg:       svgHists[cfg.id],
        data:      filtered.map(cfg.accessor),
        domain:    cfg.domain,
        bins:      d3.range(cfg.domain[0], cfg.domain[1]+cfg.step, cfg.step),
        xLabel:    cfg.label,
        width:     BAR_W- margin.left - margin.right,
        height:    BAR_H
      });
    });

    // 5.5 散点图
    drawScatter({
      svg:     svgScat,
      data:    filtered,
      xAcc:    d=>d.total_carb,
      yAcc:    d=>d.grow_in_glu,
      width:   SCAT_W- margin.left - margin.right,
      height:  SCAT_H
    });
  }

  // 6. 通用：绘制直方图
  function drawHistogram({svg,data,domain,bins,xLabel,width,height}) {
    const x = d3.scaleLinear().domain(domain).range([0,width]);
    const histogram = d3.histogram()
      .domain(x.domain())
      .thresholds(bins)
      (data);
    const y = d3.scaleLinear()
      .domain([0, d3.max(histogram,d=>d.length)]).nice()
      .range([height,0]);

    // Bars
    const bars = svg.selectAll('rect.bar').data(histogram);
    bars.join('rect')
      .attr('class','bar')
      .attr('x', d=>x(d.x0))
      .attr('y', d=>y(d.length))
      .attr('width', d=>x(d.x1)-x(d.x0)-1)
      .attr('height', d=>height - y(d.length))
      .attr('fill','steelblue');

    // Axes
    svg.select('.x-axis')
      .call(d3.axisBottom(x).ticks(Math.min(10,bins.length)))
      .selectAll('text').attr('dy','0.5em');
    svg.select('.y-axis')
      .call(d3.axisLeft(y).ticks(5));
  }

  // 7. 绘制散点图 + tooltip
  function drawScatter({svg,data,xAcc,yAcc,width,height}) {
    const x = d3.scaleLinear()
      .domain([0, d3.max(data,xAcc)]).nice()
      .range([0,width]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data,yAcc)]).nice()
      .range([height,0]);

    // Draw points
    const pts = svg.selectAll('circle.dot').data(data, d=>d.person+'|'+xAcc(d)+'|'+yAcc(d));
    pts.join('circle')
      .attr('class','dot')
      .attr('cx', d=>x(xAcc(d)))
      .attr('cy', d=>y(yAcc(d)))
      .attr('r', 5)
      .attr('fill','orange')
      .style('cursor','pointer')
      .on('mouseover', (event,d) => {
        d3.select('.tooltip')
          .style('display','block')
          .html(`
            <strong>Person:</strong> ${d.person}<br/>
            <strong>Carbs:</strong> ${d.total_carb} g<br/>
            <strong>Protein:</strong> ${d.protein_g} g<br/>
            <strong>Fat:</strong> ${d.fat_g} g<br/>
            <strong>Δ Glucose:</strong> ${d.grow_in_glu} mg/dL
          `)
          .style('left', `${event.pageX+10}px`)
          .style('top',  `${event.pageY+10}px`);
      })
      .on('mouseout', () => {
        d3.select('.tooltip').style('display','none');
      });

    // Axes
    svg.select('.x-axis').call(d3.axisBottom(x));
    svg.select('.y-axis').call(d3.axisLeft(y));
  }

  // 初次绘制
  updateAll();
});
