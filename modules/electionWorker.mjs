import { ElectWigm } from "./wigm.mjs";
import { generateBallots } from './ballotMaker.mjs';
import { StvDistrict, StvCandidate } from "./classes.mjs";

export const ver = 1.4;

addEventListener('message', e => {
    const { b, c, d } = e.data;

    const stvDistrict = deserializeDistrict(d);

    postMessage(['Generating Ballots']);
    const ballots = getBallotGenerator(b)(stvDistrict);

    postMessage(['Initiating Count']);
    const counter = getElectionCounter(c, stvDistrict, ballots);
    counter.count();
});

function deserializeDistrict(d) {
    const [districtName, seats, compressedCandidates] = d;
    const stvDistrict = new StvDistrict({ districtName });
    stvDistrict.seats = seats;

    for (const compressedCandidate of compressedCandidates) {
        const [candidateId, partyName, originalVotes, originalVotePct, originalDistrict] = compressedCandidate;
        stvDistrict.addCandidate(new StvCandidate({ candidateId, partyName, originalVotes, originalVotePct, originalDistrict }));
    }
    
    return stvDistrict;
}

function getBallotGenerator(ballotMethod) {
    if (ballotMethod === 'party-vote') return generateBallots;
    console.error(`Ballot generator '${ballotMethod}' not implemented.`);
}

function getElectionCounter(countMethod, district, ballots) {
    if (countMethod === 'wigm') return new ElectWigm(district, ballots, postMessage);
    console.error(`Counting method '${countMethod}' not implemented.`);
}
