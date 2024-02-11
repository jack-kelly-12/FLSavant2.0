const pitchColors = {
    'Curveball': 'dodgerblue',
    'Sinker': 'orange',
    'Slider': 'mediumseagreen',
    'Changeup': 'violet',
    'Fastball': 'tomato',
    'Cutter': 'slateblue',
    'Splitter': 'blue',
    'None': 'gray',
    'Other': 'purple',
    'Knuckleball': 'brown',
    'Breaking': 'green'

};


function updateHittingTable(data) {
    $('#hitStatsBody').empty();

    var projectedData = data.filter(row => row.Year === "Projected");
    var nonProjectedData = data.filter(row => row.Year !== "Projected");

    nonProjectedData.sort((a, b) => b.Year - a.Year);

    projectedData.forEach(function (row) {
        var boldedRow = `<tr style="font-weight: bold;"><td>${row.Year}</td><td>${row.BA.toFixed(3)}</td><td>${row.HR}</td><td>${row.SB}</td><td>${row.WAR.toFixed(1)}</td></tr>`;
        $('#hitStatsBody').append(boldedRow);
    });

    nonProjectedData.forEach(function (row) {
        var newRow = `<tr><td>${row.Year}</td><td>${row.BA.toFixed(3)}</td><td>${row.HR}</td><td>${row.SB}</td><td>${row.WAR.toFixed(1)}</td></tr>`;
        $('#hitStatsBody').append(newRow);
    });
}

function createVeloTable(data) {
    $('#veloBody').empty();

    data.forEach(function (row) {
        for (const key in row) {
            if (row.hasOwnProperty(key) && isNaN(row[key]) && key !== 'pitch_group') {
                row[key] = "-";
            }
        }

        var color = pitchColors[row.pitch_group];
        var newRow = `<tr><td><span class="${row.pitch_group}" style="color: ${color};">${row.pitch_group}</span></td><td>${row['0-33%']}</td><td>${row['33-66%']}</td><td>${row['66-100%']}</td></tr>`;
        $('#veloBody').append(newRow);
    });
}


function getHitterSummary() {
    return new Promise((resolve, reject) => {
        var selectedHitter = $("#hitter").val();
        console.log(selectedHitter);

        $.ajax({
            type: "POST",
            url: "/hit_summary",
            data: {
                "Hitter": selectedHitter,
            },
            success: function (response) {
                createHitterBattedBall(response.batted_ball);
                $("#hitSummaryContainer").html(response.summary);
                $("#hitterName").text(selectedHitter);
                $("#hitterTeam").text(response.teamAndHand);
                createVeloTable(response.data);
                resolve();
            },
            error: function (error) {
                console.error("Error fetching hitter summary:", error);
                reject("Error fetching hitter summary");
            }
        });
    });
}


function updateHittingStats() {
    var hitter = $('#hitter').val();
    $.ajax({
        type: 'POST',
        url: '/update_hitter_stats',
        data: {
            'Hitter': hitter
        },
        success: function (response) {
            if (response.success) {
                updateHittingTable(response.data);
            }
        }
    });
    return false;
}

function createHitterHeatmap(data) {
    const canvasWidth = 500;
    const canvasHeight = 500;

    const strikeZoneWidth = 175;
    const strikeZoneHeight = 300;

    const svg = d3.create('svg')
        .attr('width', canvasWidth)
        .attr('height', canvasHeight);

    const zoneGroup = svg.append('g')
        .attr('transform', `translate(${(canvasWidth - strikeZoneWidth) / 2}, ${(canvasHeight - strikeZoneHeight) / 2})`);

    const strikeZone = {
        'x': [-1, 1, 1, -1, -1],
        'y': [1.5, 1.5, 3.5, 3.5, 1.5]
    };

    const xScale = d3.scaleLinear()
        .domain([-1, 1])
        .range([0, strikeZoneWidth]);

    const yScale = d3.scaleLinear()
        .domain([1.5, 3.5])
        .range([strikeZoneHeight, 0]);

    const hexbin = d3.hexbin()
        .x(d => xScale(d.PlateLocSide))
        .y(d => yScale(d.PlateLocHeight))
        .extent([
            [0, 0],
            [strikeZoneWidth, strikeZoneHeight]
        ])
        .radius(40);

    const hexagonData = hexbin(data);

    const RdBu_r = t => d3.interpolateRdBu(1 - t);

    const colorScale = d3.scaleSequential(RdBu_r)
        .domain([0.1, 0.5]);

    const tooltip = d3.select("#hitChart")
        .append("div")
        .style("opacity", 0)
        .style("position", "absolute")
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")

    zoneGroup.selectAll('.hexagon')
        .data(hexagonData)
        .enter().append('path')
        .attr('class', 'hexagon')
        .attr('d', d => hexbin.hexagon())
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .attr('fill', d => colorScale(d3.mean(d, e => e ? e.xwOBAcon_gb : 0)))
        .on("mouseover", function (event, d) {
            tooltip.text("xwOBAcon: " + (d.length > 0 ? d3.mean(d, e => e.xwOBAcon_gb).toFixed(3) : "N/A"))
                .style("opacity", 1);
            d3.select(this).attr("opacity", 0.5);
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.x / 2) + "px")
                .style("top", (event.y) / 2 + "px")
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
            d3.select(this).attr("opacity", 1);
        });


    zoneGroup.append('path')
        .attr('d', d3.line()(d3.zip(strikeZone.x.map(x => xScale(x)), strikeZone.y.map(y => yScale(y)))))
        .attr('fill', 'none')
        .attr('stroke', 'black');

    zoneGroup.append('svg:image')
        .attr('x', -22)
        .attr('y', 330)
        .attr('width', 220)
        .attr('height', 80)
        .attr('opacity', 1)
        .attr('preserveAspectRatio', 'none')
        .attr('xlink:href', 'https://st4.depositphotos.com/34668188/41728/v/450/depositphotos_417286480-stock-illustration-home-plate-icon-with-baseball.jpg');

    d3.select('#hitChart').node().append(svg.node());
}


function updateHitterSZ() {
    return new Promise((resolve, reject) => {
        $('#hitChart').empty();
        var hitter = $('#hitter').val();

        $.ajax({
            type: 'POST',
            url: '/update_hitter_sz',
            data: {
                'Hitter': hitter
            },
            success: function (response) {
                if (response.success) {
                    createHitterHeatmap(response.data);
                    resolve();
                } else {
                    reject('Error updating percentiles');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function createHitterBattedBall(data) {
    $('#battedBallTableBody').empty();

    data.forEach(function (row) {
        var newRow = `<tr>
            <td>${(row['Pull%'] * 100).toFixed(1)}%</td>
            <td>${(row['Oppo%'] * 100).toFixed(1)}%</td>
            <td>${(row['Straight%'] * 100).toFixed(1)}%</td>
            <td>${(row['GroundBall%'] * 100).toFixed(1)}%</td>
            <td>${(row['LineDrive%'] * 100).toFixed(1)}%</td>
            <td>${(row['PopUp%'] * 100).toFixed(1)}%</td>
            <td>${(row['FlyBall%'] * 100).toFixed(1)}%</td>
            <td>${(row['Solid%'] * 100).toFixed(1)}%</td>
            <td>${(row['Weak%'] * 100).toFixed(1)}%</td>
        </tr>`;

        $('#battedBallTableBody').append(newRow);
    });
}

function updateYakkerHTML(data) {
    $('#yakkerTableBody').empty();

    data.forEach(function (row) {
        var newRow = `<tr><td>${row.Pitches}</td><td>${row['BBE']}</td><td>${(row['Barrels']).toFixed(0)}</td><td>${(row['Barrel%']).toFixed(1)}</td><td>${(row['AvgEV']).toFixed(1)}</td><td>${(row['Max EV']).toFixed(1)}</td><td>${(row['LA']).toFixed(1)}</td><td>${(row['SweetSpot%']).toFixed(1)}</td><td>${(row['xBA']).toFixed(3)}</td><td>${(row['xSLG']).toFixed(3)}</td><td>${(row['xwOBA']).toFixed(3)}</td><td>${(row['HardHit%']).toFixed(1)}</td><td>${(row['K%']).toFixed(1)}</td><td>${(row['BB%']).toFixed(1)}</td>t</tr>`;

        $('#yakkerTableBody').append(newRow);
    });
}

function updateRunValueTable(data) {
    return new Promise((resolve, reject) => {
        try {
            $('#rvTableBody').empty();

            data.forEach(function (row) {
                var pitchName = row.AutoPitchType;
                var color = pitchColors[pitchName];
                var newRow = `<tr><td><span class="${pitchName}" style="color: ${color};">${pitchName}</span></td><td>${row.Pitches}</td><td>${(row['HardHit%']).toFixed(1)}%</td><td>${(row['Whiff%']).toFixed(1)}%</td><td>${row.xwOBAcon.toFixed(3)}</td><td>${row['RV/100'].toFixed(1)}</td><td>${row.RV.toFixed(1)}</td></tr>`;

                $('#rvTableBody').append(newRow);
            });

            resolve("Table updated successfully");
        } catch (error) {
            reject(error);
        }
    });
}

function updateDiscipline() {
    return new Promise((resolve, reject) => {
        var hitter = $('#hitter').val();

        $.ajax({
            type: 'POST',
            url: '/update_discipline',
            data: {
                'Hitter': hitter
            },
            success: function (response) {
                if (response.success) {
                    updateDisciplineTable(response.data);
                    resolve();
                } else {
                    reject('Error updating discipline');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function updateDisciplineTable(data) {
    return new Promise((resolve, reject) => {
        try {
            $('#discTableBody').empty();

            data.forEach(function (row) {
                var newRow = `<tr>
                <td>${row.Pitches}</td>
                <td>${row['Zone%'].toFixed(1)}%</td>
                <td>${row['Z-Swing%'].toFixed(1)}%</td>
                <td>${row['Z-Contact%'].toFixed(1)}%</td>
                <td>${row['Chase%'].toFixed(1)}%</td>
                <td>${row['O-Swing%'].toFixed(1)}%</td>
                <td>${row['O-Contact%'].toFixed(1)}%</td>
                <td>${row['Edge%'].toFixed(1)}%</td>
                <td>${row['1st Pitch Swing%'].toFixed(1)}%</td>
                <td>${row['Swing%'].toFixed(1)}%</td>
                <td>${row['Whiff%'].toFixed(1)}%</td>
                <td>${row['Heart%'].toFixed(1)}%</td>
                <td>${row['Heart Swing%'].toFixed(1)}%</td>
            </tr>`;
                $('#discTableBody').append(newRow);
            });

            resolve("Table updated successfully");
        } catch (error) {
            reject(error);
        }
    });
}


function updateRV() {
    return new Promise((resolve, reject) => {
        var hitter = $('#hitter').val();

        $.ajax({
            type: 'POST',
            url: '/update_rv_hitter',
            data: {
                'Hitter': hitter
            },
            success: function (response) {
                if (response.success) {
                    updateRunValueTable(response.data);
                    resolve();
                } else {
                    reject('Error updating RV');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function updateHitPercentiles() {
    return new Promise((resolve, reject) => {
        $('#percentileHitChart').empty();
        var hitter = $('#hitter').val();

        $.ajax({
            type: 'POST',
            url: '/update_hitter_percentiles',
            data: {
                'Hitter': hitter
            },
            success: function (response) {
                if (response.success) {
                    createHitPercentiles(response.data);
                    updateYakkerHTML(response.data);
                    resolve();
                } else {
                    reject('Error updating percentiles');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function createHitPercentiles(data) {
    var margin = {
            top: 30,
            right: 30,
            bottom: 60,
            left: 60
        },
        width = 500 - margin.left - margin.right,
        height = 600 - margin.top - margin.bottom;

    getX = (percentile) => ((width * percentile) / 100);

    percentileData = [{
            label: 'xwOBAcon',
            cx: getX(data[0]['xwOBA_percentile']),
            cy: (width / 10) * 1
        },
        {
            label: 'xBA',
            cx: getX(data[0]['xBA_percentile']),
            cy: (width / 10) * 2
        },
        {
            label: 'xSLG',
            cx: getX(data[0]['xSLG_percentile']),
            cy: (width / 10) * 3
        },
        {
            label: 'Avg Exit Velocity',
            cx: getX(data[0]['AvgEV_percentile']),
            cy: (width / 10) * 4
        },
        {
            label: 'Barrel%',
            cx: getX(data[0]['Barrel%_percentile']),
            cy: (width / 10) * 5
        },
        {
            label: 'Hard Hit%',
            cx: getX(data[0]['HardHit%_percentile']),
            cy: (width / 10) * 6
        },
        {
            label: 'SweetSpot%',
            cx: getX(data[0]['SweetSpot%_percentile']),
            cy: (width / 10) * 7
        },
        {
            label: 'Chase%',
            cx: getX(data[0]['Chase%_percentile']),
            cy: (width / 10) * 8
        },
        {
            label: 'Whiff%',
            cx: getX(data[0]['Whiff%_percentile']),
            cy: (width / 10) * 9
        },
        {
            label: 'K%',
            cx: getX(data[0]['K%_percentile']),
            cy: (width / 10) * 10
        },
        {
            label: 'BB%',
            cx: getX(data[0]['BB%_percentile']),
            cy: (width / 10) * 11
        },
    ];

    svg = d3.create('svg')
        .attr('width', width + 20)
        .attr('height', height + 20);

    lines = svg.selectAll('line')
        .data(percentileData)
        .enter()
        .append('line')
        .style('stroke', 'rgb(155, 155, 155)')
        .style('stroke-width', 2)
        .attr('x1', 10)
        .attr('x2', width + 10)
        .attr('y1', d => d.cy)
        .attr('y2', d => d.cy);

    lineDecorators = [{
            cx: getX(0),
            cy: (width / 10)
        }, {
            cx: getX(50),
            cy: (width / 10)
        }, {
            cx: getX(100),
            cy: (width / 10)
        },
        {
            cx: getX(0),
            cy: (width / 10) * 2
        }, {
            cx: getX(50),
            cy: (width / 10) * 2
        }, {
            cx: getX(100),
            cy: (width / 10) * 2
        },
        {
            cx: getX(0),
            cy: (width / 10) * 3
        }, {
            cx: getX(50),
            cy: (width / 10) * 3
        }, {
            cx: getX(100),
            cy: (width / 10) * 3
        },
        {
            cx: getX(0),
            cy: (width / 10) * 4
        }, {
            cx: getX(50),
            cy: (width / 10) * 4
        }, {
            cx: getX(100),
            cy: (width / 10) * 4
        },
        {
            cx: getX(0),
            cy: (width / 10) * 5
        }, {
            cx: getX(50),
            cy: (width / 10) * 5
        }, {
            cx: getX(100),
            cy: (width / 10) * 5
        },
        {
            cx: getX(0),
            cy: (width / 10) * 6
        }, {
            cx: getX(50),
            cy: (width / 10) * 6
        }, {
            cx: getX(100),
            cy: (width / 10) * 6
        },
        {
            cx: getX(0),
            cy: (width / 10) * 7
        }, {
            cx: getX(50),
            cy: (width / 10) * 7
        }, {
            cx: getX(100),
            cy: (width / 10) * 7
        },
        {
            cx: getX(0),
            cy: (width / 10) * 8
        }, {
            cx: getX(50),
            cy: (width / 10) * 8
        }, {
            cx: getX(100),
            cy: (width / 10) * 8
        },
        {
            cx: getX(0),
            cy: (width / 10) * 9
        }, {
            cx: getX(50),
            cy: (width / 10) * 9
        }, {
            cx: getX(100),
            cy: (width / 10) * 9
        },
        {
            cx: getX(0),
            cy: (width / 10) * 10
        }, {
            cx: getX(50),
            cy: (width / 10) * 10
        }, {
            cx: getX(100),
            cy: (width / 10) * 10
        },
        {
            cx: getX(0),
            cy: (width / 10) * 11
        }, {
            cx: getX(50),
            cy: (width / 10) * 11
        }, {
            cx: getX(100),
            cy: (width / 10) * 11
        },
    ];

    decorators = svg.selectAll('#decor')
        .data(lineDecorators)
        .enter()
        .append('circle')
        .attr('id', 'decor')
        .attr('cx', d => d.cx + 10)
        .attr('cy', d => d.cy)
        .attr('r', 3)
        .attr('fill', 'rgb(155, 155, 155)');

    svg.selectAll('line')
        .data([...percentileData, ...lineDecorators])
        .enter()
        .append('line')
        .style('stroke', 'rgb(155, 155, 155)')
        .style('stroke-width', d => d.strokeWidth)
        .attr('x1', 10)
        .attr('x2', width + 10)
        .attr('y1', d => d.cy)
        .attr('y2', d => d.cy);

    decorators = svg.selectAll('#decor')
        .data(lineDecorators)
        .enter()
        .append('circle')
        .attr('id', 'decor')
        .attr('cx', d => d.cx + 10)
        .attr('cy', d => d.cy)
        .attr('r', 3)
        .attr('fill', 'rgb(155, 155, 155)');

    circles = svg.selectAll('.ranks')
        .data(percentileData)
        .enter()
        .append('circle')
        .attr('class', 'ranks')
        .attr('cx', d => d.cx + 10)
        .attr('cy', d => d.cy)
        .attr('r', d => d.hasOwnProperty('label') ? 11 : 0)
        .attr('fill', d => d3.interpolateRdBu(1 - (Math.floor((d.cx / width) * 100) / 100)))
        .attr('stroke', 'black');

    statLabels = svg.selectAll('.labels')
        .data(percentileData)
        .enter()
        .append('text')
        .attr('class', 'labels')
        .attr('x', 5)
        .attr('y', d => d.cy - 15)
        .text(d => d.label)
        .attr("font-size", ".8rem")
        .attr("font-family", "DejaVu Sans Mono")
        .attr("fill", 'black');

    getTextXValue = (x) => {
        const stringLength = Math.floor((x / width) * 100).toString().length;
        switch (stringLength) {
            case 1:
                return x + 7;
            case 2:
                return x + 4;
            default:
                return x;
        }
    };

    text = svg.selectAll('.percentRank')
        .data(percentileData)
        .enter()
        .append('text')
        .attr('class', 'percentRank')
        .attr('x', d => getTextXValue(d.cx))
        .attr('y', d => d.cy + 3)
        .text(d => d.hasOwnProperty('label') ? Math.floor((d.cx / width) * 100) : '')
        .attr('font-weight', 'bolder')
        .attr('font-size', '.7rem')
        .attr('fill', d => (Math.floor((d.cx / width) * 100) >= 70 ||
                Math.floor((d.cx / width) * 100) <= 30) ?
            'white' : 'black');

    percentileLines = svg.selectAll('.percentileLine')
        .data(percentileData)
        .enter()
        .append('line')
        .attr('class', 'percentileLine')
        .style('stroke', d => d3.interpolateRdBu(1 - (Math.floor((d.cx / width) * 100) / 100)))
        .style('stroke-width', 3)
        .attr('x1', 0)
        .attr('x2', d => d.cx - 1.5)
        .attr('y1', d => d.cy)
        .attr('y2', d => d.cy);

    d3.select('#percentileHitChart').node().append(svg.node());
}

function updateHitterContent() {
    showLoadingScreen();

    Promise.all([
            getHitterSummary(),
            updateHittingStats(),
            updateHitPercentiles(),
            updateHitterSZ(),
            updateRV(),
            updateDiscipline()
        ])
        .then(() => {
            hideLoadingScreen();
        })
        .catch(error => {
            console.error('Error updating hitter content:', error);
            hideLoadingScreen();
        });
}

function showLoadingScreen() {
    var loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.style.display = 'flex';
    document.getElementById('contentContainer').style.display = 'none';
    document.body.style.overflow = 'hidden';
}

function hideLoadingScreen() {
    var loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.style.display = 'none';
    document.getElementById('contentContainer').style.display = 'block';
    document.body.style.overflow = 'visible';
}

$(document).ready(function () {
    updateHitterContent();
    $("#hitter").change(function () {
        updateHitterContent();
    });
    $('.select2').select2({
        width: '80%'
    });
});