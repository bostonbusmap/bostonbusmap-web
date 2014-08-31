/**
 * Created by schneg on 8/29/14.
 */
(function() {
    var bostonLat = 42.3581;
    var bostonLon = -71.0636;
    var bostonPosition = ol.proj.transform([bostonLon, bostonLat], 'EPSG:4326', 'EPSG:3857');

    //var apikey = "wX9NwuHnZU2ToO7GmGR9uw";
    var apikey = "gmozilm-CkSCh8CE53wvsw";

    $(function() {
        var iconStyle = new ol.style.Style({
            image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                anchor: [0.5, 46],
                anchorXUnits: 'fraction',
                anchorYUnits: 'pixels',
                opacity: 1,
                src: 'data/busstop.png'
            }))
        });


        var vectorSource = new ol.source.Vector();

        var vectorLayer = new ol.layer.Vector({
            source: vectorSource
        });

        var view = new ol.View({
            center: bostonPosition,
            zoom: 13
        });
        var map = new ol.Map({
            target: 'map',
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.MapQuest({layer: 'osm'})
                }),
                vectorLayer
            ],
            view: view
        });

        var update_interval_id = null;
        map.getView().on('change:center', function() {
            if (update_interval_id !== null) {
                clearTimeout(update_interval_id);
            }
            update_interval_id = setTimeout(function() {
                update();
            }, 200);
        });

        // display popup on click
        var handler = function(evt) {
            var feature = map.forEachFeatureAtPixel(evt.pixel,
                function(feature, layer) {
                    return feature;
                });
            if (feature) {
                console.log(element);
                var geometry = feature.getGeometry();
                var coord = geometry.getCoordinates();

                $.ajax({url: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop',
                    data: {
                        'api_key': apikey,
                        'format': 'json',
                        'stop': feature.get('id')
                    }, success: function(result) {
                        var html = "";

                        var predictions = _.map(result.mode, function(mode) {
                            return _.map(mode.route, function(route) {
                                if (!route) return [];
                                return _.map(route.direction, function(direction) {
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
                        predictions = _.sortBy(predictions, function(prediction) { return prediction.minutes; });
                        predictions = _.take(predictions, 3);
                        console.log(predictions);
                        var html_pieces = _.map(predictions, function(prediction) {
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

                        popup.setPosition(coord);
                        $(element).popover('destroy');
                        $(element).popover({
                            'placement': 'top',
                            'html': true,
                            'content': feature.get('name') + "<br />" + html
                        });
                        $(element).popover('show');
                    },
                    error: function() {
                        popup.setPosition(coord);
                        $(element).popover('destroy');
                        $(element).popover({
                            'placement': 'top',
                            'html': true,
                            'content': feature.get('name')
                        });
                        $(element).popover('show');
                    }});

            } else {
                $(element).popover('destroy');
            }
        };
        map.on('click', handler);

        var element = document.getElementById('popup');
        var popup = new ol.Overlay({
            element: element,
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

        var update = function() {
            var center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');

            $.get('http://realtime.mbta.com/developer/api/v2/stopsbylocation',
                {'api_key': apikey,
                    'format': 'json',
                    'lat': center[1],
                    'lon': center[0]}, function (data) {
                    $(element).popover('destroy');
                    vectorSource.clear();
                    var features = _.map(data.stop, function (stop) {
                        var position = ol.proj.transform([parseFloat(stop['stop_lon']), parseFloat(stop['stop_lat'])], 'EPSG:4326', 'EPSG:3857');
                        var iconFeature = new ol.Feature({
                            geometry: new ol.geom.Point(position),
                            name: stop['stop_name'],
                            id: stop['stop_id']
                        });
                        iconFeature.setStyle(iconStyle);

                        return iconFeature;
                    });
                    vectorSource.addFeatures(features);
                });
        };

        update();
    });
})();
