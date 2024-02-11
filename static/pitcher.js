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
    'Fastballs': 'red',
    'Breaking': 'blue',
    'Offspeed': 'darkorange'
};

function getPitcherSummary() {
    return new Promise((resolve, reject) => {
        var selectedPitcher = $("#pitcher").val();

        $.ajax({
            type: "POST",
            url: "/pitch_summary",
            data: {
                "Pitcher": selectedPitcher,
            },
            success: function (response) {
                $("#pitchNamesContainer").html(response.summary);
                $("#pitcherName").text(selectedPitcher);
                $("#pitcherTeamHand").text(response.teamAndHand);

                resolve();
            },
            error: function (error) {
                console.error("Error fetching unique pitch names:", error);
                reject("Error fetching unique pitch names");
            }
        });
    });
}

function updateTable() {
    return new Promise((resolve, reject) => {
        var pitcher = $('#pitcher').val();

        $.ajax({
            type: 'POST',
            url: '/update_pitcher_table',
            data: {
                'Pitcher': pitcher
            },
            success: function (response) {
                if (response.success) {
                    updateHTMLTable(response.data);
                    resolve();
                } else {
                    reject('Error updating table');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function updatePitchingTable(data) {
    return new Promise((resolve, reject) => {
        try {
            $('#pitchStatsBody').empty();

            var projectedData = data.filter(row => row.Year === "Projected");
            var nonProjectedData = data.filter(row => row.Year !== "Projected");

            nonProjectedData.sort((a, b) => b.Year - a.Year);

            projectedData.forEach(function (row) {
                var boldedRow = `<tr style="font-weight: bold;"><td>${row.Year}</td><td>${row.G}</td><td>${row['W-L']}</td><td>${row.FIP.toFixed(2)}</td><td>${row.IP.toFixed(1)}</td><td>${row.SO}</td><td>${row.WAR.toFixed(1)}</td></tr>`;
                $('#pitchStatsBody').append(boldedRow);
            });

            nonProjectedData.forEach(function (row) {
                var newRow = `<tr><td>${row.Year}</td><td>${row.G}</td><td>${row['W-L']}</td><td>${row.FIP.toFixed(2)}</td><td>${row.IP.toFixed(1)}</td><td>${row.SO}</td><td>${row.WAR.toFixed(1)}</td></tr>`;
                $('#pitchStatsBody').append(newRow);
            });

            resolve();
        } catch (error) {
            console.error('Error updating pitching table:', error);
            reject('Error updating pitching table');
        }
    });
}


function updatePitchingStats() {
    return new Promise((resolve, reject) => {
        var pitcher = $('#pitcher').val();

        $.ajax({
            type: 'POST',
            url: '/update_pitcher_stats',
            data: {
                'Pitcher': pitcher
            },
            success: function (response) {
                if (response.success) {
                    updatePitchingTable(response.data);
                    resolve();
                } else {
                    reject('Error updating table');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function updateYakkerHTML(data) {
    $('#yakkerTableBody').empty();

    data.forEach(function (row) {
        var newRow = `<tr><td>${row.Pitches}</td><td>${row['BBE']}</td><td>${(row['Barrels']).toFixed(0)}</td><td>${(row['Barrel%']).toFixed(1)}</td><td>${(row['AvgEV']).toFixed(1)}</td><td>${(row['Max EV']).toFixed(1)}</td><td>${(row['LA']).toFixed(1)}</td><td>${(row['SweetSpot%']).toFixed(1)}</td><td>${(row['xBA']).toFixed(3)}</td><td>${(row['xSLG']).toFixed(3)}</td><td>${((row['xERA']) / 10).toFixed(3)}</td><td>${(row['HardHit%']).toFixed(1)}</td><td>${(row['K%']).toFixed(1)}</td><td>${(row['BB%']).toFixed(1)}</td>t</tr>`;

        $('#yakkerTableBody').append(newRow);
    });
}


function updateHTMLTable(data) {
    $('#pitchTableBody').empty();

    data.forEach(function (row) {
        var pitchName = row.AutoPitchType;

        var color = pitchColors[pitchName];
        var newRow = `<tr><td><span class="${pitchName}" style="color: ${color};">${pitchName}</span></td><td>${row.RelSpeed.toFixed(1)} mph</td><td>${row.SpinRate.toFixed(0)} rpm</td><td>${row.HorzBreak.toFixed(1)} in.</td><td>${row.InducedVertBreak.toFixed(1)} in.</td><td>${row.ExitSpeed.toFixed(1)} mph</td><td>${row.Angle.toFixed(1)}°</td></tr>`;

        $('#pitchTableBody').append(newRow);
    });
}


function updatePitcherContent() {
    showLoadingScreen();

    Promise.all([
            getPitcherSummary(),
            updatePitchingStats(),
            updateTable(),
            updateRV(),
            updatePitchChart(),
            updatePercentiles()
        ])
        .then(() => {
            hideLoadingScreen();
        })
        .catch(error => {
            console.error('Error updating pitcher content:', error);
            hideLoadingScreen();
        });
}

function updatePitchChart() {
    return new Promise((resolve, reject) => {
        $('#pitchChart').empty();
        var pitcher = $('#pitcher').val();

        $.ajax({
            type: 'POST',
            url: '/update_pitch_chart',
            data: {
                'Pitcher': pitcher
            },
            success: function (response) {
                if (response.success) {
                    createPitchChart(response.data);
                    resolve();
                } else {
                    reject('Error updating charts');
                }
            },
            error: function (error) {
                reject('AJAX error');
            }
        });
    });
}

function createPitchChart(data) {
    var margin = {
            top: 30,
            right: 30,
            bottom: 60,
            left: 60
        },
        width = 460 - margin.left - margin.right,
        height = 460 - margin.top - margin.bottom;

    var svg = d3.select("#pitchChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleLinear()
        .domain([-30, 30])
        .range([0, width]);
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    svg.append("text")
        .attr("class", "x label")
        .attr("text-anchor", "end")
        .attr("x", width + 10)
        .attr("y", height + margin.top)
        .style("font-size", "10px")
        .text("Horizontal Break");

    svg.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("x", -margin.top + 30)
        .attr("y", -margin.left + 30)
        .style("font-size", "10px")
        .text("Induced Vertical Break");

    var y = d3.scaleLinear()
        .domain([-30, 30])
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left)
        .attr("x", -height / 2)
        .attr("dy", "0.71em")
        .style("text-anchor", "middle")
        .text("Induced Vertical Break");

    svg.append("line")
        .attr("x1", x(0))
        .attr("y1", 0)
        .attr("x2", x(0))
        .attr("y2", height)
        .style("stroke", "grey")
        .style("stroke-width", 2);

    svg.append("line")
        .attr("x1", 0)
        .attr("y1", y(0))
        .attr("x2", width)
        .attr("y2", y(0))
        .style("stroke", "grey")
        .style("stroke-width", 2);

    var circles = svg.selectAll("dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", function (d) {
            return x(d.HorzBreak);
        })
        .attr("cy", function (d) {
            return y(d.InducedVertBreak);
        })
        .attr("r", 5)
        .style("fill", function (d) {
            return getColorForPitch(d.AutoPitchType);
        }).attr("title", function (d) {
            return d.AutoPitchType;
        });

    circles.on("mouseover", function (d) {
            var currentPitchType = d.AutoPitchType;
            svg.selectAll("circle")
                .style("opacity", function (d) {
                    return d.AutoPitchType === currentPitchType ? 1 : 0.2;
                });

            displayHighlightedPitchType(currentPitchType);
        })
        .on("mouseout", function () {
            svg.selectAll("circle")
                .style("opacity", 1);

            displayHighlightedPitchType(null);
        });

    function getColorForPitch(pitchType) {
        return pitchColors[pitchType] || 'black';
    }

    function displayHighlightedPitchType(pitchType) {
        var highlightedPitchTypeElement = document.getElementById("highlightedPitchType");
        if (highlightedPitchTypeElement) {
            highlightedPitchTypeElement.textContent = pitchType ? `Highlighted Pitch: ${pitchType}` : '';
        }
    }
}

function updatePercentiles() {
    return new Promise((resolve, reject) => {
        $('#percentileChart').empty();
        var pitcher = $('#pitcher').val();

        $.ajax({
            type: 'POST',
            url: '/update_pitcher_percentiles',
            data: {
                'Pitcher': pitcher
            },
            success: function (response) {
                if (response.success) {
                    createPercentiles(response.data);
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

function updateRV() {
    return new Promise((resolve, reject) => {
        var pitcher = $('#pitcher').val();

        $.ajax({
            type: 'POST',
            url: '/update_rv_pitcher',
            data: {
                'Pitcher': pitcher
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


function createPercentiles(data) {
    var margin = {
            top: 30,
            right: 30,
            bottom: 60,
            left: 60
        },
        width = 500 - margin.left - margin.right,
        height = 625 - margin.top - margin.bottom;

    getX = (percentile) => (width * percentile) / 100;

    percentileData = [{
            label: 'xERA',
            cx: getX(data[0]['xERA_percentile']),
            cy: (width / 10)
        },
        {
            label: 'xBA',
            cx: getX(data[0]['xBA_percentile']),
            cy: (width / 10) * 2
        },
        {
            label: 'Fastball Speed',
            cx: getX(data[0]['FastballVelo_percentile']),
            cy: (width / 10) * 3
        },
        {
            label: 'Avg Exit Velocity',
            cx: getX(data[0]['AvgEV_percentile']),
            cy: (width / 10) * 4
        },
        {
            label: 'Chase%',
            cx: getX(data[0]['Chase%_percentile']),
            cy: (width / 10) * 5
        },
        {
            label: 'Whiff%',
            cx: getX(data[0]['Whiff%_percentile']),
            cy: (width / 10) * 6
        },
        {
            label: 'K%',
            cx: getX(data[0]['K%_percentile']),
            cy: (width / 10) * 7
        },
        {
            label: 'BB%',
            cx: getX(data[0]['BB%_percentile']),
            cy: (width / 10) * 8
        },
        {
            label: 'Barrel%',
            cx: getX(data[0]['Barrel%_percentile']),
            cy: (width / 10) * 9
        },
        {
            label: 'Hard Hit%',
            cx: getX(data[0]['HardHit%_percentile']),
            cy: (width / 10) * 10
        },
        {
            label: 'GB%',
            cx: getX(data[0]['GB%_percentile']),
            cy: (width / 10) * 11
        },
        {
            label: 'Extension',
            cx: getX(data[0]['Extension_percentile']),
            cy: (width / 10) * 12
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
        {
            cx: getX(0),
            cy: (width / 10) * 12
        }, {
            cx: getX(50),
            cy: (width / 10) * 12
        }, {
            cx: getX(100),
            cy: (width / 10) * 12
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

    d3.select('#percentileChart').node().append(svg.node());
}

function updateRunValueTable(data) {
    $('#rvTableBody').empty();

    data.forEach(function (row) {
        var pitchName = row.AutoPitchType;
        var color = pitchColors[pitchName];
        var newRow = `<tr><td><span class="${pitchName}" style="color: ${color};">${pitchName}</span></td><td>${row.Pitches}</td><td>${(row['HardHit%']).toFixed(1)}</td><td>${(row['Strike%']).toFixed(1)}</td><td>${(row['Whiff%']).toFixed(1)}</td><td>${row.xwOBAcon.toFixed(3)}</td><td>${row['RV/100'].toFixed(1)}</td><td>${row.RV.toFixed(1)}</td></tr>`;

        $('#rvTableBody').append(newRow);
    });
}

function showLoadingScreen() {
    var loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.style.display = 'flex';
    document.getElementById('contentContainer').style.display = 'none';

    document.body.style.overflow = 'hidden';

    setTimeout(function () {
        loadingScreen.style.display = 'none';
        document.getElementById('contentContainer').style.display = 'block';
        document.body.style.overflow = 'auto';
    }, 1500);
}


function hideLoadingScreen() {
    var loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.style.display = 'none';
    document.getElementById('contentContainer').style.display = 'block';
    document.body.style.overflow = 'visible';
}

$(document).ready(function () {
    updatePitcherContent();
    $("#pitcher").change(function () {
        updatePitcherContent();
    });
    $('.select2').select2({
        width: '80%'
    });
});