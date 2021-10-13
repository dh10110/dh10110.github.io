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
                count: Math.floor(ballotDef.ordered[0].votes * ballotDef.weight),
                countExact: ballotDef.ordered[0].votes * ballotDef.weight
            };
            ballots.push(ballot);
        }
    }
    
    return ballots;
}

function withoutIndex(array, i) {
    console.log(array);
    const arrayWithoutIndex = [
        ...array.slice(0, i),
        ...array.slice(i + 1)
    ];
    console.log(array);
    return arrayWithoutIndex;
}

function* getBallots(unordered, ordered = [], orderedWeight = 1) {
    if (!unordered || !unordered[0]) {
        console.log(ordered);
    } else {
        console.log('>'.repeat(ordered.length) + unordered[0].surname);
    }

    if (unordered.length === 1) {
        yield { ordered: [...ordered, ...unordered], weight: orderedWeight };
    } else if (unordered.length === 0) {

    } else {

        let totalWeight = 0;
        const itemWeights = [];
        for (let i = 0; i <= unordered.length; i += 1) {
            const item = unordered[i];
            const itemWeight = itemWeights[i] = 1; //todo: by party, and favor adjacent districts
            totalWeight += itemWeight;
        }
        
        for (let i = 0; i <= unordered.length; i += 1) {
            const item = unordered[i];
            yield* getBallots(
                [],//withoutIndex(unordered, i),
                [...ordered, item],
                orderedWeight * itemWeights[i] / totalWeight
            );
        }
    }
}
