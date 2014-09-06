/**
 * Created by schneg on 8/29/14.
 */
var BostonBusMap = (function() {
    var bostonLat = 42.3581;
    var bostonLon = -71.0636;
    var bostonPosition = [bostonLon, bostonLat];

    //var apikey = "wX9NwuHnZU2ToO7GmGR9uw";
    var apikey = "gmozilm-CkSCh8CE53wvsw";

    var startingPosition = bostonPosition;
    if (window.localStorage.position) {
        startingPosition = JSON.parse(window.localStorage.position);
    }

    var startingZoom = 13;
    if (window.localStorage.zoom) {
        startingZoom = JSON.parse(window.localStorage.zoom);
    }

    var view = new ol.View({
        center: ol.proj.transform(startingPosition, 'EPSG:4326', 'EPSG:3857'),
        zoom: startingZoom
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

    var favorites = {};
    if (window.localStorage.favorites) {
        favorites = JSON.parse(window.localStorage.favorites);
    }

    console.log(favorites);
    console.log(_.keys(favorites));

    var toggleFavorite = function(stop_id) {
        if (favorites[stop_id]) {
            delete favorites[stop_id];
            $("option[value=" + JSON.stringify(stop_id) + "]").remove();
        }
        else {
            favorites[stop_id] = true;
            $("select").append($("<option />").val(stop_id).html(stop_id));
        }
        window.localStorage.favorites = JSON.stringify(favorites);


    };

    var full_star_url = './data/full_star.png';
    var empty_star_url = './data/empty_star.png';
    var updateStar = function(element, stop_id) {
        if (favorites[stop_id]) {
            $(element).prop('src', full_star_url);
        }
        else {
            $(element).prop('src', empty_star_url);
        }
    };

    var showAlert = function(alerts) {
        console.log(alerts);
        var ul = "<ul>";
        _.each(alerts, function(alert) {
            ul += "<li>" + alert.header_text + "</li>";
        });
        ul += "</ul>";
        $("#dialog").html(ul);
        $("#dialog").dialog();
    };

    $(function() {

        var update_interval_id = null;
        map.getView().on('change:center', function () {
            if (update_interval_id !== null) {
                clearTimeout(update_interval_id);
            }
            update_interval_id = setTimeout(function () {
                update();
            }, 200);

            window.localStorage.position = JSON.stringify(ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326'));
            window.localStorage.zoom = JSON.stringify(map.getView().getZoom());
        });

        _.each(_.keys(favorites), function(favorite) {
            $("select").append($("<option />").val(favorite).html(favorite));
        });

        // display popup on click
        var handler = function (evt) {
            var element = this;
            var stop = element.stop;

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
                                    var obj = {
                                        route: route.route_name,
                                        trip: trip.trip_headsign,
                                        minutes: parseInt(trip.pre_away / 60),
                                        vehicle_id: null
                                    };
                                    if (trip.vehicle) {
                                        obj.vehicle_id = trip.vehicle.vehicle_id;
                                    }
                                    return obj;
                                });
                            });
                        });
                    });

                    var alerts = result.alert_headers;

                    predictions = _.flatten(predictions);
                    predictions = _.sortBy(predictions, function (prediction) {
                        return prediction.minutes;
                    });
                    predictions = _.take(predictions, 3);

                    var html_pieces = _.map(predictions, function (prediction) {
                        html = "Route <b>" + prediction.route + "</b>";
                        if (prediction.vehicle_id) {
                            html += ", vehicle <b>" + prediction.vehicle_id + "</b>";
                        }
                        html += "<br />";
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
                    makePopup(stop, html, alerts);
                    select(element);
                },
                error: function () {
                    makePopup(stop, '', []);
                    select(element);
                }});
        };

        map.on('click', function() {
            clearPopup();
            clearSelected();
            $("#dialog").dialog("close");
        });

        var popupElement = document.getElementById('popup_info');
        var popup = new ol.Overlay({
            element: popupElement,
            positioning: 'bottom-center',
            stopEvent: true
        });
        map.addOverlay(popup);

        var markerEl = document.getElementById('geolocation_marker');
        var getlocateMarker = new ol.Overlay({
            positioning: 'center-center',
            element: markerEl,
            stopEvent: false
        });
        map.addOverlay(getlocateMarker);

        var geolocation = new ol.Geolocation({
            projection: view.getProjection(),
            tracking: false
        });
        geolocation.on('change:position', function() {
            view.setCenter(geolocation.getPosition());
            view.setResolution(2.388657133911758);

            getlocateMarker.setPosition(geolocation.getPosition());

            geolocation.setTracking(false);
        });

        var geolocateBtn = document.getElementById('geolocate');

        geolocateBtn.addEventListener('click', function() {
            geolocation.setTracking(true); // Start position tracking

            map.on('postcompose', render);
            map.render();
        }, false);

        var selectFavorite = document.getElementById('selectFavorite');
        selectFavorite.addEventListener('click', function() {
            var ul = "<select>";
            _.each(_.keys(favorites), function(favorite) {
                ul += "<a href='#' onclick=\"select";
            });
            ul += "</select>";
            $("#dialog").html(ul);
            $("#dialog").dialog();

        });

        var overlays = [];

        var clearOverlays = function() {
            _.each(overlays, function(overlay) {
                map.removeOverlay(overlay);
            });
            overlays = [];
        };


        var makePopup = function(stop, text, alerts) {
            var position = ol.proj.transform([parseFloat(stop['stop_lon']), parseFloat(stop['stop_lat'])], 'EPSG:4326', 'EPSG:3857');
            $(popupElement).show();
            popup.setPosition(position);

            var title = "<span class='title'>" + stop.stop_name + "</span><br /><br />";
            var right = "<div class='popup_info_right'>";
            var star_url = empty_star_url;
            if (favorites[stop['stop_id']]) {
                star_url = full_star_url;
            }
            right += "<img class='star' src='" + star_url + "' onclick='event.preventDefault(); BostonBusMap.toggleFavorite(" + JSON.stringify(stop['stop_id']) + "); BostonBusMap.updateStar(this, " + JSON.stringify(stop['stop_id']) + "); ' />";
            if (alerts.length) {
                right += ""
                right += "<br /><br /><br />";
                if (alerts.length === 1) {
                    right += "<a href='#' class='alert_text' onclick='BostonBusMap.showAlert(" + JSON.stringify(alerts) + "); event.preventDefault(); '>1 Alert</a>";
                }
                else {
                    right += "<a href='#' class='alert_text' onclick='BostonBusMap.showAlert(" + JSON.stringify(alerts) + "); event.preventDefault(); '>" + alerts.length + " Alerts</a>";
                }
            }

            right += "</div>";
            $(popupElement).html(title + right + text);
        };

        var clearPopup = function() {
            $(popupElement).hide();
        };

        var clearSelected = function() {
            $(".selected").children("img").prop("src", "./data/busstop.png");
            $(".selected").removeClass("selected");
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
            return busstop;
        };

        var select = function(element) {
            clearSelected();
            $(element).addClass("selected");
            $(element).children("img").prop('src', './data/busstop_selected.png');
        };

        var selectStop = function(stop_id) {
            clearSelected();
            // TODO: trigger stopsbylocation for particular lat/lon then select particular stop id
            throw new Exception("Unimplemented");
        };

        var update = function() {
            var center = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');

            $.get('http://realtime.mbta.com/developer/api/v2/stopsbylocation',
                {'api_key': apikey,
                    'format': 'json',
                    'lat': center[1],
                    'lon': center[0]}, function (data) {

                    var stops = _.sortBy(data.stop, function(stop) { return parseFloat(stop.stop_lat); });
                    stops = _.filter(stops, function(stop) { return !stop.parent_station; });

                    var old_selected = $(".selected");
                    var old_selected_element = null;
                    if (old_selected.length) {
                        old_selected_element = old_selected[0];
                    }



                    $(popupElement).popover('destroy');
                    clearOverlays();

                    var elements = _.map(stops, addStop);

                    var keep_selected = false;
                    if (old_selected_element) {
                        _.each(elements, function (element) {
                            if (element.hasOwnProperty("stop")) {
                                var stop = element.stop;
                                if (stop.stop_id === old_selected_element.stop.stop_id) {
                                    select(element);
                                    keep_selected = true;
                                }
                            }
                        });
                    }

                    if (!keep_selected) {
                        clearPopup();
                    }
                    old_selected.removeClass("selected");

                });
        };

        update();
    });

    return {map:map, toggleFavorite:toggleFavorite, updateStar:updateStar, showAlert: showAlert};
})();
