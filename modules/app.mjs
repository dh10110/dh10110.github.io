import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import { getOrAdd, concat } from './mapUtil.mjs';

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
        newRiding.summary = { total: 0, rejected: 0 };
        const mapByParty = new Map();
        for (const district_number of newRiding.districts) {
            const districtVoting = voting.get(district_number);
            newRiding.voting.push(districtVoting);
            for (const candidate of districtVoting.candidates) {
                const partyObj = parties[candidate.party] || parties.default;
                candidate.color = partyObj.color;
                const sumKey = partyObj.abbr === 'Other' ? 'Other' : candidate.party;
                const partyTotal = getOrAdd(mapByParty, sumKey, () => ({
                    party: sumKey,
                    color: partyObj.color,
                    votes: 0,
                    candidates: []
                }));
                partyTotal.votes += candidate.votes;
                partyTotal.candidates.push(candidate);
            }
            newRiding.summary.total += districtVoting.district_total_votes;
            newRiding.summary.rejected += districtVoting.district_rejected_ballots;

            districtVoting.candidates.sort(compareCandidates);
        }
        newRiding.summary.byParty = Array.from(mapByParty.values());
        newRiding.summary.byParty.sort(compareCandidates);
        for (const pt of newRiding.summary.byParty) {
            pt.candidates.sort(compareCandidates);
        }

        const ridingHtml = makeRidingHtml(newRiding);
        const container = document.getElementById('vote-initial');
        container.insertAdjacentHTML('beforeend', ridingHtml);
    }

    showData('processed ridings', ridings);

    for (const newRiding of ridings) {
        newRiding.positions = 0;
        newRiding.candidates = [];
        for (const dv of newRiding.voting) {
            newRiding.positions += 1;
            for (const candidate of dv.candidates) {
                newRiding.candidates.push(candidate);
            }
        }
        newRiding.candidates.sort(compareCandidates);
    }

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', concat(ridings, newRiding => {
        return `
<article>
    <details>
        <summary>${newRiding.riding}</summary>
        <section class="details-body">
            ${concat(newRiding.candidates, c => {
                return makeVoteLine({
                    heading: `${c.surname} - ${c.party}`,
                    votes: c.votes,
                    voteTotal: newRiding.summary.total,
                    color: c.color
                });
            })}
        </section>
    </details>
</article>
        `;
    }))
}

function makeRidingHtml(newRiding) {
    return `
<article>
    <details class="new-riding">
        <summary>${newRiding.riding} ${newRiding.voting.map(dv => 
            `<span style="color: ${dv.candidates[0].color};">⬤</span>`
        ).join('')}
            <div style="display:flex;">
            ${newRiding.summary.byParty.map(pt =>
                `<div style="height: 10px; background-color: ${pt.color}; flex-grow: ${(pt.votes / newRiding.summary.total).toFixed(3)}"></div>`
            ).join('')}
                <div style="height: 10px; background-color: #aaa; flex-grow: ${(newRiding.summary.rejected / newRiding.summary.total).toFixed(3)}"></div>
            <div>
        </summary>
        <section class="details-body">
            <details class="old-district">
                <summary>Totals</summary>
                <section class="details-body">
                    ${newRiding.summary.byParty.map(pt => 
                        makeVoteLine({
                            heading: pt.party,
                            votes: pt.votes,
                            voteTotal: newRiding.summary.total,
                            color: pt.color 
                        })
                    ).join('')}
                    ${makeVoteLine({
                        heading: 'Rejected Ballots',
                        votes: newRiding.summary.rejected,
                        voteTotal: newRiding.summary.total,
                        color: '#aaa'
                    })}
                </section>
            </details>
            ${newRiding.voting.map(dv => `
            <details class="old-district">
                <summary>${dv.district_name} <span style="color: ${dv.candidates[0].color};">⬤</span></summary>
                <section class="details-body">
                    ${dv.candidates.map(c => 
                        makeVoteLine({
                            heading: `${c.surname} - ${c.party}`,
                            votes: c.votes,
                            voteTotal: dv.district_total_votes,
                            color: c.color 
                        })
                    ).join('')}
                    ${makeVoteLine({
                        heading: 'Rejected Ballots',
                        votes: dv.district_rejected_ballots,
                        voteTotal: dv.district_total_votes,
                        color: '#aaa'
                    })}
                </section>
            </details>
        `).join('')}
        </section>
    </details>
</article>
    `;
}

function makeVoteLine({ heading, votes, voteTotal, color = '#aaa'} = {}) {
    return `
                    <div class="vote-total">
                        <div><span style="color: ${color};">⬤</span>${heading}</div>
                        ${makeMeter(votes, voteTotal, color)}
                    </div>
    `;
}

function makeMeter(numerator, denominator, barColor) {
    const pct = numerator / denominator;
    const txtPct = (100 * pct).toFixed(1) + '%';
    const text = numFormat(numerator);
    return `<div class="flex-meter"><span style="width:${txtPct}; background-color: ${barColor}"></span><span class="label">${text} (${txtPct})</span></div>`;
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
