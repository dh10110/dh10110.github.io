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

function compareCandidates(a, b) {
    return (b.votes - a.votes); //desc
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
        newRiding.voting = [];
        for (const district_number of newRiding.districts) {
            const districtVoting = voting.get(district_number);
            newRiding.voting.push(districtVoting);
            for (const candidate of districtVoting.candidates) {
                let partyObj = parties[candidate.party] || parties.default;
                candidate.color = partyObj.color;
            }
            districtVoting.candidates.sort(compareCandidates);
        }

        const ridingHtml = `
            <article>
                <details open class="new-riding">
                    <summary>${newRiding.riding} ${newRiding.voting.map(dv => 
                        `<span style="color: ${dv.candidates[0].color};">⬤</span>`
                    ).join('')}</summary>
                    ${newRiding.voting.map(dv => `
                    <details open class="old-district">
                        <summary>${dv.district_name} <span style="color: ${dv.candidates[0].color};">⬤</span></summary>
                        <section>
                        ${dv.candidates.map(c => `
                            <div><span style="color: ${c.color};">⬤</span>${c.surname} - ${c.party}</div>
                            <div class="meter"><div style="width:${(100 * c.votes / dv.district_total_votes).toFixed(0)}%; background-color:${c.color};">${c.votes}</div></div>
                        `).join('')}
                        <div>Rejected Ballots</div>
                        <div class="meter"><div style="width:${(100 * dv.district_rejected_ballots / dv.district_total_votes).toFixed(0)};">${dv.district_rejected_ballots}</div></div>
                        </section>
                    </details>
                    `).join('')}
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
