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
        //const $nr = $('<article/>');
        //const $nrd = $('<details/>').appendTo($nr);
        //$('<summary/>').text(newRiding.riding).appendTo($nrd);

        newRiding.voting = [];
        for (const district_number of newRiding.districts) {
            const districtVoting = voting.get(district_number);
            newRiding.voting.push(districtVoting);

            //const $od = $('<details>').appendTo($nrd);
            //$('<summary/>').text(districtVoting.district_name).appendTo($od);

            for (const candidate of districtVoting.candidates) {
                //$('<p/>').text(`${candidate.party} ${candidate.surname} ${candidate.votes}`).appendTo($od);
            }
        }
        //$nr.appendTo($('#vote-initial'));

        const ridingHtml = `
            <article>
                <details open class="new-riding">
                    <summary>${newRiding.riding}</summary>
                    ${newRiding.voting.map(dv => `
                        <details open class="old-district">
                            <summary>${dv.district_name}</summary>
                            <dl class="votes">
                            ${dv.candidates.map(c => `
                                <dt>${c.surname}</dt>
                                <dd>${c.party}</dd>
                                <dd>${c.votes}</dd>
                            `)}
                            </dl>
                        </details>
                    `)}
                </details>
            </article>
        `;
        const container = document.getElementById('vote-initial');
        container.insertAdjacentHTML('beforeend', ridingHtml);
    }

    showData('processed ridings', ridings);
}


function start() {
    showStatus('Fetching Data...');
    showResults();
}

$(start);
