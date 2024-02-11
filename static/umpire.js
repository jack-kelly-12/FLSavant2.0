function getUmpireSummary() {
    return new Promise((resolve, reject) => {
        var selectedUmpire = $("#umpire").val();
        console.log(selectedUmpire);
        $.ajax({
            type: "POST",
            url: "/ump_summary",
            data: {
                "Umpire": selectedUmpire,
            },
            success: function (response) {
                $("#summaryContainer").html(response.summary);
                $("#umpireName").text(selectedUmpire);
                resolve();
            },
            error: function (error) {
                console.error("Error fetching umpire summary:", error);
                reject("Error fetching umpire summary");
            }
        });
    });
}

function updateUmpChart() {
    $('#umpChart').empty();
    return new Promise((resolve, reject) => {
        var selectedUmp = $("#umpire").val();
        $.ajax({
            type: "POST",
            url: "/ump_data",
            data: {
                "Umpire": selectedUmp,
            },
            success: function (response) {
                createUmpChart(response.data);
                resolve();
            },
            error: function (error) {
                console.error("Error fetching umpire chart data:", error);
                reject("Error fetching umpire chart data");
            }
        });
    });
}

function createUmpChart(data) {
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
        .attr('y', 350)
        .attr('width', 225)
        .attr('height', 80)
        .attr('opacity', 1)
        .attr('preserveAspectRatio', 'none')
        .attr('xlink:href', 'https://st4.depositphotos.com/34668188/41728/v/450/depositphotos_417286480-stock-illustration-home-plate-icon-with-baseball.jpg');

    d3.select('#umpChart').node().append(svg.node());
}

function updateUmpireContent() {
    showLoadingScreen();

    Promise.all([
            getUmpireSummary(),
            updateUmpChart()
        ])
        .then(() => {
            hideLoadingScreen();
        })
        .catch(error => {
            console.error('Error updating umpire content:', error);
            hideLoadingScreen();
        });
}

function updateUmpLeaderboard(data) {
    $('#umpLeadersBody').empty();
    data.forEach(function (row) {
        var newRow = `<tr>
                        <td>${row.Umpire}</td>
                        <td>${row.Pitches}</td>
                        <td>${row['Total Pitch Accuracy'].toFixed(1)}</td>                        
                        <td>${row['Called Strike Accuracy'].toFixed(1)}</td>
                        <td>${row['Called Ball Accuracy'].toFixed(1)}</td>
                        <td>${(row['Zone Size'] * 12).toFixed(1)}</td>
                     </tr>`;
        $('#umpLeadersBody').append(newRow);
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
    updateUmpireContent();
    $.ajax({
        type: "POST",
        url: "/ump_leaderboard",

        success: function (response) {
            updateUmpLeaderboard(response.leaderboard);
        },
        error: function (error) {
            console.error("Error fetching ump leaders:", error);
            reject("Error fetching ump leaders");
        }
    });
    $("#umpire").change(function () {
        updateUmpireContent();
    });
    $('.select2').select2({
        width: '80%'
    });
});