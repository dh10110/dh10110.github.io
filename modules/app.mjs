import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

const numFormat = new Intl.NumberFormat('en-CA').format;

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
    <details class="new-riding">
        <summary>${newRiding.riding} ${newRiding.voting.map(dv => 
            `<span style="color: ${dv.candidates[0].color};">⬤</span>`
        ).join('')}</summary>
        <section class="details-body">
            ${newRiding.voting.map(dv => `
            <details class="old-district">
                <summary>${dv.district_name} <span style="color: ${dv.candidates[0].color};">⬤</span></summary>
                <section class="details-body">
                ${dv.candidates.map(c => `
                    <div><span style="color: ${c.color};">⬤</span>${c.surname} - ${c.party}</div>
                    ${makeMeter(c.votes, dv.district_total_votes, c.color)}
                `).join('')}
                <div>Rejected Ballots</div>
                ${makeMeter(dv.district_rejected_ballots, dv.district_total_votes, '#aaa')}
                </section>
            </details>
        `).join('')}
        </section>
    </details>
</article>
        `;
        const container = document.getElementById('vote-initial');
        container.insertAdjacentHTML('beforeend', ridingHtml);
    }

    showData('processed ridings', ridings);
}

function makeMeter(numerator, denominator, barColor) {
    const pct = numerator / denominator;
    const text = numFormat(numerator);
    return `<div class="flex-meter"><span style="width:${ratioWidth(pct)}; background-color: ${barColor}"></span><span class="label">${text}</span></div>`;
}

function ratioWidth(numerator, denominator) {
    if (!denominator) denominator = 1;
    const txtpct = (100 * numerator / denominator).toFixed(1);
    if (txtpct == '0') {
        return '1px';
    } else {
        return txtpct + '%';
    }
}


function start() {
    showStatus('Fetching Data...');
    showResults();
}

$(start);
