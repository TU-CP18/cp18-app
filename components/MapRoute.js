import React from 'react';
import PropTypes from 'prop-types';
import {
  StyleSheet,
  View,
  Dimensions,
  Alert,
} from 'react-native';
import {
  MapView,
  Location,
  Permissions,
  IntentLauncherAndroid,
  Constants,
} from 'expo';
import geolib from 'geolib';
import MapboxClient from 'mapbox';
import lib from '../helpers/lib';
import asyncSleep from '../helpers/asyncSleep';
import logger from '../helpers/logger';
import Button from './Button';

const { width, height } = Dimensions.get('window');
const customMarkerImg = require('../assets/images/custom_marker.png');

class MapRoute extends React.Component {
  cancelNavigation = false;

  constructor(props) {
    super(props);

    this.state = {
      coordinates: [],
      steps: [],
      currentCoordinateIndex: 0,
      focusedLocation: {
        latitude: props.latitude,
        longitude: props.longitude,
        latitudeDelta: 0.0122,
        longitudeDelta: width / height * 0.0122,
      },
      destinationReached: false,
      isMapReady: false,
      isNavigation: false,
    };

    this.apikey = Constants.manifest.extra.mapbox.apiKey;
  }

  async componentDidMount() {
    const {
      showDirections,
      latitude,
      longitude,
      initialFocus,
    } = this.props;

    // ask the user for location permission
    const { locationServicesEnabled } = await Location.getProviderStatusAsync();
    if (!locationServicesEnabled) {
      IntentLauncherAndroid.startActivityAsync(
        IntentLauncherAndroid.ACTION_LOCATION_SOURCE_SETTINGS,
      );
      return;
    }
    if (await !lib.isPermissionGranted(Permissions.LOCATION)) {
      Alert.alert('Permission', 'You need to enable location services');
      return;
    }

    // get the current location of the user
    const currentLocation = await this.getLocation();
    const destinationLocation = {
      latitude,
      longitude,
    };

    if (initialFocus === 'gps') {
      this.focusOnCoords(currentLocation);
    } else {
      this.focusOnCoords(destinationLocation);
    }

    // retrieve a direction between these two points
    if (showDirections) {
      const coords = await this.getDirections(currentLocation, destinationLocation);
      this.map.fitToCoordinates(coords, {
        edgePadding: {
          top: 60,
          right: 25,
          bottom: 80,
          left: 25,
        },
        animated: true,
      });
      // monitor the current position of the user
      this.watchid = await Location.watchPositionAsync({
        enableHighAccuracy: true,
        distanceInterval: 1,
      }, this.checkUserLocation);
    }
  }

  componentDidUpdate(prevProps) {
    const { isNavigation, pauseNavigation } = this.props;
    if (isNavigation && isNavigation !== prevProps.isNavigation) {
      this.startNavigation();
    }
    if (!pauseNavigation && pauseNavigation !== prevProps.pauseNavigation) {
      this.simulateNavigation();
    }
  }

  componentWillUnmount() {
    this.cancelNavigation = true;
    if (this.watchid) {
      this.watchid.remove();
    }
  }

  getLocation = async () => {
    const { userLatitude, userLongitude } = this.props;
    if (userLatitude) {
      return {
        latitude: userLatitude,
        longitude: userLongitude,
      };
    }
    return lib.getLocation();
  }

  simulateNavigation = async () => {
    const { pauseNavigation } = this.props;
    const { coordinates, currentCoordinateIndex } = this.state;
    if (!pauseNavigation && currentCoordinateIndex < coordinates.length) {
      this.checkUserLocation({
        coords: coordinates[currentCoordinateIndex],
      });
      await asyncSleep(1500);

      // in case the component unmounts cancelNavigation is set to true
      // otherwise setState can provide error
      if (this.cancelNavigation) return;

      this.setState(prevState => (
        { currentCoordinateIndex: prevState.currentCoordinateIndex + 1 }
      ));
      this.simulateNavigation();
    }
  };

  focusOnCoords = coords => {
    const { focusedLocation } = this.state;
    const region = {
      ...focusedLocation,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    // initalize map at current position
    this.map.animateToRegion(region);
    this.setState({
      focusedLocation: region,
    });
  };

  /**
   * retrieves the coordinates of a route
   * route: safety drivers position to the interception point
   * @param startLoc
   * @param destinationLoc
   * @returns {Promise<*>}
   */
  getDirections = async (startLoc, destinationLoc) => {
    const client = new MapboxClient(this.apikey);
    const res = await client.getDirections(
      [
        startLoc,
        destinationLoc,
      ],
      { profile: 'driving', geometry: 'polyline6' },
    );
    const coordinates = res.entity.routes[0].geometry.coordinates.map(point => {
      return {
        latitude: point[1],
        longitude: point[0],
      };
    });
    const steps = res.entity.routes[0].legs[0].steps.map(step => {
      return {
        latitude: step.maneuver.location[1],
        longitude: step.maneuver.location[0],
        bearing: step.maneuver.bearing_after,
      };
    });
    this.setState({
      coordinates: coordinates,
      steps: steps,
    });
    return coordinates;
  };

  checkUserLocation = async location => {
    const { onDestinationReached } = this.props;
    const { coordinates, isNavigation } = this.state;
    const { coords } = location;
    if (isNavigation) {
      // follow the user location
      this.animateToCoordinates(coords);
      // navigate route
      this.animateNavigation(coords);
    }
    const destinationCoords = coordinates[coordinates.length - 1];
    const distance = geolib.getDistance(coords, destinationCoords);
    // show button if user is close to destination so he can confirm arrival
    // remove arrival button in case the user moves away from the destination
    if (distance <= 20) {
      this.setState({ destinationReached: true });
      onDestinationReached();
    }
  };

  animateNavigation = async coords => {
    const { steps } = this.state;
    for (let i = 0; i < steps.length; i++) {
      const distance = geolib.getDistance(coords, steps[i]);
      if (distance < 10) {
        // user is 5 meters close to intersection point
        this.map.animateToBearing(steps[i].bearing);
        steps.splice(i, 1);
        this.setState({ steps: steps });
        break;
      }
    }
  };

  /**
   * animate to specified coordinates on the map
   * @param coords
   */
  animateToCoordinates = async coords => {
    const { latitude, longitude } = coords;
    if (latitude && longitude) {
      this.map.animateToCoordinate({
        latitude: latitude,
        longitude: longitude,
      });
    }
  };

  startNavigation = async () => {
    const { trackNavigationEvent } = this.props;
    const { coordinates } = this.state;

    this.setState({ isNavigation: true });
    this.map.fitToCoordinates(coordinates.slice(0, 2));
    this.map.animateToViewingAngle(45);
    const currentLocation = await this.getLocation();
    this.animateNavigation(currentLocation);

    if (trackNavigationEvent) {
      // log event
      logger.slog(logger.SHIFT_INTERCEPTING);
    }
    if (global.devSettings.settings.get('fakeNavigation')) {
      this.simulateNavigation();
    }
  };

  /**
   * Renders the button for the startNavigation and confirmal button.
   */
  renderButton = (title, onPress) => (
    <Button
      title={title}
      onPress={onPress}
      iconLeft="Ionicons/ios-checkmark-circle-outline"
      wrapperStyle={s.confirmButtonWrapper}
      containerStyle={s.confirmButtonContainer}
      iconStyle={s.confirmButtonIcon}
      titleStyle={s.confirmButtonTitle}
    />
  );

  /**
   * Render button to confirm arrival when the user arrived at the interchange point.
   */
  renderConfirmalButton() {
    const { onArrivalConfirmed, showConfirmationButton } = this.props;
    const { destinationReached } = this.state;

    if (!showConfirmationButton || !destinationReached) {
      return null;
    }

    return this.renderButton('Confirm Arrival', onArrivalConfirmed);
  }

  /**
   * Render button to start the navigation if it have not already been started.
   */
  renderNavigationButton() {
    const { showNavigationButton } = this.props;
    const { destinationReached, isNavigation } = this.state;

    if (destinationReached || isNavigation || !showNavigationButton) {
      return null;
    }

    return this.renderButton('Start Navigation', this.startNavigation);
  }

  renderRoute() {
    const { isMapReady, coordinates } = this.state;
    if (!isMapReady || coordinates.length === 0) {
      return null;
    }
    return (
      <MapView.Polyline
        coordinates={coordinates}
        strokeWidth={5}
        strokeColor="blue"
      />
    );
  }

  renderMarker() {
    const { isMapReady, coordinates } = this.state;
    if (!isMapReady || coordinates.length === 0) {
      return null;
    }
    return (
      <MapView.Marker
        coordinate={coordinates[coordinates.length - 1]}
      />
    );
  }

  renderLocationMarker() {
    if (!global.devSettings.settings.get('fakeNavigation')) {
      // only used for simulating navigation
      return null;
    }
    const {
      isMapReady,
      isNavigation,
      currentCoordinateIndex,
      coordinates,
    } = this.state;
    if (!isMapReady || !isNavigation || coordinates[currentCoordinateIndex] === undefined) {
      return null;
    }
    return (
      <MapView.Marker
        image={customMarkerImg}
        coordinate={coordinates[currentCoordinateIndex]}
      />
    );
  }

  onMapReady = () => {
    this.setState({ isMapReady: true });
  };

  render() {
    const { userLatitude } = this.props;
    const { style } = this.props;

    return (
      <View style={s.container}>
        <MapView
          provider="google"
          style={[s.map, style]}
          showsUserLocation={!userLatitude}
          loadingEnabled
          customMapStyle={mapStyle}
          ref={map => { this.map = map; }}
          onMapReady={this.onMapReady}
        >
          {this.renderRoute()}
          {this.renderLocationMarker()}
          {this.renderMarker()}
        </MapView>
        {this.renderConfirmalButton()}
        {this.renderNavigationButton()}
      </View>
    );
  }
}

const mapStyle = require('../assets/styles/mapStyle');

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  map: {
    width: width,
    height: height,
  },

  /* Button */
  confirmButtonWrapper: { // touchable wrapper
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 60,
  },
  confirmButtonContainer: {
    padding: 16,
  },
  confirmButtonIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  confirmButtonTitle: {
    fontSize: 22,
  },
});

MapRoute.propTypes = {
  onArrivalConfirmed: PropTypes.func,
  onDestinationReached: PropTypes.func,
  showDirections: PropTypes.bool,
  showConfirmationButton: PropTypes.bool,
  showNavigationButton: PropTypes.bool,
  isNavigation: PropTypes.bool,
  pauseNavigation: PropTypes.bool,
  latitude: PropTypes.number.isRequired,
  longitude: PropTypes.number.isRequired,
  userLatitude: PropTypes.number,
  userLongitude: PropTypes.number,
  initialFocus: PropTypes.string,
  trackNavigationEvent: PropTypes.bool,
};

MapRoute.defaultProps = {
  onArrivalConfirmed: () => undefined,
  onDestinationReached: () => undefined,
  showDirections: true,
  showConfirmationButton: true,
  showNavigationButton: true,
  isNavigation: false,
  pauseNavigation: false,
  initialFocus: 'gps',
  trackNavigationEvent: false,
  userLatitude: null,
  userLongitude: null,
};

export default MapRoute;
