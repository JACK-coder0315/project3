// 1. 加载一餐级主表
d3.json("meal_daily.json").then(meal => {
  const cf = crossfilter(meal);

  // 2. 创建维度
  const personDim = cf.dimension(d => d.person);                       // 受试者
  const timeDim   = cf.dimension(d => Math.floor(d.minute_in_day/60)); // 按小时分箱
  const deltaDim  = cf.dimension(d => Math.floor(d.grow_in_glu/10)*10); // ΔGlu 10 mg/dL bin

  // 3. 创建分组
  const personGrp = personDim.group();
  const timeGrp   = timeDim.group();  
  const deltaGrp  = deltaDim.group();

  // 4. 自定义 reduce：宏量营养素累加
  const nutDim = cf.dimension(() => "all"); 
  const nutGrp = nutDim.group().reduce(
    (p,v) => {
      p.carb   += v.total_carb;
      p.fat    += v.total_fat;
      p.protein+= v.protein;
      return p;
    },
    (p,v) => {
      p.carb   -= v.total_carb;
      p.fat    -= v.total_fat;
      p.protein-= v.protein;
      return p;
    },
    () => ({carb:0, fat:0, protein:0})
  );


  // ——到此，Crossfilter 数据模型就准备好了——


  // 5. 受试者 SelectMenu
  dc.selectMenu("#person-select")
    .dimension(personDim)
    .group(personGrp)
    .promptText("全部受试者");


  // 6. 用餐时间段 柱状（小时分布）
  dc.barChart("#time-chart")
    .width(480).height(200)
    .dimension(timeDim).group(timeGrp)
    .x(d3.scaleLinear().domain([0,24]))
    .xUnits(() => 24)
    .brushOn(true)
    .elasticY(true)
    .yAxisLabel("次数")
    .xAxisLabel("小时(0–24)")
    .renderHorizontalGridLines(true);


  // 7. 宏量营养素 堆叠比例柱状
  //    用 valueAccessor 计算百分比
  const totalKey = d =>
    d.value.carb + d.value.fat + d.value.protein;

  const chartNut = dc.barChart("#nutrient-chart")
    .width(480).height(200)
    .dimension(nutDim).group(nutGrp, "碳水", d=>d.value.carb)
    .valueAccessor(d => d.value.carb / totalKey(d))
    .stack(nutGrp, "脂肪",  d=>d.value.fat / totalKey(d))
    .stack(nutGrp, "蛋白质", d=>d.value.protein / totalKey(d))
    .x(d3.scaleBand().domain(["all"]))
    .xUnits(dc.units.ordinal)
    .elasticY(true)
    .legend(new dc.Legend().x(380).y(10))
    .yAxis().tickFormat(d3.format(".0%"));


  // 8. ΔGlu 直方图
  dc.barChart("#delta-chart")
    .width(960).height(250)
    .dimension(deltaDim).group(deltaGrp)
    .x(d3.scaleLinear().domain([
      d3.min(meal, d=>d.grow_in_glu),
      d3.max(meal, d=>d.grow_in_glu)
    ]))
    .xUnits(() => 20)
    .elasticY(true)
    .brushOn(false)
    .yAxisLabel("餐次数")
    .xAxisLabel("ΔGlu (mg/dL)");

  // 9. 渲染 & 启动联动
  dc.renderAll();
});
