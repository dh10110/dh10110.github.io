import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import { getOrAdd, concat } from './mapUtil.mjs';
import { District, StvDistrict, Candidate, CandidateGroup } from './classes.mjs';

const numFormat = new Intl.NumberFormat('en-CA').format;

function showData(heading, data, open = false) {
    const text = JSON.stringify(data, null, 4);
    const dataHtml = `
<article class="show-data">
    <details${open ? ' open' : ''}>
        <summary>${heading}</summary>
        <section class="details-body">
            <pre>${text}</pre>
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

    const stvDistricts = [];
    
    for (const newRiding of ridings) {
        const stvDistrict = new StvDistrict({ districtNmame: newRiding.riding });
        const mapByParty = new Map();
        for (const districtNumber of newRiding.districts) {
            const oldDistrict = voting.get(districtNumber);
            stvDistrict.addDistrict(oldDistrict);
            for (const candidate of oldDistrict.candidates) {
                const partyObj = parties[candidate.party] || parties.default;
                candidate.color = partyObj.color;
                const partyKey = partyObj.abbr === 'Other' ? 'Other' : candidate.party;
                const partyTotal = getOrAdd(mapByParty, partyKey, () => new CandidateGroup({
                    groupName: partyKey,
                    color: partyObj.color
                }));
                partyTotal.votes += candidate.votes;
                partyTotal.candidates.push(candidate);
            }
            stvDistrict.totalBallots += oldDistrict.totalBallots;
            stvDistrict.rejectedBallots += oldDistrict.rejectedBallots;

            oldDistrict.candidates.sort(compareCandidates);
        }
        stvDistrict.byParty = Array.from(mapByParty.values());
        stvDistrict.byParty.sort(compareCandidates);
        for (const partyTotal of stvDistrict.byParty) {
            partyTotal.candidates.sort(compareCandidates);
        }

        stvDistricts.push(stvDistrict);

        //const ridingHtml = makeRidingHtml(newRiding);
        //document.getElementById('vote-initial').insertAdjacentHTML('beforeend', ridingHtml);
    }

    showData('stvDistricts', stvDistricts);

    document.getElementById('vote-initial').insertAdjacentHTML('beforeend', concat(stvDistricts, d => makeInitialHtml));

    for (const stvDistrict of stvDistricts) {
       for (const d of stvDistrict.districts) {
           for (const c of d.candidates) {
               stvDistrict.addCandidate(c);
           }
       }
       stvDistrict.quota = Math.ceil(stvDistrict.validVotes / (stvDistrict.seats + 1)); //droop
       stvDistrict.candidates.sort(compareCandidates);
   }

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', concat(stvDistricts, stvDistrict => {
        return `
<article>
    <details>
        <summary>${stvDistrict.districtName}</summary>
        <section class="details-body">
            <details>
                <summary>First Choice Votes</summary>
                <section class="details-body">
                    ${
                        makeVoteLine({
                            heading: 'Quota',
                            votes: stvDistrict.quota,
                            voteTotal: stvDistrict.validVotes,
                            color: '#333'
                        })
                    }
                    ${concat(stvDistrict.candidates, c => {
                        return makeVoteLine({
                            heading: `${c.surname} <small>${c.given_name}</small> - ${c.party}`,
                            votes: c.votes,
                            voteTotal: stvDistrict.validVotes,
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
                                heading: `${c.surname} <small>${c.given_name}</small> - ${c.party}`,
                                votes: c.votes,
                                voteTotal: dv.district_total_votes - dv.district_rejected_ballots,
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

function makeInitialHtml(stvDistrict) {
    return `
<article>
    <details class="new-riding">
        <summary>${stvDistrict.districtName} ${concat(stvDistrict.districts, d => colorDot(d.candidates[0].color))}
            ${colorBar([
                ...stvDistrict.byParty.map(pt => ({
                    color: pt.color,
                    weight: (pt.votes / stvDistrict.validVotes).toFixed(3)
                })),
                {
                    color: '#aaa',
                    weight: (stvDistrict.rejectedBallots / stvDistrict.totalBallots).toFixed(3)
                }
            ])}
        </summary>
        <section class="details-body">
            <details class="old-district">
                <summary>Totals</summary>
                <section class="details-body">
                    ${concat(stvDistrict.byParty, pt => 
                        makeVoteLine({
                            heading: pt.party,
                            votes: pt.votes,
                            voteTotal: stvDistrict.validVotes,
                            color: pt.color
                        })
                    )}
                    ${makeVoteLine({
                        heading: 'Rejected Ballots',
                        votes: stvDistrict.rejectedBallots,
                        voteTotal: stvDistrict.totalBallots,
                        color: '#aaa'
                    })}
                </section>
            </details>
            ${concat(stvDistrict.districts, dv => `
                <details class="old-district">
                    <summary>${colorDot(dv.candidates[0].color)} ${dv.districtName} <small>${dv.districtNumber}</small></summary>
                    <section class="details-body">
                        ${concat(dv.candidates, c =>
                            makeVoteLine({
                                heading: `${c.surname} <small>${c.givenName}</small> - ${c.partyName}`,
                                votes: c.votes,
                                voteTotal: dv.validVotes,
                                color: c.color 
                            })
                        )}
                        ${makeVoteLine({
                            heading: 'Rejected Ballots',
                            votes: dv.rejectedBallots,
                            voteTotal: dv.totalBallots,
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
