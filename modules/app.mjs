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

    const [parties, ridings, voting] = await Promise.all([
        data.getParties().then(fnDataCount),
        data.getRidings().then(fnDataCount),
        data.getVotingResults().then(fnDataCount)
    ]);
    showData('getParties', parties);
    //showData('getRidings', ridings);
    //showData('getVotingResults', Array.from(voting.values()));

    for (const newRiding of ridings) {
        const $nr = $('<article/>');
        const $nrd = $('<details/>').appendTo($nr);
        $('<summary/>').text(newRiding.riding);

        newRiding.voting = [];
        for (const district_number of newRiding.districts) {
            const districtVoting = voting.get(district_number);
            newRiding.voting.push(districtVoting);

            $od = $('<details>').appendTo($nrd);
            $('<summary/>').text(districtVoting.district_name).appendTo($od);

            for (const candidate of districtVoting.candidates) {
                $('<p/>').text(`${candidate.party} ${candidate.surname} ${candidate.votes}`).appendTo($od);
            }
        }
        $nr.appendTo($('#vote-initial'));
    }

    showData('processed ridings', ridings);
}


function start() {
    showStatus('Fetching Data...');
    showResults();
}

$(start);
