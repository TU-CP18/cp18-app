import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MapView } from 'expo';
import { FontAwesome } from '@expo/vector-icons';
import CarCheckItem from '../../components/CarCheckItem';
import Button from '../../components/Button';
import IssueModal from '../../components/IssueModal';

class ExteriorCheckScreen extends React.Component {
  static navigationOptions = ({ navigation }) => {
    return {
      title: 'Exterior Check',
      headerRight: (
        <FontAwesome
          onPress={() => navigation.navigate('Contact')}
          name="phone"
          size={28}
          style={{
            paddingRight: 12,
          }}
        />
      ),
    };
  };

  constructor() {
    super();

    this.state = {
      rearChecked: false,
      driverChecked: false,
      frontChecked: false,
      codriverChecked: false,
      issueModalVisible: false,
    };
  }

  toggleCheckbox = id => {
    const newValue = !this.state[id];
    this.setState({
      [id]: newValue,
    });
  }

  onPressOpenCar = () => {
    const { navigation } = this.props;

    if (!this.itemsChecked()) return;

    Alert.alert(
      // 'Alert Title',
      'Confirmation Request',
      'Confirm that you checked the exterior readiness of the '
      + 'car according to your besten Wissen and Gewissens',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => navigation.navigate('InteriorCheck') },
      ],
      { cancelable: true },
    );
  }

  itemsChecked = () => {
    const {
      rearChecked,
      driverChecked,
      frontChecked,
      codriverChecked,
    } = this.state;

    return rearChecked && driverChecked && frontChecked && codriverChecked;
  }

  showIssueModal = () => {
    this.setState({
      issueModalVisible: true,
    });
  }

  hideIssueModal = () => {
    this.setState({
      issueModalVisible: false,
    });
  }

  render() {
    const { navigation } = this.props;
    const {
      rearChecked,
      driverChecked,
      frontChecked,
      codriverChecked,
      issueModalVisible,
    } = this.state;

    return (
      <View style={styles.container}>
        <ScrollView>
          <TouchableOpacity
            onPress={() => navigation.navigate('Map', {
              disableArrivalButton: true,
            })}
          >
            <MapView
              style={styles.mapPreview}
              initialRegion={{
                latitude: 52.5191406,
                longitude: 13.4014149,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
              zoomEnabled={false}
              scrollEnabled={false}
            />
          </TouchableOpacity>

          <Text style={styles.guideText}>
            Follow the check list and track new issues if required
          </Text>

          <CarCheckItem
            title="Check Rear Side"
            checked={rearChecked}
            onPressCheck={() => this.toggleCheckbox('rearChecked')}
            onPressAddIssue={this.showIssueModal}
            issues={[
              'Driver Door: Big Dent',
              'Driver Window: Scratch',
            ]}
          />

          <CarCheckItem
            title="Check Driver Side"
            checked={driverChecked}
            onPressCheck={() => this.toggleCheckbox('driverChecked')}
            onPressAddIssue={this.showIssueModal}
            issues={[]}
          />

          <CarCheckItem
            title="Check Front Side"
            checked={frontChecked}
            onPressCheck={() => this.toggleCheckbox('frontChecked')}
            onPressAddIssue={this.showIssueModal}
            issues={[]}
          />

          <CarCheckItem
            title="Check Co-Driver Side"
            checked={codriverChecked}
            onPressCheck={() => this.toggleCheckbox('codriverChecked')}
            onPressAddIssue={this.showIssueModal}
            issues={['Co-Driver door: Big Dent']}
          />

          <Button
            onPress={this.onPressOpenCar}
            title="Open car"
            iconLeft="EvilIcons/unlock"
            disabled={!(this.itemsChecked())}
            wrapperStyle={{
              margin: 10,
            }}
            containerStyle={[
              styles.buttonContainer,
              this.itemsChecked() ? styles.buttonEnabled : styles.buttonDisabled,
            ]}
            textStyle={[
              this.itemsChecked() ? styles.buttonTextEnabled : styles.buttonTextDisabled,
            ]}
            iconStyle={[
              this.itemsChecked() ? styles.buttonIconEnabled : styles.buttonIconDisabled,
            ]}
          />
        </ScrollView>

        <IssueModal
          visible={issueModalVisible}
          onHide={this.hideIssueModal}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapPreview: {
    width: '100%',
    height: 80,
  },
  guideText: {
    padding: 20,
    paddingLeft: 10,
    fontSize: 16,
  },
  buttonContainer: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  buttonEnabled: {
    backgroundColor: '#1CFF95',
    borderColor: '#cecece',
  },
  buttonDisabled: {
    backgroundColor: '#cecece',
  },
  buttonTextEnabled: {
    color: '#ffffff',
  },
  buttonIconEnabled: {
    color: '#ffffff',
  },
});

export default ExteriorCheckScreen;