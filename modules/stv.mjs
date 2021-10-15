import { getOrAdd } from './mapUtil.mjs';
import { District, StvDistrict, Candidate, CandidateGroup } from './classes.mjs';

export function generateBallots(stvDistrict) {
    //Group all the candidates by party
    const partyMap = new Map();
    for (const candidate of stvDistrict.candidates) {
        const key = candidate.partyName === 'Independent' ? 'Ind: ' + candidate.surname : candidate.partyName;
        const partyGroup = getOrAdd(partyMap, key, () => new CandidateGroup({
            groupName: candidate.partyName,
            color: candidate.color
        }));
        partyGroup.addCandidate(candidate);
    }

    const ballots = [];
    for (const [key, party] of partyMap) {
        let maxItem = { weight: 0, ballot: null };
        const ballotDefs = getBallots(party.candidates);
        ballots.push(...ballotDefs);
    }
    
    return ballots;
}

const HOPEFUL = 0;
const ELECTED = 1;
const PENDING = 2;
const DEFEATED = 3;

export function doElection(stvDistrict, fnReport) {
    //https://prfound.org/resources/reference/reference-meek-rule/
    
    const hopeful = new Set();
    const winners = [];
    let winnerOrder = 1;
    
    //Ref A
    const omega = 10E-6;

    for (const candidate of stvDistrict.candidates) {
        candidate.stv = { state: HOPEFUL, kf: 1, vote: 0 };
        hopeful.add(candidate);
    }

    const ballotDefs = generateBallots(stvDistrict);
    const ballots = [];
    for (const ballotDef of ballotDefs) {
        for (let i = 0; i < ballotDef.count; i += 1) {
            ballots.push({ candidates: ballotDef.ordered });
        }
    }

    //Ref B
    let roundNum = 0;
    const fnRound = function () {
        roundNum += 1;

        //Ref B.1 Test if Count Complete
        if (winners.length + hopeful.size <= stvDistrict.seats) {
            return false;
        }

        //Ref B.2 Iterate
        let iterationNum = 0;
        let prevSurplus = Number.MAX_SAFE_INTEGER;
        const fnIterate = function () {
            iterationNum += 1;

            //Ref B.2.a Distribute
            for (const candidate of stvDistrict.candidates) {
                candidate.stv.vote = 0;
            }
            for (const ballot of ballots) {
                ballot.weight = 1;
                for (const candidate of ballot.candidates) {
                    const voteDelta = ceil(ballot.weight * candidate.stv.kf, 9);
                    candidate.stv.vote += voteDelta;
                    ballot.weight -= voteDelta;
                    if (ballot.weight <= 0) break;
                }
            }

            //Ref B.2.b Update Quota
            let totalVote = 0;
            for (const candidate of stvDistrict.candidates) {
                totalVote += candidate.stv.vote;
            }
            const quota = floor(totalVote / (stvDistrict.seats + 1), 9) + 10E-9;

            //Ref B.2.c Find winners
            let newWinners = [];
            for (const candidate of hopeful.values()) {
                if (candidate.stv.vote >= quota) {
                    candidate.stv.state = ELECTED;
                    candidate.stv.winnerOrder = winnerOrder++;
                    winners.push(candidate);
                    newWinners.push(candidate);
                    hopeful.delete(candidate);
                }
            }

            //Ref B.2.d Calculate total surplus
            let totalSurplus = 0;
            for (const winner of winners) {
                const surplus = winner.stv.vote - quota;
                if (surplus > 0) {
                    totalSurplus += surplus;
                }
            }

            //Ref B.2.e Test for Iteration finished
            if (newWinners.length > 0) {
                fnReport({heading: `Round ${roundNum}-${iterationNum} - Elected: ${newWinners.map(w =>
                    `<span style="color: ${w.color};" title="${w.partyName}">⬤</span>${w.surname}`
                ).join(', ')}`, quota, candidates: [...winners, ...hopeful.values()]});
                return 2; //break, continue at B.1
            } else if (totalSurplus < omega || totalSurplus >= prevSurplus) {
                return false; //stop iterating
            }
            prevSurplus = totalSurplus;

            //Ref B.2.f Update keep factors
            for (const elected of winners) {
                elected.stv.kf = ceil(ceil(elected.stv.kf * quota, 9) / elected.stv.vote, 9);
            }

            //Continue at B.2.a
            return true;
        }
        let iterationResult = false;
        while(iterationResult = fnIterate()) {
            if (iterationResult === 2) {
                return true; //continue at B.1 after winner declared
            }
        }

        //Ref B.3 Defeat low candidate
        let lowest = null;
        for (const candidate of hopeful.values()) {
            if (lowest === null || candidate.stv.vote < lowest.stv.vote) {
                lowest = candidate;
            }
            //TODO: use equality for lowest includes surplus, tiebreaks
        }
        lowest.stv.state = DEFEATED;
        lowest.stv.kf = 0;
        hopeful.delete(lowest);
        fnReport({
            heading: `Round ${roundNum} - Defeated: <span style="color: ${lowest.color};" title="${lowest.partyName}">⬤</span>${lowest.surname}`,
            candidates: [lowest, ...winners, ...hopeful.values()]
        });

        //Ref B.4 Continue (B.1)
        return true;
    }
    while (fnRound());

    //Ref C Count Complete
    if (winners.length < stvDistrict.seats) {
        //Ref C.1 Elect remaining
        for (const candidate of hopeful.values()) {
            candidate.stv.state = ELECTED;
            candidate.stv.winnerOrder = winnerOrder;
            winners.push(candidate);
        }
    } else {
        //Ref C.2 Defeat remaining
        for (const candidate of hopeful.values()) {
            candidate.stv.state = DEFEATED;
        }
    }
    //Count exhausted ballots
    let totalExhausted = 0;
    for (const ballot of ballots) {
        const isExhausted = ballot.candidates.every(c => c.stv.state === DEFEATED);
        if (isExhausted) totalExhausted += 1;
    }

    //Report
    fnReport({heading: 'Final Winners', exhausted: totalExhausted, candidates: winners});
}

function ceil(value, decimalPlaces = 0) {
    return Number(Math.ceil(value + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
}

function floor(value, decimalPlaces = 0) {
    return Number(Math.floor(value + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
}


function withoutIndex(array, i) {
    const arrayWithoutIndex = [
        ...array.slice(0, i),
        ...array.slice(i + 1, array.length)
    ];
    return arrayWithoutIndex;
}

function* getBallots(unordered, ordered = [], orderedWeight = 0) {
    if (unordered.length === 0) {
        yield { ordered: ordered, weight: orderedWeight };
        
    } else {

        let totalWeight = 0;
        const itemWeights = [];
        for (let i = 0; i < unordered.length; i += 1) {
            const item = unordered[i];
            //weight candidate by how popular they were in home riding
            //todo: favor adjacent districts
            const itemWeight = itemWeights[i] = item.votePct;
            totalWeight += itemWeight;
        }
        
        for (let i = 0; i < unordered.length; i += 1) {
            const item = unordered[i];
            if (orderedWeight === 0) {
                //top level; get % weights of each branch beginning with this item
                let ballots = getBallots(
                    withoutIndex(unordered, i),
                    [item],
                    1
                );
                ballots = [...ballots];
                let unassignedBallots = item.votes;
                let defaultBallot = { weight: 0 };
                for (const ballot of ballots) {
                    ballot.count = Math.floor(item.votes * ballot.weight);
                    unassignedBallots -= ballot.count;
                    if (ballot.weight > defaultBallot.weight) {
                        defaultBallot = ballot;
                    }
                }
                if (unassignedBallots < 0 || unassignedBallots >= ballots.length) {
                    throw new Error('Ballot calculation error');
                }
                if (unassignedBallots > 0) {
                    defaultBallot.count += unassignedBallots;
                }
                yield* ballots;

            } else {
                //recursing call, continue
                yield* getBallots(
                    withoutIndex(unordered, i),
                    [...ordered, item],
                    orderedWeight * itemWeights[i] / totalWeight
                )
            }
        }
    }
}
