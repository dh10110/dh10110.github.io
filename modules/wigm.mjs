import { floor } from './mathUtil.mjs';
import { concat } from './mapUtil.mjs';
import { first, orderBy, desc } from './arrayUtil.mjs';
import { StvCandidate, stvCandidateState } from './classes.mjs';
import { map } from './arrayUtil.mjs';

function candidateToPost(stvCandidate) {
    const arr = [stvCandidate.candidateId, stvCandidate.state, stvCandidate.vote];
    return arr;
}

function candidatesToPost(...candidateSets) {
    const arr = [];
    for (const candidateSet of candidateSets) {
        for (const candidate of candidateSet.values()) {
            arr.push([
                candidate.candidateId,
                candidate.state.code,
                candidate.vote
            ]);
        }
    }
    return arr;
}

export class ElectWigm {
    constructor(stvDistrict, ballots, postMessage) {
        //const [name, seats, candidates] = stvDistrict;

        this.districtName = stvDistrict.districtName;
        this.seats = stvDistrict.seats;
        /*this.candidates = candidates.map(c => {
            const [candidateId] = c;
            return new StvCandidate({ candidateId, vote: 0 });
        });*/
        this.candidates = stvDistrict.candidates;
        this.precision = 4;
        this.ballots = ballots;
        
        this.defeatSureLosers = false; //TODO

        this.hopeful = new Set();
        this.pending = new Set();
        this.elected = new Set();
        this.defeated = new Set();

        this.roundNum = 0;
        this.exhaustedBallots = 0;

        this.postMessage = (message) => {
            if (!postMessage) return;
            postMessage(message);
        }
    }

    count() {
        const startTime = performance.now();

        //https://prfound.org/resources/reference/reference-wigm-rule/
        //Ref A - Initialize Election
        let shouldContinue = this.initialize();
        //Ref B - Round
        while (shouldContinue) {
            this.roundNum += 1;
            shouldContinue = this.round();
        }
        //Ref C - Finish Count
        this.finishCount();

        //Report
        //this.postMessage({progress: null, heading: 'Final Winners', final: true, exhausted: this.exhaustedBallots, candidates: [...this.elected.values()] });
        this.postMessage({ p: null, f: true, x: this.exhaustedBallots, c: candidatesToPost(this.elected) });

        const endTime = performance.now();
        console.log(`Runtime for 'wigm' ${this.districtName} - ${(endTime - startTime).toFixed(0)}ms`);
    }

    //Ref A - Initialize Election
    initialize() {
        //Ref A.1 - Set the Quota
        this.quota = this.trunc(this.ballots.length / (this.seats + 1)) + 10e-4;
        //Ref A.2 - Set candidates to HOPEFUL
        for (const candidate of this.candidates) {
            candidate.state = stvCandidateState.HOPEFUL;
            this.hopeful.add(candidate);
        }
        //Ref A.3 - Test count complete (D.3)
        if (this.testCountComplete()) return false;
        //Ref A.4 - Set ballot weight and assign to candidate
        //+ Ref A.5 - Set candidate vote
        for (const ballot of this.ballots) {
            ballot.weight = 1;
            ballot.candidates[0].assignedBallots.add(ballot);
            ballot.candidates[0].vote += 1;
        }
        //show initial count
        this.postMessage({
            h: 'Initial Count',
            q: this.quota,
            c: candidatesToPost(this.hopeful)
        });

        //Continue
        return true;
    }

    //Ref B - Round
    round() {
        this.postMessage({p: `Round ${this.roundNum}`});

        //Ref B.1 - Elect Winners
        for (const candidate of this.hopeful) {
            if (candidate.vote >= this.quota) {
                this.hopeful.delete(candidate);
                candidate.state == stvCandidateState.PENDING;
                candidate.surplus = candidate.vote - this.quota;
                this.pending.add(candidate);
            }
        }
        if (this.testCountComplete()) return false; //D.3
        //Ref B.2 (optional) - Defeat sure losers
        if (this.defeatSureLosers) {
            //TODO
        }
        //Ref B.3 - Transfer high surplus
        const highCandidate = first(this.pending, desc(c => c.surplus), c => c.candidateId)
        if (highCandidate) {
            this.pending.delete(highCandidate);
            highCandidate.state = stvCandidateState.ELECTED;
            this.elected.add(highCandidate);
            highCandidate.winnerOrder = this.elected.size;
            for (const ballot of highCandidate.assignedBallots.values()) {
                ballot.weight = this.trunc(ballot.weight * highCandidate.surplus / highCandidate.vote);
            }
            const hiChanges = this.transferBallots(highCandidate);
            highCandidate.vote = this.quota;
            //this.postMessage changes
            this.postMessage({
                h: `Round ${this.roundNum} - Elected`,
                a: [highCandidate.candidateId],
                x: this.exhaustedBallots,
                c: candidatesToPost(hiChanges)
            });

            return true; //continue at B.1
        }
        //Ref B.4 - Defeat low candidiate
        const lowCandidate = first(this.hopeful, c => c.vote, c => c.candidateId);
        if (lowCandidate == null) {
            console.error('No low candidate');
        }
        this.hopeful.delete(lowCandidate);
        lowCandidate.state = stvCandidateState.DEFEATED;
        this.defeated.add(lowCandidate);
        lowCandidate.vote = 0;

        const countComplete = this.testCountComplete(); //D.3
        let lowChanges = new Set();
        if (!countComplete) {
            lowChanges = this.transferBallots(lowCandidate);
        }
        //this.postMessage changes
        this.postMessage({
            h: `Round ${this.roundNum} - Defeated`,
            a: [lowCandidate.candidateId],
            x: this.exhaustedBallots,
            c: candidatesToPost(lowChanges)
        });
        
        if (countComplete) return false; //Continue at C

        return true; //Continue at B.1
    }

    //Ref C - Finish Count
    finishCount() {
        //Elect all pending candidates
        const electedPending = new Set(this.pending);
        for (const candidate of this.pending) {
            candidate.state = stvCandidateState.ELECTED;
            this.elected.add(candidate);
            candidate.winnerOrder = this.elected.size;
        }
        this.pending.clear();
        //pm changes
        if (electedPending.size > 0) {
            this.postMessage({
               h: 'Finish Count - Elect Pending',
               a: map(electedPending, c => c.candidateId),
               c: candidatesToPost(electedPending)
            });
        }
        //All seats filled?
        const remainingHopeful = new Set(this.hopeful);
        const isFilled = this.elected.size + this.pending.size === this.seats;
        let lastAct = isFilled ? 'Defeated' : 'Elected';
        if (isFilled) {
            //defeat all remaining hopeful candidates
            for (const candidate of this.hopeful) {
                candidate.state = stvCandidateState.DEFEATED;
                this.defeated.add(candidate);
            }
        } else {
            //Elect all remaining hopeful candidate
            for (const candidate of this.hopeful) {
                candidate.state = stvCandidateState.ELECTED;
                this.elected.add(candidate);
                candidate.winnerOrder = this.elected.size;
            }
        }
        this.hopeful.clear();
        this.postMessage({
            h: `Finish Count - ${lastAct} Hopeful`,
            a: map(remainingHopeful, c => c.candidateId),
            c: candidatesToPost(remainingHopeful)
        })
    }

    //Ref D.2
    transferBallots(candidate) {
        const changed = new Set();
        changed.add(candidate);
        for (const ballot of candidate.assignedBallots.values()) {
            const newCandidate = nextCandidate(ballot.candidates, candidate);
            candidate.assignedBallots.delete(ballot);
            if (newCandidate && ballot.weight) {
                newCandidate.assignedBallots.add(ballot);
                newCandidate.vote += ballot.weight;
                changed.add(newCandidate);
            } else {
                this.exhaustedBallots += 1;
            }
        }
        return changed;
    }

    //Ref D.3
    testCountComplete() {
        //complete if all seats filled, or remaining candidate will fill them
        return this.elected.size + this.pending.size === this.seats ||
            this.elected.size + this.pending.size + this.hopeful.size <= this.seats;
    }

    //Ref D.4
    trunc(number) {
        return floor(number, this.precision);
    }

}

function nextCandidate(candidates, curCandidate) {
    for (const candidate of candidates) {
        if (candidate !== curCandidate && candidate.state === stvCandidateState.HOPEFUL) {
            return candidate;
        }
    }
    return null; //exhausted ballot
}
