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
        for (const ballotDef of ballotDefs) {
            const ballot = {
                ordered: ballotDef.ordered,
                weight: ballotDef.weight,
                count: Math.floor(ballotDef.ordered[0].votes * ballotDef.weight),
                countExact: ballotDef.ordered[0].votes * ballotDef.weight
            };
            ballots.push(ballot);
        }
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
    if (unordered.length === 1) {
        yield { ordered: [...ordered, ...unordered], weight: orderedWeight || 1 };
        
    } else if (unordered.length === 0) {
        console.error('how did we get here?');
        debugger;

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
            yield* getBallots(
                withoutIndex(unordered, i),
                [...ordered, item],
                orderedWeight ? orderedWeight * itemWeights[i] / totalWeight : 1
            );
        }
    }
}
