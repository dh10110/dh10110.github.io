import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

function start() {
    $('#status').text('Fetching Data');

    const text = data.getDistricts().then(() => {
        $('#data').text(text);
        $('#status').text('Ready');
    });
}

$(start);
