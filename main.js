/**
 * Created by schneg on 8/29/14.
 */
var BostonBusMap = (function() {
    var bostonLat = 42.3581;
    var bostonLon = -71.0636;
    var bostonPosition = ol.proj.transform([bostonLon, bostonLat], 'EPSG:4326', 'EPSG:3857');

    //var apikey = "wX9NwuHnZU2ToO7GmGR9uw";
    var apikey = "gmozilm-CkSCh8CE53wvsw";

    var view = new ol.View({
        center: bostonPosition,
        zoom: 13
    });
    var map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.MapQuest({layer: 'osm'})
            })
        ],
        view: view
    });
    $(function() {

        var update_interval_id = null;
        map.getView().on('change:center', function () {
            if (update_interval_id !== null) {
                clearTimeout(update_interval_id);
            }
            update_interval_id = setTimeout(function () {
                update();
            }, 200);
        });

        // display popup on click
        var handler = function (evt) {
            var stop = this.stop;

            $.ajax({url: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop',
                data: {
                    'api_key': apikey,
                    'format': 'json',
                    'stop': stop.stop_id
                }, success: function (result) {
                    var predictions = _.map(result.mode, function (mode) {
                        return _.map(mode.route, function (route) {
                            if (!route) return [];
                            return _.map(route.direction, function (direction) {
                                return _.map(direction.trip, function (trip) {
                                    return {
                                        route: route.route_name,
                                        trip: trip.trip_headsign,
                                        minutes: parseInt(trip.pre_away / 60)
                                    };
                                });
                            });
                        });
                    });

                    predictions = _.flatten(predictions);
                    predictions = _.sortBy(predictions, function (prediction) {
                        return prediction.minutes;
                    });
                    predictions = _.take(predictions, 3);

                    var html_pieces = _.map(predictions, function (prediction) {
                        html = "Route <b>" + prediction.route + "</b><br />";
                        html += prediction.trip + "<br />";
                        var minutes = prediction.minutes;
                        if (minutes >= 1) {
                            html += "Arriving in <b>" + minutes + "</b> minutes";
                        }
                        else {
                            html += "Arriving <b>now</b>!";
                        }

                        return html;
                    });

                    var html = html_pieces.join("<br /><br />");
                    makePopup(stop, html);

                },
                error: function () {
                    makePopup(stop, '');
                }});
        };

        map.on('click', function() {
            clearPopup();
        });

        var popupElement = document.getElementById('popup_info');
        var popup = new ol.Overlay({
            element: popupElement,
            positioning: 'bottom-center',
            stopEvent: false
        });
        map.addOverlay(popup);

        var markerEl = document.getElementById('geolocation_marker');
        var marker = new ol.Overlay({
            positioning: 'center-center',
            element: markerEl,
            stopEvent: false
        });
        map.addOverlay(marker);

        var geolocation = new ol.Geolocation({
            projection: view.getProjection(),
            tracking: true
        });
        geolocation.on('change:position', function() {
            view.setCenter(geolocation.getPosition());
            view.setResolution(2.388657133911758);

            geolocation.setTracking(false);
        });

        var geolocateBtn = document.getElementById('geolocate');

        geolocateBtn.addEventListener('click', function() {
            geolocation.setTracking(true); // Start position tracking

            map.on('postcompose', render);
            map.render();
        }, false);

        var overlays = [];

        var selected = null;

        var clearOverlays = function() {
            _.each(overlays, function(overlay) {
                map.removeOverlay(overlay);
            });
            overlays = [];
        };

        var makePopup = function(stop, text) {
            var position = ol.proj.transform([parseFloat(stop['stop_lon']), parseFloat(stop['stop_lat'])], 'EPSG:4326', 'EPSG:3857');
            $(popupElement).show();
            popup.setPosition(position);
            
            $(popupElement).html("<b>" + stop.stop_name + "</b><br /><br />" + text);
        };

        var clearPopup = function() {
            $(popupElement).hide();
        };

        var addStop = function(stop) {
            var position = ol.proj.transform([parseFloat(stop['stop_lon']), parseFloat(stop['stop_lat'])], 'EPSG:4326', 'EPSG:3857');
            var busstop = document.getElementById('busstop').cloneNode(true);
            busstop.stop = stop;

            var busOverlay = new ol.Overlay({
                positioning: 'bottom-center',
                element: busstop,
                stopEvent: true
            });
            busstop.onclick = handler;
            map.addOverlay(busOverlay);
            busOverlay.setPosition(position);
            overlays.push(busOverlay);
        };

        var update = function() {
            var center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');

            $.get('http://realtime.mbta.com/developer/api/v2/stopsbylocation',
                {'api_key': apikey,
                    'format': 'json',
                    'lat': center[1],
                    'lon': center[0]}, function (data) {
                    $(popupElement).popover('destroy');
                    clearOverlays();
                    var stops = _.sortBy(data.stop, function(stop) { return parseFloat(stop.stop_lat); });
                    stops = _.filter(stops, function(stop) { return !stop.parent_station; });

                    _.each(stops, addStop);
                });
        };

        update();
    });

    return {map:map};
})();
