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
    
    const winners = [];
    
    //Ref A
    const omega = 10E-6;

    for (const candidate of stvDistrict.candidates) {
        candidate.stv = { state: HOPEFUL, kf: 1, vote: 0 };
    }

    const ballotDefs = generateBallots(stvDistrict);
    const ballots = [];
    for (const ballotDef of ballotDefs) {
        for (let i = 0; i < ballotDef.count; i += 1) {
            ballots.push({ candidates: ballotDef.ordered });
        }
    }

    //Ref B
    //Ref B.1 Test if Count Complete

    //Ref B.2 Iterate
    const fnIterate = function () {
        //Ref B.2.a Distribute
        for (const ballot of ballots) {
            ballot.weight = 1;
            for (const candidate of ballot.candidates) {
                voteDelta = ceil(ballot.weight * candidate.kf, 9);
                candidate.stv.vote += voteDelta;
                ballot.weight -= voteDelta;
                if (ballot.weight <= 0) break;
            }
        }
        //Ref B.2.b Update Quota
        let totalVote = 0;
        for (const candidate in stvDistrict.candidates) {
            totalVote += candidate.stv.vote;
        }
        const quota = floor(totalVote / (stvDistrict.seats + 1), 9) + 10E-9;
        //Ref B.2.c Find winners
        //Ref B.2.d Calculate total surplus
        //Ref B.2.e Test for Iteration finished
        //Ref B.2.f Update keep factors

        fnReport({header: 'Initial Count', candidates: stvDistrict.candidates})
        return false; //temp: stop iterating right away
    }
    while(fnIterate());
    //Ref B.3 Defeat low candidate
    //Ref B.4 Continue (B.1)

    //Ref C Elect or Defeat remaining

}

function ceil(value, decimalPlaces = 0) {
    //const factor = Math.pow(10, decimalPlaces);
    //return Math.ceil(value * factor) / factor;
    return Number(Math.ceil(value + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
}

function floor(value, decimalPlaces = 0) {
    //const factor = Math.pow(10, decimalPlaces);
    //return Math.floor(value * factor) / factor;
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
