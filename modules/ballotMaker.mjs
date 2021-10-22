import { CandidateGroup } from './classes.mjs';
import { getOrAdd } from './mapUtil.mjs';
import { withoutIndex } from './arrayUtil.mjs';

export function generateBallots(stvDistrict) {
    //Group all the candidates by party
    const partyMap = new Map();
    for (const candidate of stvDistrict.candidates) {
        const key = candidate.partyName === 'Independent' ? 'Ind: ' + candidate.candidateId : candidate.partyName;
        const partyGroup = getOrAdd(partyMap, key, () => new CandidateGroup({
            groupName: candidate.partyName,
        }));
        partyGroup.addCandidate(candidate);
    }

    const ballots = [];
    for (const [key, party] of partyMap) {
        const ballotDefs = getBallotDefs(party.candidates);
        for (const ballotDef of ballotDefs) {
            for (let i = 0; i < ballotDef.count; i += 1) {
                ballots.push({ candidates: ballotDef.ordered });
            }
        }
    }
    
    return ballots;
}

function* getBallotDefs(unordered, ordered = [], orderedWeight = 0) {
    if (unordered.length === 0) {
        yield { ordered: ordered, weight: orderedWeight };
        
    } else {

        let totalWeight = 0;
        const itemWeights = [];
        for (let i = 0; i < unordered.length; i += 1) {
            const item = unordered[i];
            //weight candidate by how popular they were in home riding
            //TODO: favor adjacent districts
            const itemWeight = itemWeights[i] = item.originalVotePct;
            totalWeight += itemWeight;
        }
        
        for (let i = 0; i < unordered.length; i += 1) {
            const item = unordered[i];
            if (orderedWeight === 0) {
                //top level; get % weights of each branch beginning with this item
                let ballotDefs = getBallotDefs(
                    withoutIndex(unordered, i),
                    [item],
                    1
                );
                ballotDefs = [...ballotDefs];
                let unassignedBallotDefs = item.votes;
                let defaultBallotDef = { weight: 0 };
                for (const ballotDef of ballotDefs) {
                    ballotDef.count = Math.floor(item.originalVotes * ballotDef.weight);
                    unassignedBallotDefs -= ballotDef.count;
                    if (ballotDef.weight > defaultBallotDef.weight) {
                        defaultBallotDef = ballotDef;
                    }
                }
                if (unassignedBallotDefs < 0 || unassignedBallotDefs >= ballotDefs.length) {
                    throw new Error('Ballot calculation error');
                }
                if (unassignedBallotDefs > 0) {
                    defaultBallotDef.count += unassignedBallotDefs;
                }
                yield* ballotDefs;

            } else {
                //recursing call, continue
                yield* getBallotDefs(
                    withoutIndex(unordered, i),
                    [...ordered, item],
                    orderedWeight * itemWeights[i] / totalWeight
                )
            }
        }
    }
}
