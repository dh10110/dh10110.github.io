import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

function start() {
    $('#status').text('Fetching Data');

    data.getRidings().then(data => {
        const text = JSON.stringify(data, null, 4);
        $('<article/>')
            .append($('<h2/>').text('getVotingResults'))
            .append($('<pre/>').text(text))
            .appendTo($('#data-container'));
        $('#status').text('Loaded 1');
    });
    data.getVotingResults().then(data => {
        const text = JSON.stringify(Array.from(data.values()), null, 4);
        $('<article/>')
            .append($('<h2/>').text('getVotingResults'))
            .append($('<pre/>').text(text))
            .appendTo($('#data-container'));
        $('#status').text('Loaded 2');
    });
}

$(start);
