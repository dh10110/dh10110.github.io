import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import { getOrAdd } from './mapUtil.mjs';

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
        newRiding.summary = newRiding.voting.reduce((sum, dv) => {
            for (const candidate of dv.candidates) {
                const partyObj = parties[candidate.party] || parties.default;
                const key = partyObj.abbr === 'Other' ? 'Other' : candidate.party;
                const partyTotal = getOrAdd(sum.byParty, key, () => ({
                    party: key,
                    color: candidate.color,
                    votes: 0
                }));
                partyTotal.votes += candidate.votes;
            }
            sum.total += dv.district_total_votes;
            sum.rejected += dv.district_rejected_ballots;
            return sum;
        }, {
            total: 0,
            rejected: 0,
            byParty: new Map()
        });

        const ridingHtml = `
<article>
    <details class="new-riding">
        <summary>${newRiding.riding} ${newRiding.voting.map(dv => 
            `<span style="color: ${dv.candidates[0].color};">⬤</span>`
        ).join('')}
            <div style="display:flex;">
            ${Array.from(newRiding.summary.byParty.values()).map(pt =>
                `<div style="height: 5px; background-color: ${pt.color}; flex-grow: ${(pt.votes / newRiding.summary.total).toFixed(3)}"></div>`
            ).join('')}
                <div style="height: 5px; background-color: #aaa; flex-grow: ${(newRiding.summary.rejected / newRiding.summary.total).toFixed(3)}"></div>
            <div>
        </summary>
        <section class="details-body">
            <details class="old-district">
                <summary>Totals</summary>
                <section class="details-body">
                ${Array.from(newRiding.summary.byParty.values()).map(pt => `
                    <div class="vote-total">
                        <div><span style="color: ${pt.color};">⬤</span>${pt.party}</div>
                        ${makeMeter(pt.votes, newRiding.summary.total, pt.color)}
                    </div>
                `).join('')}
                    <div class="vote-total">
                        <div>Rejected Ballots</div>
                        ${makeMeter(newRiding.summary.rejected, newRiding.summary.total, '#aaa')}
                    </div>
                </section>
            </details>
            ${newRiding.voting.map(dv => `
            <details class="old-district">
                <summary>${dv.district_name} <span style="color: ${dv.candidates[0].color};">⬤</span></summary>
                <section class="details-body">
                ${dv.candidates.map(c => `
                    <div class="vote-total">
                        <div><span style="color: ${c.color};">⬤</span>${c.surname} - ${c.party}</div>
                        ${makeMeter(c.votes, dv.district_total_votes, c.color)}
                    </div>
                `).join('')}
                    <div class="vote-total">
                        <div>Rejected Ballots</div>
                        ${makeMeter(dv.district_rejected_ballots, dv.district_total_votes, '#aaa')}
                    </div>
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
