const package = require('./package.json')
const exec = require('child_process').exec

let Service, Characteristic

// Set up homebridge
module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('mac-display', 'DisplaySwitch', macDisplay) // register
}

function macDisplay(log, config) {
  this.log = log
}

function parseSystemProfilerOutput(output) {
  const lines = output.split('\n')
  const root = {}
  let stack = [{ obj: root, depth: -1 }]

  for (let line of lines) {
    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/)
    if (!match) continue

    const [, indent, key, value] = match
    const depth = indent.length

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].obj

    if (value) {
      parent[key] = value
    } else {
      parent[key] = {}
      stack.push({ obj: parent[key], depth })
    }
  }

  return root
}

function isStudioDisplayAsleep(callback) {
  exec('system_profiler SPDisplaysDataType', (err, stdout) => {
    if (err) {
      return callback(false, err)
    }

    const parsedData = parseSystemProfilerOutput(stdout)

    // Locate "Studio Display" and check if it's asleep
    const displays = parsedData['Graphics/Displays']
    if (displays) {
      for (const displayName in displays) {
        if (displayName.startsWith('Studio Display')) {
          return callback(
            displays[displayName]['Display Asleep'] === 'Yes',
            null,
          )
        }
      }
    }

    console.log(parsedData)

    callback(false, null) // Default to off if not found
  })
}

macDisplay.prototype.getServices = function () {
  let informationService = new Service.AccessoryInformation()
  informationService
    .setCharacteristic(Characteristic.Manufacturer, 'slavanossar')
    .setCharacteristic(Characteristic.Model, 'DisplaySwitch')
    .setCharacteristic(Characteristic.SerialNumber, package.version)

  let switchService = new Service.Switch('DisplaySwitch')
  switchService
    .getCharacteristic(Characteristic.On)
    .on('set', this.setSwitchOnCharacteristic.bind(this))
    .on('get', this.getSwitchOnCharacteristic.bind(this))

  // Poll status of device
  setInterval(function () {
    switchService.getCharacteristic(Characteristic.On).getValue()
  }, 3000)

  this.informationService = informationService
  this.switchService = switchService
  return [informationService, switchService]
}

// Returns proper state of display
macDisplay.prototype.getSwitchOnCharacteristic = function (next) {
  isStudioDisplayAsleep((isAsleep, err) => {
    if (err) return next(err)
    next(null, !isAsleep)
  })
}

// Sets the display on or off
macDisplay.prototype.setSwitchOnCharacteristic = function (on, next) {
  this.log(`Setting mac display: ${on ? 'on' : 'off'}`)

  isStudioDisplayAsleep((isAsleep, err) => {
    if (err) return next(err)

    if (isAsleep && on) {
      exec('caffeinate -u -t 1')
    } else if (!isAsleep && !on) {
      exec('pmset displaysleepnow')
    }

    next()
  })
}
