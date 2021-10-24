import $ from './lib/jquery.mjs';
import * as data from './data.mjs';
import { getOrAdd, concat } from './mapUtil.mjs';
import { orderBy, desc, orderCriteria } from './arrayUtil.mjs';
import { District, StvDistrict, Candidate, CandidateGroup } from './classes.mjs';
//adding imports used by workers here, so that syntax errors are reported
import { ElectWigm } from "./wigm.mjs";
import { generateBallots } from './ballotMaker.mjs';
import { ver } from './electionWorker.mjs'; //for cache busting

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
                candidate.originalDistrict = oldDistrict.districtNumber;
                candidate.vote = 0; //STV count, not original votes
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
        for (const candidate of orderBy(stvDistrict.candidates, c => c.surname, c => c.givenName, c => c.partyName)) {
            candidate.id = candidateId++;
            stvDistrict.candidateById.set(candidate.id, candidate);
        }

        stvDistricts.push(stvDistrict);
    }

    showData('stvDistricts', stvDistricts);

    document.getElementById('vote-initial').insertAdjacentHTML('beforeend', concat(stvDistricts, d => makeInitialHtml(d)));

    setTimeout(_ => {
        for (const stvDistrict of stvDistricts) {
            runElectionWorker(stvDistrict);
            //break; //Only do one for testing
        }
    }, 1000);
}

function runElectionWorker(stvDistrict) {
    const detailsId = `stv-${stvDistrict.districtName}`;
    const statusId = `stat-${stvDistrict.districtName}`;
    const dotsId = `dots-${stvDistrict.districtName}`;
    const tabsNavId = `tn-${stvDistrict.districtName}`;
    const tabsBodyId = `tb-${stvDistrict.districtName}`;
    let progress = 'Starting...';
    let lastProgress = null;
    let roundQueue = [];

    document.getElementById('vote-stv').insertAdjacentHTML('beforeend', `
        <article class="vote-district">
            <details>
                <summary>${stvDistrict.districtName} <small id="${statusId}"></small><span id="${dotsId}"></summary>
                <section class="details-body snap-tabs" id="${detailsId}">
                    <header>
                        <nav id="${tabsNavId}" class="vote-steps"></nav>
                        <span class="snap-indicator"></span>
                    </header>
                    <section id="${tabsBodyId}"></section>
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
    const worker = new Worker('/modules/electionWorker.mjs?v=' + ver, {type:'module'});
    worker.addEventListener('message', e => {
        const rpt = e.data;
        if (typeof(rpt.p) !== 'undefined') {
            progress = rpt.p;
        }
        if (rpt.f) {
            document.getElementById(dotsId).insertAdjacentHTML('beforeend', `
                ${concat(rpt.c, cc => {
                    const [cid, state, vote] = cc;
                    const c = stvDistrict.candidateById.get(cid);
                    return `<span style="color: ${c.color};" title="${c.surname} - ${c.partyName}">⬤</span>`;
                })}
            `);
        }
        if (rpt.c) {
            for (const c of stvDistrict.candidates) {
                c.prevVote = null;
            }
            for (const cc of rpt.c) {
                const [cid, state, vote, order] = cc;
                const c = stvDistrict.candidateById.get(cid);
                c.state = state;
                c.prevVote = c.vote;
                c.vote = vote;
                c.order = order;
            }
        }
        if (rpt.q) {
            stvDistrict.quota = rpt.q;
        }
        if (rpt.x) {
            stvDistrict.prevExhausted = stvDistrict.exhausted;
            stvDistrict.exhausted = rpt.x;
        }
        if (rpt.h) {
            const tabId = Math.random().toString().substr(2);
            //Header Nav
            document.getElementById(tabsNavId).insertAdjacentHTML('beforeend', `
                <a href="#${tabId}">${rpt.i}</a>
            `);
            //Body Content
            document.getElementById(tabsBodyId).insertAdjacentHTML('beforeend', `
                <article id="${tabId}">
                    <header><h3>${rpt.h} ${concat(rpt.a, cid => {
                        const c = stvDistrict.candidateById.get(cid);
                        return `<span style="color: ${c.color};" title="${c.partyName}">⬤</span>${c.surname}`;
                    }, ', ')}</h3></header>
                    <section class="body">
                        ${stvDistrict.quota ? makeVoteLine({ heading: 'Quota', votes: stvDistrict.quota, voteTotal: stvDistrict.validVotes, color: '#333' }) : ''}
                        ${concat(orderBy(stvDistrict.candidates, desc(c => c.state.code), desc(c => c.vote), c => c.order), c => {
                            return makeVoteLine({
                                heading: `${c.surname} <small>${c.givenName}</small> - ${c.partyName}`,
                                votes: c.vote,
                                prevVotes: c.prevVote,
                                voteTotal: stvDistrict.validVotes,
                                color: c.color
                            });
                        })}
                        ${stvDistrict.exhausted ?
                            makeVoteLine({
                                heading: 'Exhausted Ballots',
                                votes: stvDistrict.exhausted,
                                prevVotes: stvDistrict.prevExhausted,
                                voteTotal: stvDistrict.validVotes,
                                color: '#888'
                            })
                        : ''}
                    </section>
                </article>
            `);
            //Old
            /*
            document.getElementById(detailsId).insertAdjacentHTML('beforeend', `
                <details>
                    <summary>${rpt.h} ${concat(rpt.a, cid => {
                        const c = stvDistrict.candidateById.get(cid);
                        return `<span style="color: ${c.color};" title="${c.partyName}">⬤</span>${c.surname}`;
                    }, ', ')}</summary>
                    <section class="details-body">
                        ${stvDistrict.quota ? makeVoteLine({ heading: 'Quota', votes: stvDistrict.quota, voteTotal: stvDistrict.validVotes, color: '#333' }) : ''}
                        ${concat(orderBy(stvDistrict.candidates, desc(c => c.state.code), desc(c => c.vote), c => c.order), c => {
                            return makeVoteLine({
                                heading: `${c.surname} <small>${c.givenName}</small> - ${c.partyName}`,
                                votes: c.vote,
                                prevVotes: c.prevVote,
                                voteTotal: stvDistrict.validVotes,
                                color: c.color
                            });
                        })}
                        ${stvDistrict.exhausted ?
                            makeVoteLine({
                                heading: 'Exhausted Ballots',
                                votes: stvDistrict.exhausted,
                                prevVotes: stvDistrict.prevExhausted,
                                voteTotal: stvDistrict.validVotes,
                                color: '#888'
                            })
                        : ''}
                    </section>
                </details>
            `);
            */
        }
    });
    window.requestAnimationFrame(showProgress);
    worker.postMessage({
        b: 'party-vote',
        c: 'wigm',
        d: compressForPostMessage(stvDistrict)
    });
}

function compressForPostMessage(stvDistrict) {
    return [
        stvDistrict.districtName,
        stvDistrict.seats,
        stvDistrict.candidates.map(c => [
            c.id,
            c.partyName,
            c.votes,
            c.votePct,
            c.originalDistrict
        ])
    ];
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

function makeVoteLine({ heading, votes, prevVotes, voteTotal, color = '#aaa'} = {}) {
    return `
                    <div class="vote-total">
                        <div>${colorDot(color)}${heading}</div>
                        ${prevVotes ?
                            makeDeltaMeter(votes, prevVotes, voteTotal, color) :
                            makeMeter(votes, voteTotal, color)
                        }
                    </div>
    `;
}

function makeMeter(numerator, denominator, barColor) {
    const pct = numerator / denominator;
    const txtPct = (100 * pct).toFixed(1) + '%';
    const text = numFormat(numerator);
    return `<div class="flex-meter"><span style="width:${txtPct}; background-color: ${barColor}"></span><span class="label">${text} (${txtPct})</span></div>`;
}

function makeDeltaMeter(curValue, prevValue, denominator, barColor) {
    const delta = curValue - prevValue;
    const lower = curValue < prevValue ? curValue : prevValue;

    const pctLow = curValue / denominator;
    const txtPctLow = (100 * pctLow).toFixed(1) + '%';

    const pctDelta = Math.abs(delta) / denominator;
    const txtPctDelta = (100 * pctDelta).toFixed(1) + '%';

    const textCur = numFormat(curValue);
    const pctCur = curValue / denominator;
    const txtPctCur = (100 * pctCur).toFixed(1) + '%';

    const textDelta = (delta >= 0 ? '+' : '') + numFormat(delta);
    const deltaColor = (delta > 0 ? '#cfc' : '#fcc');

    const lowTag = curValue === 0 ? '' : `<span style="width:${txtPctLow}; background-color: ${barColor}"></span>`;
    const deltaTag = delta === 0 ? '' : `<span style="width:${txtPctDelta}; background-color: ${deltaColor}">`;
    const deltaAddOn = delta === 0 ? '' : ` (${textDelta})`;

    return `<div class="flex-meter">${lowTag}${deltaTag}</span><span class="label">${textCur} (${txtPctCur})${deltaAddOn}</span></div>`;
}

function start() {
    showStatus('Fetching Data...');
    showResults();

    //scroll internal links into view
    addEventListener('click', e => {
        const el = e.target.closest('a');
        if (el) {
            //TODO: check for # 
            const id = el.getAttribute('href').substr(1);
            document.getElementById(id).scrollIntoView();
            e.preventDefault();
        }
    }, true);
}

$(start);
