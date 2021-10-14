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

    //TODO: compute weights

    const ballots = [];
    for (const [key, party] of partyMap) {
        let maxItem = { weight: 0, ballot: null };
        const ballotDefs = getBallots(party.candidates);
        /*for (const ballotDef of ballotDefs) {
            const ballot = {
                ordered: ballotDef.ordered,
                weight: ballotDef.weight,
                count: Math.floor(ballotDef.ordered[0].votes * ballotDef.weight),
                countExact: ballotDef.ordered[0].votes * ballotDef.weight
            };
            ballots.push(ballot);
        }*/
        ballots.push(...ballotDefs);
    }
    
    return ballots;
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
                if (unassignedBallots < 0 || unassignedBallots >= ballot.ordered.length) {
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

            yield* getBallots(
                withoutIndex(unordered, i),
                [...ordered, item],
                orderedWeight ? orderedWeight * itemWeights[i] / totalWeight : 1
            );
        }
    }
}
