import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import { getOrAdd, concat } from './mapUtil.mjs';

const numFormat = new Intl.NumberFormat('en-CA').format;

function showData(heading, data, open = false) {
    const text = JSON.stringify(data, null, 4);
    const dataHtml = `
<article class="show-data">
    <details${open ? ' open' : ''}>
        <summary>${heading}</summary>
        <section class="details-body">
            <pre>${text}
        </section>
    </details>
</article>
    `;
    document.getElementById('data-container').insertAdjacentHTML('beforeend', dataHtml);
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
    showData('getRidings', ridings);
    showData('getVotingResults', Array.from(voting.values()));

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
        document.getElementById('vote-initial').insertAdjacentHTML('beforeend', ridingHtml);
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
        newRiding.summary.quota = Math.ceil(newRiding.summary.total / (newRiding.positions + 1)) //droop quota
        newRiding.candidates.sort(compareCandidates);
    }

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', concat(ridings, newRiding => {
        return `
<article>
    <details>
        <summary>${newRiding.riding}</summary>
        <section class="details-body">
            <details>
                <summary>First Choice Votes</summary>
                <section class="details-body">
                    ${
                        makeVoteLine({
                            heading: 'Quota',
                            votes: newRiding.summary.quota,
                            voteTotal: newRiding.summary.total,
                            color: '#333'
                        })
                    }
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
        </section>
    </details>
</article>
        `;
    }))
}

function colorDot(color) {
    return `<span style="color: ${color};">⬤</span>`
}

function colorBar(items) {
    return `
        <div class="flex-meter color-bar">
            ${concat(items, i => {
                return `<div style="background-color: ${i.color}; flex-grow: ${i.weight}"></div>`
            })}
        </div>
    `;
}

function makeRidingHtml(newRiding) {
    return `
<article>
    <details class="new-riding">
        <summary>${newRiding.riding} ${concat(newRiding.voting, dv => colorDot(dv.candidates[0].color))}
            ${colorBar([
                ...newRiding.summary.byParty.map(pt => ({
                    color: pt.color,
                    weight: (pt.votes / newRiding.summary.total).toFixed(3)
                })),
                {
                    color: '#aaa',
                    weight: (newRiding.summary.rejected / newRiding.summary.total).toFixed(3)
                }
            ])}
        </summary>
        <section class="details-body">
            <details class="old-district">
                <summary>Totals</summary>
                <section class="details-body">
                    ${concat(newRiding.summary.byParty, pt => 
                        makeVoteLine({
                            heading: pt.party,
                            votes: pt.votes,
                            voteTotal: newRiding.summary.total,
                            color: pt.color 
                        })
                    )}
                    ${makeVoteLine({
                        heading: 'Rejected Ballots',
                        votes: newRiding.summary.rejected,
                        voteTotal: newRiding.summary.total,
                        color: '#aaa'
                    })}
                </section>
            </details>
            ${concat(newRiding.voting, dv => `
                <details class="old-district">
                    <summary>${colorDot(dv.candidates[0].color)} ${dv.district_name} <small>${dv.district_number}</small></summary>
                    <section class="details-body">
                        ${concat(dv.candidates, c => 
                            makeVoteLine({
                                heading: `${c.surname} - ${c.party}`,
                                votes: c.votes,
                                voteTotal: dv.district_total_votes,
                                color: c.color 
                            })
                        )}
                        ${makeVoteLine({
                            heading: 'Rejected Ballots',
                            votes: dv.district_rejected_ballots,
                            voteTotal: dv.district_total_votes,
                            color: '#aaa'
                        })}
                    </section>
                </details>
            `)}
        </section>
    </details>
</article>
    `;
}

function makeVoteLine({ heading, votes, voteTotal, color = '#aaa'} = {}) {
    return `
                    <div class="vote-total">
                        <div>${colorDot(color)}${heading}</div>
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


function start() {
    showStatus('Fetching Data...');
    showResults();
}

$(start);
