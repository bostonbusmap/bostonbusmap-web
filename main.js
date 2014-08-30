/**
 * Created by schneg on 8/29/14.
 */
(function() {
    var bostonLat = 42.3581;
    var bostonLon = -71.0636;
    var bostonPosition = ol.proj.transform([bostonLon, bostonLat], 'EPSG:4326', 'EPSG:3857');

    //var apikey = "wX9NwuHnZU2ToO7GmGR9uw";
    var apikey = "gmozilm-CkSCh8CE53wvsw";

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

    var map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.MapQuest({layer: 'osm'})
            }),
            vectorLayer
        ],
        view: new ol.View({
            center: bostonPosition,
            zoom: 13
        })
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

    var element = document.getElementById('popup');
    var popup = new ol.Overlay({
        element: element,
        positioning: 'bottom-center',
        stopEvent: false
    });
    map.addOverlay(popup);

    // display popup on click
    map.on('click', function(evt) {
        var feature = map.forEachFeatureAtPixel(evt.pixel,
            function(feature, layer) {
                return feature;
            });
        if (feature) {
            var geometry = feature.getGeometry();
            var coord = geometry.getCoordinates();

            $.ajax({url: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop',
            data: {
                'api_key': apikey,
                'format': 'json',
                'stop': feature.get('id')
            }, success: function(prediction) {
                var html = "";

                _.each(prediction.mode, function(mode) {
                    _.each(mode.route, function(route) {
                        _.each(route.direction, function(direction) {
                            if (direction.trip) {
                                _.each(direction.trip, function(trip) {
                                    html += "Route <b>" + route.route_name + "</b><br />";
                                    html += trip.trip_headsign + "<br />";
                                    var minutes = parseInt(trip.pre_away / 60);
                                    if (minutes >= 1) {
                                        html += "Arriving in <b>" + minutes + "</b> minutes";
                                    }
                                    else {
                                        html += "Arriving <b>now</b>!";
                                    }

                                    html += "<br/><br />";

                                });
                            }
                        });
                    });
                });

                popup.setPosition(coord);
                $(element).popover({
                    'placement': 'top',
                    'html': true,
                    'content': feature.get('name') + "<br />" + html
                });
                $(element).popover('show');
            },
            error: function() {
                popup.setPosition(coord);
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
    });

    var update = function() {
        var center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
        console.log(center);
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
})();
