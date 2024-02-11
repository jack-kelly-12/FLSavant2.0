var MIN_FRAMING_RUNS = -15.0;
var MAX_FRAMING_RUNS = 15.0;

function getCatcherSummary() {
    return new Promise((resolve, reject) => {
        var selectedCatcher = $("#catcher").val();
        console.log(selectedCatcher);
        $.ajax({
            type: "POST",
            url: "/catch_summary",
            data: {
                "Catcher": selectedCatcher,
            },
            success: function (response) {
                $("#summaryContainer").html(response.summary);
                $("#catcherName").text(selectedCatcher);
                $("#catcherTeam").text(response.team);
                resolve();
            },
            error: function (error) {
                console.error("Error fetching catcher summary:", error);
                reject("Error fetching catcher summary");
            }
        });
    });
}

function updateCatcherChart() {
    $('#frameChart').empty();
    return new Promise((resolve, reject) => {
        var selectedCatcher = $("#catcher").val();
        console.log(selectedCatcher);
        $.ajax({
            type: "POST",
            url: "/catcher_data",
            data: {
                "Catcher": selectedCatcher,
            },
            success: function (response) {
                createCatcherChart(response.data);
                resolve();
            },
            error: function (error) {
                console.error("Error fetching catcher chart data:", error);
                reject("Error fetching catcher chart data");
            }
        });
    });
}

function createCatcherChart(data) {
    const canvasWidth = 500;
    const canvasHeight = 500;

    const strikeZoneWidth = 90;
    const strikeZoneHeight = 300;

    const svg = d3.create('svg')
        .attr('width', canvasWidth)
        .attr('height', canvasHeight);

    const verticalOffset = (canvasHeight - strikeZoneHeight) / 5;

    const zoneGroup = svg.append('g')
        .attr('transform', `translate(${(canvasWidth - strikeZoneWidth) / 2}, ${verticalOffset})`);

    const strikeZone = {
        'x': [-1, 1, 1, -1, -1],
        'y': [1.5, 1.5, 3.5, 3.5, 1.5]
    }

    const xScale = d3.scaleLinear()
        .domain([-1, .1])
        .range([0, strikeZoneWidth]);

    const yScale = d3.scaleLinear()
        .domain([1.5, 3.5])
        .range([strikeZoneHeight, 0]);

    const lineGenerator = d3.line()
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]));

    const pathData = lineGenerator(d3.zip(strikeZone.x, strikeZone.y));

    zoneGroup.append('path')
        .attr('d', pathData)
        .attr('fill', 'white')
        .attr('stroke', 'black');

    const colorScalePitch = d3.scaleOrdinal()
        .domain(['StrikeCalled', 'BallCalled'])
        .range(['red', 'blue']);

    zoneGroup.selectAll('circle')
        .data(data)
        .enter().append('circle')
        .attr('cx', d => xScale(d.PlateLocSide))
        .attr('cy', d => yScale(d.PlateLocHeight))
        .attr('r', 5)
        .attr('fill', d => colorScalePitch(d.PitchCall))
        .attr('opacity', .9);

    zoneGroup.append('svg:image')
        .attr('x', -30)
        .attr('y', 330)
        .attr('width', 225)
        .attr('height', 80)
        .attr('opacity', 1)
        .attr('preserveAspectRatio', 'none')
        .attr('xlink:href', 'https://st4.depositphotos.com/34668188/41728/v/450/depositphotos_417286480-stock-illustration-home-plate-icon-with-baseball.jpg');

    d3.select('#frameChart').node().append(svg.node());
}



function updateCatcherContent() {
    showLoadingScreen();

    Promise.all([
            getCatcherSummary(),
            updateCatcherChart(),
        ])
        .then(() => {
            hideLoadingScreen();
        })
        .catch(error => {
            console.error('Error updating catcher content:', error);
            hideLoadingScreen();
        });
}



function updateCatcherLeaderboard(data) {
    console.log(data);
    $('#framingBody').empty();
    data.forEach(function (row) {
        var framingRuns = row['Framing Runs'];
        var color = getColorForFramingRuns(framingRuns);
        var newRow = `<tr>
                        <td>${row.Catcher}</td>
                        <td>${row.Pitches}</td>
                        <td style="background-color: ${color}; color: white;">${framingRuns.toFixed(2)}</td>
                        <td>${row['Strike%'].toFixed(1)}</td>
                     </tr>`;
        $('#framingBody').append(newRow);
    });
}

function getColorForFramingRuns(value) {
    var normalizedValue = (value - MIN_FRAMING_RUNS) / (MAX_FRAMING_RUNS - MIN_FRAMING_RUNS);

    var r = Math.round(255 * normalizedValue);
    var b = Math.round(255 * (1 - normalizedValue));

    return `rgb(${r}, 0, ${b})`;
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
    updateCatcherContent();
    $.ajax({
        type: "POST",
        url: "/catcher_leaderboard",

        success: function (response) {
            updateCatcherLeaderboard(response.leaderboard);
        },
        error: function (error) {
            console.error("Error fetching catcher leaders:", error);
            reject("Error fetching catcher leaders");
        }
    });
    $("#catcher").change(function () {
        updateCatcherContent();
    });
    $('.select2').select2({
        width: '80%'
    });
});