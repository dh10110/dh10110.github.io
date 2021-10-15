import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import * as stv from './stv.mjs';
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
        const stvDistrict = new StvDistrict({ districtName: newRiding.riding });
        const mapByParty = new Map();
        for (const districtNumber of newRiding.districts) {
            const oldDistrict = voting.get(districtNumber);
            stvDistrict.addDistrict(oldDistrict);
            for (const candidate of oldDistrict.candidates) {
                const partyObj = parties[candidate.partyName] || parties.default;
                candidate.color = partyObj.color;
                const partyKey = partyObj.abbr === 'Other' ? 'Other' : candidate.partyName;
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
    }

    showData('stvDistricts', stvDistricts);

    document.getElementById('vote-initial').insertAdjacentHTML('beforeend', concat(stvDistricts, d => makeInitialHtml(d)));

    for (const stvDistrict of stvDistricts) {
       for (const d of stvDistrict.districts) {
           for (const c of d.candidates) {
               stvDistrict.addCandidate(c);
           }
       }
       stvDistrict.quota = Math.floor(stvDistrict.validVotes / (stvDistrict.seats + 1)) + 1; //droop
       //stvDistrict.candidates.sort(compareCandidates);
    }

    setInterval(() => runElection(stvDistricts[1]), 5000);

    /*
    {
        let stvDistrict = stvDistricts[1];
        const ballots = stv.generateBallots(stvDistrict);
        showData('ballots', ballots);
    
        document.getElementById('vote-stv').insertAdjacentHTML('beforeend', `
<article>
    <style>
        .ballots {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4em;
            align-items: flex-start;
        }
        .ballot {
            border: 1px solid silver;
            border-radius: 5px;
        }
        .ballot > ol {
            list-style-position: inside;
            padding: 0 0.2em;
            margin: 0;
        }
        .ballot > hr {
            margin: 0.3em 0;
        }
        .ballot > .count {
            text-align: center;
        }
    </style>
    <div class="ballots">
        ${concat(ballots, ballot => `
            <div class="ballot">
                <ol>
                    ${concat(ballot.ordered, c => 
                        `<li>${colorDot(c.color)} <span title="${c.givenName} - ${c.partyName}">${c.surname}<span></li>`
                    )}
                </ol>
                <hr>
                <div class="count">× ${ballot.count}</div>
            </div>
        `)}
    </div>
</article>
        `);
    }
    */

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', concat(stvDistricts, stvDistrict => {
        return `
<article>
    <details>
        <summary>${stvDistrict.districtName}</summary>
        <section class="details-body">
            <details>
                <summary>First Choice Votes</summary>
                <section class="details-body">
                    ${makeVoteLine({
                        heading: 'Quota',
                        votes: stvDistrict.quota,
                        voteTotal: stvDistrict.validVotes,
                        color: '#333'
                    })}
                    ${concat(stvDistrict.candidates, c => {
                        return makeVoteLine({
                            heading: `${c.surname} <small>${c.givenName}</small> - ${c.partyName}`,
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


function runElection(stvDistrict) {
    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', `
        <article>
            <details>
                <summary>${stvDistrict.districtName}</summary>
                <section class="details-body" id="stv-${stvDistrict.districtName}">
                </section>
            </details>
        </article>
    `);
    stv.doElection(stvDistrict, rpt => {
        document.getElementById('stv-' + stvDistrict.districtName).insertAdjacentHTML('beforeend', `
            <details>
                <summary>${rpt.heading}</summary>
                <section class="details-body">
                    ${rpt.quota ?
                        makeVoteLine({
                            heading: 'Quota',
                            votes: rpt.quota,
                            voteTotal: stvDistrict.validVotes,
                            color: '#333'
                        })
                        : ''
                    }
                    ${rpt.candidates ?
                        concat([...rpt.candidates].sort(compareCandidates), c => 
                            makeVoteLine({
                                heading: `${c.surname} <small>${c.givenName}</small> - ${c.partyName} [${c.stv.state}] ${c.stv.kf}`,
                                votes: c.stv.vote,
                                voteTotal: stvDistrict.validVotes,
                                color: c.color
                            })
                        )
                        : ''
                    }
                </section>
            </details>
        `);
    });
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

function makeInitialHtml(stvDistrict) {
    return `
<article>
    <details class="stv-district">
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
                            heading: pt.groupName,
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
                <details class="old-district" style="border-color: ${dv.candidates[0].color}">
                    <summary>${colorDot(dv.candidates[0].color)} ${dv.districtName} <small>${dv.districtNumber}</small></summary>
                    <section class="details-body">
                        ${concat(dv.candidates, c =>
                            makeVoteLine({
                                heading: `${c.surname} <small>(${c.givenName})</small> - ${c.partyName}`,
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
