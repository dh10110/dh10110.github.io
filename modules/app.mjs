import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

function showData(heading, data) {
    const text = JSON.stringify(data, null, 4);
    $('<article/>')
        .append($('<h2/>').text(heading))
        .append($('<pre/>').text(text))
        .appendTo($('#data-container'));
}

function showStatus(text) {
    $('#status').text(text);
}

function reportData(heading) {
    return data => {
        showData('getRidings', data);
        dataCount += 1;
        showStatus('Loaded ' + heading);
    };
}

async function showResults() {
    let dataCount = 0;
    const fnDataCount = data => {
        dataCount += 1;
        return data;
    };

    [ridings, voting] = await Promise.all(
        data.getRidings().then(fnDataCount),
        data.getVotingResults().then(fnDataCount)
    );
    showData('getRidings', ridings);
    showData('getVotingResults', Array.from(voting.values()));

}


function start() {
    showStatus('Fetching Data...');
    showResults();
}

$(start);
