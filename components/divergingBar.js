import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let globalData;
let divergingBarData = [];

export async function initDivergingBar(csvFile) {
  globalData = await d3.csv(csvFile);

  // value_list 파싱 후 0번째 값 추출
  globalData.forEach(d => {
    d.value_list_parsed = JSON.parse(d.value_list.replace(/'/g, '"'));
    d.topValue = d.value_list_parsed[0];
  });

  // createGenreDropdown();
  drawDivergingBarChart();  // 초기 전체 차트

  // 복사 버튼 이벤트 등록 (한 번만)
  const copyBtn = document.getElementById("copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyDivergingBarChartData);
  }
}

function drawDivergingBarChart(selectedGenres = [], selectedRole = "all") {
  let filteredData = globalData;

  if (selectedGenres.length === 0) {
    filteredData = [];  // 선택된 장르가 없으면 빈 데이터로
  } else {
    filteredData = filteredData.filter(d => selectedGenres.includes(d.genre));
  }

  if (selectedRole !== "all") {
    filteredData = filteredData.filter(d => d.role === selectedRole);
  }

  // 역할 필터링
  const roles = ["protagonist", "antagonist"];

  const allValues = Array.from(new Set(filteredData.map(d => d.topValue)));

  const counts = {};
  roles.forEach(role => {
    counts[role] = {};
    allValues.forEach(v => counts[role][v] = 0);
  });

  filteredData.forEach(d => {
    if (roles.includes(d.role) && d.topValue) {
      counts[d.role][d.topValue]++;
    }
  });

  const totalCounts = {};
  roles.forEach(role => {
    totalCounts[role] = d3.sum(allValues.map(v => counts[role][v]));
  });

  const data = allValues.map(value => {
    const p = totalCounts.protagonist > 0 ? counts.protagonist[value] / totalCounts.protagonist : 0;
    const a = totalCounts.antagonist > 0 ? counts.antagonist[value] / totalCounts.antagonist : 0;
    return { valueName: value, value: a - p, p, a };
  });

  data.sort((a, b) => b.value - a.value);

  divergingBarData = data;

  // 나머지는 그대로
  const margin = { top: 30, right: 60, bottom: 30, left: 150 };
  const width = 1000
  const barHeight = 25;
  const height = 300

  const extent = d3.extent(data, d => d.value);
  const x = d3.scaleLinear()
    .domain(extent[0] !== undefined ? extent : [-1, 1])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.valueName))
    .rangeRound([margin.top, height - margin.bottom])
    .padding(0.1);

  const format = d3.format("+.1%");

  const svg = d3.select("#divergingBar")
    .attr("width", width)
    .attr("height", height)
    .attr("style", "font: 12px sans-serif;");

  const offset = -30;
  svg.selectAll("*").remove();

  svg.append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("fill", d => d.value > 0 ? d3.schemeRdBu[3][0] : d3.schemeRdBu[3][2])
    .attr("x", d => x(Math.min(d.value, 0)))
    .attr("y", d => y(d.valueName))
    .attr("width", d => Math.abs(x(d.value) - x(0)))
    .attr("height", y.bandwidth());

  svg.append("g")
    .attr("fill", "black")
    .attr("font-size", 11)
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("text-anchor", d => d.value < 0 ? "start" : "end")
    .attr("x", d => d.value < 0 ? x(d.value) + offset : x(d.value) - offset)
    .attr("y", d => y(d.valueName) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .text(d => format(d.value));

  svg.append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(d3.axisTop(x).ticks(5).tickFormat(d3.format(".0%")))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("y2", height - margin.top - margin.bottom)
      .attr("stroke-opacity", 0.1));

  svg.append("g")
    .attr("transform", `translate(${x(0)},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => {
      g.select(".domain").remove();
      g.selectAll(".tick text")
        .attr("text-anchor", d => {
          const datum = data.find(item => item.valueName === d);
          return datum && datum.value < 0 ? "start" : "end";
        })
        .attr("x", d => {
          const datum = data.find(item => item.valueName === d);
          return datum && datum.value < 0 ? 6 : -6;
        });
    });

  svg.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "black");
}

function copyDivergingBarChartData() {
  if (!divergingBarData || divergingBarData.length === 0) {
    alert("No data to copy.");
    return;
  }

  const textToCopy = divergingBarData.map(d =>
    `${d.valueName}: ${(d.value * 100).toFixed(1)}% (p: ${(d.p * 100).toFixed(1)}%, a: ${(d.a * 100).toFixed(1)}%)`
  ).join("\n");

  navigator.clipboard.writeText(textToCopy).then(() => {
    alert("Character value data copied!");
  }).catch(err => {
    alert("Failed to copy data: " + err);
  });
}

export { drawDivergingBarChart}