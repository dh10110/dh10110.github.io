import $ from './lib/jquery.mjs';
import * as data from './data.mjs';

function start() {
    $('#status').text('Fetching Data');

    data.getDistricts().then(text => {
        $('#data').text(text);
        $('#status').text('Ready');
    });
}

$(start);
