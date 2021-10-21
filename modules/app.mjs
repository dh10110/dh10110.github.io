import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import * as stv from './stv.mjs';
import { getOrAdd, concat } from './mapUtil.mjs';
import { orderBy, desc, orderCriteria } from './arrayUtil.mjs';
import { District, StvDistrict, Candidate, CandidateGroup } from './classes.mjs';
//adding imports used by workers here, so that syntax errors are reported
import { ElectWigm } from "./wigm.mjs";
import { generateBallots } from './ballotMaker.mjs';

//const ver = '1.2.1';
const ver = new Date().getTime();

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

const compareCandidates = desc('votes');

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
                stvDistrict.candidates.push(candidate);
            }
            stvDistrict.totalBallots += oldDistrict.totalBallots;
            stvDistrict.rejectedBallots += oldDistrict.rejectedBallots;

            oldDistrict.candidates.sort(compareCandidates);
        }
        stvDistrict.byParty = orderBy(mapByParty.values(), compareCandidates);
        for (const partyTotal of stvDistrict.byParty) {
            partyTotal.candidates.sort(compareCandidates);
        }
        //Assign candidate id in alphabetical order; can be used for tiebreaks
        stvDistrict.candidateById = new Map();
        let candidateId = 1;
        for (const candidate of orderBy(this.candidates, c => c.surname, c => c.givenName, c => c.partyName)) {
            candidate.id = candidateId++;
            stvDistrict.candidateById.add(candidate.id, candidate);
        }

        stvDistricts.push(stvDistrict);
    }

    showData('stvDistricts', stvDistricts);

    document.getElementById('vote-initial').insertAdjacentHTML('beforeend', concat(stvDistricts, d => makeInitialHtml(d)));

    setTimeout(_ => {
        for (const stvDistrict of stvDistricts) {
            //runElectionWorker(stvDistrict);
        }
    }, 5000);
}

function runElectionWorker(stvDistrict) {
    const detailsId = `stv-${stvDistrict.districtName}`;
    const statusId = `stat-${stvDistrict.districtName}`;
    const dotsId = `dots-${stvDistrict.districtName}`;
    let progress = 'Starting...';
    let lastProgress = null;
    let roundQueue = [];

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', `
        <article>
            <details>
                <summary>${stvDistrict.districtName} <small id="${statusId}"></small><span id="${dotsId}"></summary>
                <section class="details-body" id="${detailsId}">
                </section>
            </details>
        </article>
    `);

    const showProgress = function () {
        if (progress !== lastProgress) {
            //Progress text
            if (!progress) {
                document.getElementById(statusId).textContent = '';
            }else {
                document.getElementById(statusId).textContent = `(${progress})`;
            }
            lastProgress = progress;
            //roundQueue
            let localQueue = [];
            while (roundQueue.length) {
                localQueue.push(roundQueue.shift());
            }
            document.getElementById(detailsId).insertAdjacentHTML('beforeend', concat(localQueue));
        }
        if (progress) {
            window.requestAnimationFrame(showProgress);
        }
    }

    //Start Worker
    //const worker = new Worker('/modules/stv-worker.mjs?v=' + ver, {type:'module'});
    const worker = new Worker('/modules/electionWorker.mjs?v=' + ver, {type:'module'});
    worker.addEventListener('message', e => {
        const rpt = e.data; //we're passing large objects around; deserialize is slow
        if (typeof rpt.progress !== 'undefined') {
            progress = rpt.progress;
        }
        if (rpt.final) {
            document.getElementById(dotsId).insertAdjacentHTML('beforeend', `
                ${concat(orderBy(rpt.candidates, compareStvCandidates), c =>
                    `<span style="color: ${c.color};" title="${c.surname} - ${c.partyName}">⬤</span>`
                )}
            `);
        }
        if (rpt.heading) {
            //document.getElementById(detailsId).insertAdjacentHTML('beforeend', `
            roundQueue.push(`
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
                            concat(orderBy(rpt.candidates, compareStvCandidates), c => 
                                makeVoteLine({
                                    heading:
                                        `${c.stv.winnerOrder ? `<strong>${c.stv.winnerOrder}</strong>` : ''}
                                        ${c.surname} <small>${c.givenName}</small> - ${c.partyName}`,
                                    votes: c.stv.vote,
                                    voteTotal: stvDistrict.validVotes,
                                    color: c.color
                                })
                            )
                            : ''
                        }
                        ${rpt.exhausted ?
                            makeVoteLine({
                                heading: 'Exhausted Ballots',
                                votes: rpt.exhausted,
                                voteTotal: stvDistrict.validVotes,
                                color: '#888'
                            })
                            : ''
                        }
                    </section>
                </details>
            `);
        }
    });
    window.requestAnimationFrame(showProgress);
    worker.postMessage({ stvDistrict, method: 'wigm' });
    /* TODO:
        serialize and deserialize for postMessage is slow for large objects 
        was seeing run times of 90s, even though count finished in 15s

        Idea custom serialization for postMessage
        →worker
        options: [countMethod, ballotMethod]
        district: [districtId:#, [candidates]]
        candiate: [candidateId:#, partyId:#, originalVote:#, originalDistrictId:#]

        →return
        root: [round:@, action:@, quota:#, exhausted:#, [candidates]]
        candidate: [candidateId:#, state:#, vote:#]
    */
}

function runElection(stvDistrict) {
    const detailsId = `stv-${stvDistrict.districtName}`;
    const statusId = `stat-${stvDistrict.districtName}`;
    let progress = 'Starting...';
    let lastProgress = null;

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', `
        <article>
            <details>
                <summary>${stvDistrict.districtName} <span id="${statusId}"></span></summary>
                <section class="details-body" id="${detailsId}">
                </section>
            </details>
        </article>
    `);

    const showProgress = function () {
        if (progress !== lastProgress) {
            document.getElementById(statusId).textContent = progress;
            lastProgress = progress;
        }
        if (progress) {
            window.requestAnimationFrame(showProgress);
        }
    }

    window.setTimeout(run, 1000);

    function run() {
        window.requestAnimationFrame(showProgress);

        stv.doElection(stvDistrict, rpt => {
            if (rpt.progress) {
                progress = rpt.progress;
            } else {
                document.getElementById(detailsId).insertAdjacentHTML('beforeend', `
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
                                concat([...rpt.candidates].sort(compareStvCandidates), c => 
                                    makeVoteLine({
                                        heading:
                                            `${c.stv.winnerOrder ? `<strong>${c.stv.winnerOrder}</strong>` : ''}
                                            ${c.surname} <small>${c.givenName}</small> - ${c.partyName}`,
                                        votes: c.stv.vote,
                                        voteTotal: stvDistrict.validVotes,
                                        color: c.color
                                    })
                                )
                                : ''
                            }
                            ${rpt.exhausted ?
                                makeVoteLine({
                                    heading: 'Exhausted Ballots',
                                    votes: rpt.exhausted,
                                    voteTotal: stvDistrict.validVotes,
                                    color: '#888'
                                })
                                : ''
                            }
                        </section>
                    </details>
                `);
            }
        });

        progress = null;
    }
}

const compareStvCandidates = orderCriteria(
    c => Number(!c.stv.winnerOrder), //winner order existence
    c => c.stv.winnerOrder, //winner order
    desc(c => c.stv.vote), //most votes
    compareCandidates //most votes in original election
);

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
