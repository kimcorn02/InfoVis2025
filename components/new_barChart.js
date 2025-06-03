import { initDivergingBar, drawDivergingBarChart } from './divergingBar.js';

await initDivergingBar("https://raw.githubusercontent.com/kimcorn02/InfoVis2025/refs/heads/main/data.csv");

export async function drawBarChart(csvFile) {
  const rawData = await d3.csv(csvFile);
  
  rawData.forEach(d => {
    d.value_list = JSON.parse(d.value_list.replace(/'/g, '"'));
    d.value_rank = JSON.parse(d.value_rank);
    d.vec = d.vec.trim().split(/\s+/).map(Number);
  });

  const allCategories = Array.from(new Set(rawData.map(d => d.value_list[0])));
  const roles = Array.from(new Set(rawData.map(d => d.role))).sort();
  const genres = Array.from(new Set(rawData.map(d => d.genre))).sort();

  // role select 박스 옵션 넣기
  const roleSelect = d3.select("#barRoleFilter");
  roleSelect.append("option").attr("value", "all").text("All Roles");
  roles.forEach(r => {
    roleSelect.append("option").attr("value", r).text(r);
  });

  const genreCheckboxContainer = d3.select("#barGenreCheckboxes");

  const selectAllLabel = genreCheckboxContainer.insert("label", ":first-child")
    .style("margin-right", "20px")
    .style("font-weight", "bold");

  selectAllLabel.append("input")
    .attr("type", "checkbox")
    .attr("id", "selectAllGenres")
    .property("checked", true);

  selectAllLabel.append("span").text(" selectAll");

  // 전체선택 체크박스 클릭 시
  d3.select("#selectAllGenres").on("change", function(event) {
    const checked = this.checked;

    // 모든 장르 체크박스의 체크 상태 변경
    genreCheckboxContainer.selectAll("input[type=checkbox]")
      .filter(function() { return this !== event.target; }) // 전체선택 체크박스 제외
      .property("checked", checked);

    // 선택된 장르 다시 가져와서 update 호출
    const selectedRole = roleSelect.node().value;
    const selectedGenres = getSelectedGenres();
    update(selectedRole, selectedGenres);
  });

  const color = d3.scaleOrdinal()
  .domain(genres)
  .range(d3.schemePaired);

  genres.forEach(g => {
    const label = genreCheckboxContainer.append("label")
      .style("margin-right", "10px")
      .style("display", "inline-flex")
      .style("align-items", "center");

    label.append("input")
      .attr("type", "checkbox")
      .attr("value", g)
      .property("checked", true);

    // 색상 사각형 추가
    label.append("span")
      .style("width", "12px")
      .style("height", "12px")
      .style("background-color", color(g))
      .style("display", "inline-block")
      .style("margin", "0 4px")
      .style("border", "1px solid #333");

    label.append("span").text(g);
  });

  function getSelectedGenres() {
    return Array.from(document.querySelectorAll("#barGenreCheckboxes input:checked"))
                .map(input => input.value);
  }

  const svg = d3.select("#barChart"),
        width = +svg.attr("width"),
        height = +svg.attr("height"),
        margin = {top: 20, right: 20, bottom: 70, left: 50},
        chartWidth = width - margin.left - margin.right,
        chartHeight = height - margin.top - margin.bottom;

  let g = svg.select("g");
  if (g.empty()) {
    g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  }

  const x = d3.scaleBand()
    .range([0, chartWidth])
    .padding(0.1);

  const y = d3.scaleLinear()
    .range([chartHeight, 0]);

  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "1px solid #999")
    .style("padding", "4px 8px")
    .style("font-size", "12px")
    .style("pointer-events", "none");

  const xAxisGroup = g.append("g")
    .attr("transform", `translate(0,${chartHeight})`);

  const yAxisGroup = g.append("g");

  function update(selectedRole, selectedGenres) {
    if (selectedGenres.length === 0) {
      const movieDiv = d3.select("#genreMovie");
      movieDiv.html("");
      movieDiv.append("p")
        .html(`No movies in selected category`);

      x.domain(allCategories);
      y.domain([0, 1]);

      xAxisGroup.transition().duration(500).call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

      yAxisGroup.transition().duration(500).call(d3.axisLeft(y));

      g.selectAll("g.layer").remove();

      drawDivergingBarChart([], selectedRole);

      return;
    }

    const filtered = rawData.filter(d => {
        const roleMatch = selectedRole === "all" || d.role === selectedRole;
        const genreMatch = selectedGenres.length === 0 || selectedGenres.includes(d.genre);
        return roleMatch && genreMatch;
    });

    const movieTitles = Array.from(new Set(
          filtered.map(d => d.movie_name).filter(Boolean)  // movie 필드 존재 시
        ));
    
        const movieDiv = d3.select("#genreMovie");
        movieDiv.html("");  // 기존 내용 초기화
    
        if (filtered.length === 0) {
          movieDiv.append("p")
            .html(`No movies in selected category`);
          return;
        }
        else {
          movieDiv.append("p")
            .html(`Found <span style="color: red; font-weight:bold;">${movieTitles.length}</span> movies in the selected genre(s)`)
            .style("font-size", "16px")
          
          movieDiv.append("p")
          .html(`Click movie name to see characters`)
          .style("font-size", "16px")
          .style("color", "gray")
          .style("font-style", "italic")
          .style("margin-bottom", "10px");
    
          const movieData = d3.group(filtered, d => d.movie_name); // 영화별 캐릭터 그룹핑
    
          const ul = movieDiv.append("ul")
            .style("list-style", "none")
            .style("padding-left", "0");
          
          ul.selectAll("li")
            .data(movieTitles)
            .enter()
            .append("li")
            .style("cursor", "pointer")
            .each(function(movie) {
              const li = d3.select(this);

              const toggleIcon = li.append("span")
                .text("▶ ")
                .style("margin-right", "4px");

              li.append("span").text("🎬 " + movie);

              const infoBox = li.append("ul")
                .style("display", "none")
                .style("margin-top", "5px")
                .style("list-style", "none")
                .style("padding-left", "15px");

              const movieRating = movieData.get(movie)[0]?.rating;
              infoBox.append("li").html(`<strong>rating :</strong> ${movieRating} / 10`);

              const characters = movieData.get(movie)
                .filter(d => d.name && d.role)
                .map(d => ({ name: d.name, role: d.role }));

              characters.forEach(char => {
                const emoji = char.role === 'protagonist' ? '😊' :
                              char.role === 'antagonist' ? '😡' : '';
                infoBox.append("li").text(`${emoji} ${char.name} (${char.role})`);
              });

              li.on("click", function () {
                const currentDisplay = infoBox.style("display");
                const isHidden = currentDisplay === "none";
                infoBox.style("display", isHidden ? "block" : "none");
                toggleIcon.text(isHidden ? "▼ " : "▶ ");
              });
            });
        }

    const counts = {};
    allCategories.forEach(cat => {
        counts[cat] = {};
        selectedGenres.forEach(g => {
        counts[cat][g] = 0;
        });
    });

    filtered.forEach(d => {
        const cat = d.value_list[0];
        const g = d.genre;
        if (counts[cat] && counts[cat][g] !== undefined) {
        counts[cat][g]++;
        }
    });

    const stackedData = allCategories.map(cat => {
        const obj = { category: cat };
        selectedGenres.forEach(g => {
        obj[g] = counts[cat][g];
        });
        return obj;
    });

    const stackGen = d3.stack()
        .keys(selectedGenres);

    const series = stackGen(stackedData);

    x.domain(allCategories);
    const maxY = d3.max(stackedData, d => {
        let sum = 0;
        selectedGenres.forEach(g => sum += d[g]);
        return sum;
    });
    y.domain([0, maxY > 0 ? maxY : 1]).nice();

    xAxisGroup.transition().duration(500).call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    yAxisGroup.transition().duration(500).call(d3.axisLeft(y));

    const groups = g.selectAll("g.layer")
        .data(series, d => d.key);

    groups.exit().remove();

    const groupsEnter = groups.enter().append("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key));

    const groupsMerge = groupsEnter.merge(groups);

    const rects = groupsMerge.selectAll("rect")
        .data(d => d, d => d.data.category);

    rects.exit()
        .transition()
        .duration(300)
        .attr("y", y(0))
        .attr("height", 0)
        .remove();

    const rectsEnter = rects.enter()
        .append("rect")
        .attr("x", d => x(d.data.category))
        .attr("width", x.bandwidth())
        .attr("y", y(0))
        .attr("height", 0)
        .on("mouseover", (event, d) => {
        tooltip.transition()
            .duration(200)
            .style("opacity", 1);
        const genre = d3.select(event.currentTarget.parentNode).datum().key;
        tooltip.html(`<strong>${d.data.category}</strong><br/>Genre: ${genre}<br/>Count: ${d[1] - d[0]}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
        tooltip.transition()
            .duration(200)
            .style("opacity", 0);
        });

    rectsEnter.merge(rects)
        .transition()
        .duration(500)
        .attr("x", d => x(d.data.category))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]));

    drawDivergingBarChart(selectedGenres, selectedRole)
    }

  update("all", genres);

  roleSelect.on("change", () => {
    update(roleSelect.node().value, getSelectedGenres());
  });

  genreCheckboxContainer.selectAll("input[type=checkbox]")
    .filter(function() { return this.id !== "selectAllGenres"; })
    .on("change", () => {
      const total = genreCheckboxContainer.selectAll("input[type=checkbox]").size() - 1; // 전체선택 제외
      const checkedCount = genreCheckboxContainer.selectAll("input[type=checkbox]:checked").size() - 1;

      // 전체가 체크되었으면 전체선택도 체크, 아니면 해제
      d3.select("#selectAllGenres").property("checked", total === checkedCount);

      // 업데이트 호출
      const selectedRole = roleSelect.node().value;
      const selectedGenres = getSelectedGenres();
      update(selectedRole, selectedGenres);
    });


}

drawBarChart("https://raw.githubusercontent.com/kimcorn02/InfoVis2025/refs/heads/main/data.csv");