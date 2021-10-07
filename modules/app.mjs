import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

function start() {
    $('#status').text('Fetching Data');

    data.getDistricts().then(ridings => {
        const text = JSON.stringify(ridings, null, 4);
        $('#data').text(text);
        $('#status').text('Ready');
    });
}

$(start);
