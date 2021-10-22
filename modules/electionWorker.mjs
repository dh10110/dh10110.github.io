import { ElectWigm } from "./wigm.mjs";
import { generateBallots } from './ballotMaker.mjs';

addEventListener('message', e => {
    const { b, c, d } = e.data;

    postMessage(['Generating Ballots']);
    const ballots = getBallotGenerator(b)(d);

    postMessage(['Initiating Count']);
    const counter = getElectionCounter(c, d, ballots);
    counter.count();
});

function getBallotGenerator(ballotMethod) {
    if (ballotMethod === 'party-vote') return generateBallots;
    console.error(`Ballot generator '${ballotMethod}' not implemented.`);
}

function getElectionCounter(countMethod, district, ballots) {
    if (countMethod === 'wigm') return new ElectWigm(district, ballots, postMessage);
    console.error(`Counting method '${countMethod}' not implemented.`);
}
