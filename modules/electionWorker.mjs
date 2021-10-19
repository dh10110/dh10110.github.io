import { ElectWigm } from "./wigm.mjs";
import { generateBallots } from './ballotMaker.mjs';

debugger;

addEventListener('message', e => {
    debugger;
    postMessage({progress: 'tesst'});
    console.log(e.data);
    const { method, stvDistrict } = e.data;

    if (!method) throw new Error('"method" is required');
    if (!stvDistrict) throw new Error('"stvDistrict is required');

    if (method === 'wigm') {

        postMessage({progress: 'Generating Ballots'});
        const ballots = generateBallots(stvDistrict);

        postMessage({progress: 'Initiating Count'});
        const counter = new ElectWigm(stvDistrict, ballots, postMessage);
        counter.count();

    } else {
        throw new Error('Unsupported counting method');
    }
});
