const package = require('./package.json');
const exec = require('child_process').exec;

let Service, Characteristic;

// Set up homebridge
module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("mac-display", "DisplaySwitch", macDisplay); // register
};

function macDisplay(log, config) {
  this.log = log;
}

macDisplay.prototype.getServices = function() {
  let informationService = new Service.AccessoryInformation();
  informationService
    .setCharacteristic(Characteristic.Manufacturer, "christopherwk210")
    .setCharacteristic(Characteristic.Model, "DisplaySwitch")
    .setCharacteristic(Characteristic.SerialNumber, package.version);

  let switchService = new Service.Switch("DisplaySwitch");
  switchService
    .getCharacteristic(Characteristic.On)
    .on('set', this.setSwitchOnCharacteristic.bind(this))
    .on('get', this.getSwitchOnCharacteristic.bind(this));

  this.informationService = informationService;
  this.switchService = switchService;
  return [informationService, switchService];
}

// Returns proper state of display
macDisplay.prototype.getSwitchOnCharacteristic = function(next) {
  exec("system_profiler SPDisplaysDataType | grep -m 1 \"Display Asleep\" | awk '{print $2}'", (err, stdout, stderr) => {
    console.log(stdout, stdout === 'Yes')
    next(null, stdout === 'Yes');
  });
}

// Sets the display on or off
macDisplay.prototype.setSwitchOnCharacteristic = function(on, next) {
  this.log('Setting mac display: ' + (on ? 'on' : 'off'));

  // Check current status
  exec("system_profiler SPDisplaysDataType | grep -m 1 \"Display Asleep\" | awk '{print $2}'", (err, stdout, stderr) => {
    console.log(stdout, stdout === 'Yes')
    if ((stdout === 'Yes') !== on) {
      on ? exec('caffeinate -u -t 1') : exec('pmset displaysleepnow');
    }
    next();
  });
}