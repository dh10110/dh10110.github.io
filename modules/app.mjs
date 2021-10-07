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

async function showResults() {
    let dataCount = 0;
    const fnDataCount = data => {
        dataCount += 1;
        showStatus('Loaded ' + dataCount);
        return data;
    };

    const [ridings, voting] = await Promise.all([
        data.getRidings().then(fnDataCount),
        data.getVotingResults().then(fnDataCount)
    ]);
    //showData('getRidings', ridings);
    //showData('getVotingResults', Array.from(voting.values()));

    for (const newRiding of ridings) {
        ridings.voting = [];
        for (const district_number of newRiding.districts) {
            const districtVoting = voting.get(district_number);
            ridings.voting.push(districtVoting);
        }
    }

    showData('processed ridings', ridings);
}


function start() {
    showStatus('Fetching Data...');
    showResults();
}

$(start);
