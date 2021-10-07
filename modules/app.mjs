import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

function showData(heading, data) {
    const text = JSON.stringify(data, null, 4);
    $('<article/>')
        .append($('<h2/>').text(heading))
        .append($('<pre/>').text(text))
        .appendTo($('#data-container'));
}

function start() {
    $('#status').text('Fetching Data');

    data.getRidings().then(data => {
        showData('getRidings', data);
        $('#status').text('Loaded 1');
    });
    data.getVotingResults().then(data => {
        showData('getVotingResults', Array.from(data.values()));
        $('#status').text('Loaded 2');
    });
}

$(start);
