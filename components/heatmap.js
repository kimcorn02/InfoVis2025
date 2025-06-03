import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

function Correlation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a,b) => a + b, 0) / n;
  const meanY = y.reduce((a,b) => a + b, 0) / n;

  let numerator = 0, denomX = 0, denomY = 0;
  for(let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  return numerator / Math.sqrt(denomX * denomY);
}

export async function drawHeatmap(csvFile) {
  const rawData = await d3.csv(csvFile);

  rawData.forEach(d => {
    const valueListStr = d.value_list.replace(/'/g, '"');
    d.value_list = JSON.parse(valueListStr);
    d.value_rank = JSON.parse(d.value_rank);
  });

  const roles = ["all", ...Array.from(new Set(rawData.map(d => d.role)))];
  const genres = ["all", ...Array.from(new Set(rawData.map(d => d.genre)))];

  // 필터 select 박스
  const roleSelect = d3.select("#heatRoleFilter");
  roles.forEach(r => roleSelect.append("option").attr("value", r).text(r));
  const genreSelect = d3.select("#heatGenreFilter");
  genres.forEach(g => genreSelect.append("option").attr("value", g).text(g));

  const searchInput = d3.select("#characterSearch");
  const searchButton = d3.select("#characterSearchButton");

  const size = 1200;
  const margin = {top: 10, right: 10, bottom: 100, left: 100};
  const svg = d3.select("#heatmap")
    .attr("width", size)
    .attr("height", size);

  const g = svg.append("g");
  const gMain = g.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const zoom = d3.zoom()
    .scaleExtent([1, 10]) // 최소 1배 ~ 최대 10배
    .translateExtent([[0, 0], [size, size]])
    .extent([[0, 0], [size, size]])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom); // svg에 zoom behavior 연결

  var tooltip = d3.select("body") 
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px")
    .style("pointer-events", "none");

  function update(selectedRole, selectedGenre, searchText = "") {
    // 필터링
    let filtered = rawData;
    if (selectedRole !== "all") filtered = filtered.filter(d => d.role === selectedRole);
    if (selectedGenre !== "all") filtered = filtered.filter(d => d.genre === selectedGenre);

    if (filtered.length > 0) {
      filtered.sort((a, b) => {
        const roleOrder = { protagonist: 0, antagonist: 1 };
        return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      });
    }

    // 전체 캐릭터 유지
    const characters = filtered.map(d => d.name);

    // 검색어로 하이라이트할 캐릭터만 따로 추림
    const lowerSearch = searchText.toLowerCase();
    const highlightedChars = characters.filter(name => name.toLowerCase().includes(lowerSearch));

    if (characters.length === 0) {
      g.selectAll("*").remove();
      return;
    }

    d3.select("#charInfo").html(
      `<p style="font-style: italic; color: gray;">
        Click a cell in the heatmap to see detailed priority comparisons between characters.
      </p>`
    );

    const cellSize = (size - margin.left - margin.right) / characters.length;
    const heatmapWidth = cellSize * characters.length;
    const heatmapHeight = cellSize * characters.length;

     svg.call(
      zoom
        .translateExtent([[0, 0], [heatmapWidth + margin.left + margin.right, heatmapHeight + margin.top + margin.bottom]])
        .extent([[0, 0], [heatmapWidth + margin.left + margin.right, heatmapHeight + margin.top + margin.bottom]])
    );

    // similarity matrix 생성
    const matrix = characters.map((charA, i) =>
      characters.map((charB, j) => {
        if (i === j) return 1;
        const rankA = filtered[i].value_rank;
        const rankB = filtered[j].value_rank;
        return Correlation(rankA, rankB);
      })
    );

    const x = d3.scaleBand()
      .domain(characters)
      .range([0, cellSize * characters.length]);

    const y = d3.scaleBand()
      .domain(characters)
      .range([0, cellSize * characters.length]);

    const colorScale = d3.scaleSequential()
      .domain([0, 1])
      .interpolator(d3.interpolateRdBu);

    gMain.selectAll("*").remove();

    gMain.selectAll("rect")
      .data(matrix.flatMap((row, i) => row.map((value, j) => ({x: j, y: i, value}))))
      .join("rect")
      .attr("x", d => x(characters[d.x]))
      .attr("y", d => y(characters[d.y]))
      .attr("width", cellSize)
      .attr("height", cellSize)
      .style("fill", d => colorScale(d.value))
      .style("opacity", d => {
        return (highlightedChars.length === 0 || highlightedChars.includes(characters[d.x]) || highlightedChars.includes(characters[d.y])) ? 1 : 0.3;
      })
      .on("mouseover", function(event, d) {
        tooltip.style("opacity", 1);
      })
      .on("mousemove", function(event, d) {
        tooltip
          .html(`${characters[d.y]} vs ${characters[d.x]}<br>Similarity: ${d.value.toFixed(3)}`)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY) + "px");
      })
      .on("mouseleave", function(event, d) {
        tooltip.style("opacity", 0);
      })
      .on("click", (event, d) => {
        const charA = characters[d.y];
        const charB = characters[d.x];

        const charAData = filtered.find(c => c.name === charA);
        const charBData = filtered.find(c => c.name === charB);

        const tableRows = Array.from({ length: charAData.value_list.length }, (_, i) => {
          const backgroundColor = i % 2 === 0 ? '#ffffff' : '#f0f0f0';
          
          return `
            <tr style="background-color: ${backgroundColor};">
              <td style="padding: 3px; width: 30px;">${i + 1}</td>
              <td style="padding: 3px; width: 300px;">${charAData.value_list[i]}</td>
              <td style="padding: 3px; width: 300px;">${charBData.value_list[i]}</td>
            </tr>
          `;
        }).join("")

        const correlation = Correlation(charAData.value_rank, charBData.value_rank);
        
        const infoHtml = `
          <p><strong>Correlation</strong> (${charA} vs ${charB}): <strong>${correlation.toFixed(3)}</strong></p>
          <table style="border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ccc; padding: 5px;">Rank</th>
                <th style="border: 1px solid #ccc; padding: 5px; width: 300px">${charA}</th>
                <th style="border: 1px solid #ccc; padding: 5px; width: 300px">${charB}</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        `;

        d3.select("#charInfo").html(infoHtml);
      })
      .each(function(d) {
        d3.select(this)
          .append("title")
          .text(`${characters[d.y]} vs ${characters[d.x]}`);
      });
    
      // x축 라벨
    const xAxisG = gMain.append("g")
      .attr("transform", `translate(0, ${cellSize * characters.length})`)
      .call(d3.axisBottom(x));

    xAxisG.selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "8px")
      .style("fill", d => {
        const role = filtered.find(c => c.name === d)?.role;
        if (role === "protagonist") return "blue";
        if (role === "antagonist") return "red";
        return "black";
      });

    // y축 라벨
    const yAxisG = gMain.append("g")
      .call(d3.axisLeft(y));

    yAxisG.selectAll("text")
      .style("font-size", "8px")
      .style("fill", d => {
        const role = filtered.find(c => c.name === d)?.role;
        if (role === "protagonist") return "blue";
        if (role === "antagonist") return "red";
        return "black";
      });
  }


  // 초기 렌더링 (all)
  update("all", "all", "");

  searchButton.on("click", () => {
    const searchText = searchInput.property("value").trim();
    update(roleSelect.node().value, genreSelect.node().value, searchText);
  });

  // 이벤트 리스너 연결
  roleSelect.on("change", () => {
    const searchText = searchInput.property("value").trim();
    update(roleSelect.node().value, genreSelect.node().value, searchText);
  });

  genreSelect.on("change", () => {
    const searchText = searchInput.property("value").trim();
    update(roleSelect.node().value, genreSelect.node().value, searchText);
  });

}

drawHeatmap("https://raw.githubusercontent.com/kimcorn02/InfoVis2025/refs/heads/main/data.csv");