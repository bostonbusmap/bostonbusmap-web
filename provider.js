/**
 * Created by schneg on 9/6/14.
 */
var Provider = (function() {
    "use strict";
    //var apikey = "wX9NwuHnZU2ToO7GmGR9uw";
    var apikey = "gmozilm-CkSCh8CE53wvsw";

    var bostonLat = 42.3581;
    var bostonLon = -71.0636;
    var bostonPosition = [bostonLon, bostonLat];

    var getStopsByLocation = function(parameters, callback) {
        return $.get('http://realtime.mbta.com/developer/api/v2/stopsbylocation',
            {'api_key': apikey,
                'format': 'json',
                'lat': parameters.lat,
                'lon': parameters.lon}, function (data) {
                return callback(data.stop);
            });
    };

    var getPredictionsByStop = function(parameters, success, error) {
        return $.ajax({url: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop',
            data: {
                'api_key' : apikey,
                stop: parameters.stop_id,
                format: 'json'
            }, success: function(data) {
                return success(data);
            }, error: function(data) {
                return error(data);
            }});
    }

    return {
        getStopsByLocation: getStopsByLocation,
        getPredictionsForStop: getPredictionsByStop,
        startingLocation: bostonPosition
    };
})();