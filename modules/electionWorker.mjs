import { ElectWigm } from "./wigm.mjs";
import { generateBallots } from './ballotMaker.mjs';

addEventListener('message', e => {
    debugger;
    postMessage({progress: 'tesst'});
    console.log(e.data);
    const { method, stvDistrict } = e.data;

    if (method === 'wigm') {

        postMessage({progress: 'Generating Ballots'});
        const ballots = generateBallots(stvDistrict);

        postMessage({progress: 'Initiating Count'});
        const counter = new ElectWigm(stvDistrict, ballots, postMessage);
        counter.count();

    } else {
        console.warn('Unsupported counting method');
    }
});
