var util = require('./fx_util')
var dict = require("dict")

// https://github.com/EmergingTechnologyAdvisors/node-serialport/blob/3.1.2/README.md
var serialport = require('serialport')
var SerialPort = serialport.SerialPort

var fs = require('fs')
var Q = require('q')

/* Hardware:
 * /dev/ttyAMA0 for Raspi internal UART (rx = pin 5)
 * /dev/ttyUSB0 for USB UART
 *
 * not working? See who's using it:
 *   sudo fuser /dev/ttyAMA0
 */

 /*
serialport.list(function (err, ports) {
  console.log("Serial ports found:");
    ports.forEach(function(port) {
      console.log(port.comName);
      console.log(port.pnpId);
      console.log(port.manufacturer);
    });
});
*/

module.exports = function(numLeds, configManager) { 
	self = {

    // FX configuration
	_inputIndexes: [],
	_numLeds: numLeds,
	_configManager: configManager,
//    _comPortName: '/dev/ttyUSB0',
    _comPortName: '/dev/ttyAMA0',
	_ready: false,
	usersFilename: 'userlist.json',
	/** 0: normal mode
	  * 1: about to save config
	  */
	_mode: 0,
	userLogoutTimeout: 5 * 60 * 1000,
	userSaveTimeout: 1 * 60 * 1000,

	variables: dict({
		users: {
			users: [],
			lastUser: null,
		},
	}),
	
// ------------------------------------------------------------------------------------------------------------------------
// Communication with external rfid reader via serial

    // based on https://github.com/EmergingTechnologyAdvisors/node-serialport/blob/master/lib/parsers.js
    parserForRDM6300: function(ignoreRepeatedRfidTimeout, clearBufferTimeout) {
		var length = 14
        if (!ignoreRepeatedRfidTimeout) ignoreRepeatedRfidTimeout = 1000
        if (!clearBufferTimeout) clearBufferTimeout = 500
        var data = new Buffer(0)
	    var lastReceivedTime = Date.now()
		var lastReceivedRfid = ''
	    var lastReceivedRfidTime = Date.now()
        return function(emitter, buffer) {
            if (data.length > 9999) {
                data = ""
	            console.log("fx_rfid: parserForRDM6300: buffer overflow, resetting buffer")
            }
            var now = Date.now()
            if (data.length > 0 && now - lastReceivedTime > clearBufferTimeout) {
                data = new Buffer(0)
	            console.log("fx_rfid: parserForRDM6300: timeout reached, resetting buffer")
            }			
            lastReceivedTime = now
//            console.log("Raw: |" + buffer + "| (" + buffer.length + ")")
//            for(var i = 0; i < buffer.length; i++) console.log("#"+i+": |"+buffer[i]+"|")
            data = Buffer.concat([data,buffer])
            while (data.length >= length) {
				if (data[0] !== 2 || data[13] !== 3) {
	                console.log("fx_rfid: parserForRDM6300: buffer framing error")
				}
                var out = data.slice(1, length-1).toString()
                data = data.slice(length)
//                console.log("out: |"+out+"| ("+out.length+") -- rest: |"+data+"|")
                if (lastReceivedRfid === out && now - lastReceivedRfidTime < ignoreRepeatedRfidTimeout) {
//					console.log("Ignored repeated: " + out)
				} else {
					emitter.emit('data', out)
				}
				lastReceivedRfid = out
				lastReceivedRfidTime = now
            }
        }
    },
	
	currentTimeout: null,
	setUserTimeout: function(user) {
		clearTimeout(this.currentTimeout)
		if (!this.userLogoutTimeout) return
		this.currentTimeout = setTimeout(function(){
			this.variables.get('users').lastUser = null
			this._configManager.update()
			this._configManager.updateUsers()
		}.bind(this), this.userLogoutTimeout)
	},
	setSaveTimeout: function(user) {
		clearTimeout(this.currentTimeout)
		if (!this.userLogoutTimeout) return
		this.currentTimeout = setTimeout(function(){
			this._mode = 0
			this._configManager.update()
		}.bind(this), this.userSaveTimeout)
	},

    receiveSerial: function(data) {
		data = data.replace(/(\r\n|\n|\r)/gm, "")
		var user = null
		var users = this.variables.get('users').users
		users.forEach(function(value, index) {
		    if (value.rfid === data) user = value
		})
		if (!user) {
			user = {rfid: data, nick:"User #"+(users.length+1), counter:0, da: 0, paid: 1 }
			console.log("New user found (rfid='" + user.rfid + "')")
			users.push(user)
   			this._configManager.toast("New user found (rfid='" + user.rfid + "')")
		} else {
			// assume user arrived when the card is seen
			if (user.da === 0) {
				user.da = 1
				user.counter = 0
				user.arrivalTime = new Date()
			}
            console.log("Matching user found: " + user.nick + " ("+user.counter+")")
		}
		if (this._mode == 0) {
			user.counter++
			if (user.fx) {
	            var fx = this._configManager.addEffect(user.fx.name)
                var cfg = user.fx.cfg
                fx.fx.loadConfigData(cfg)
                this._configManager.fxList[1] = fx
     			this._configManager.toast("Config loaded for user '" + user.nick + "'")
			}
     		this.variables.get('users').lastUser = user
			this._saveUserlist()
			this._configManager.update()
			this._configManager.updateUsers()
			this.setUserTimeout(user)
		} else if (this._mode == 1) {
			var fxEntry = this._configManager.fxList[1]
			var fxCfg = fxEntry.fx.saveConfigData()
			user.fx = { name: fxEntry.name, cfg: fxCfg }
			this._mode = 0
    		this.variables.get('users').lastUser = null
			this._saveUserlist()
			this._configManager.update()
			this._configManager.updateUsers()
			this._configManager.toast("Config saved for user '" + user.nick + "'")
		} else console.log("fx_rfid: unknown mode " + this._mode)
	},

// ------------------------------------------------------------------------------------------------------------------------

	init: function() {
        var serial = new SerialPort(this._comPortName, {
            baudrate: 9600,
            parser: this.parserForRDM6300(),
        });
		serial.on('open', function (data) {
            console.log('Serial port "' + this._comPortName + '" opened: ' + data)
			this._ready = true
        }.bind(this));
        serial.on('error', function (data) {
           console.log('fx_rfid: failed to open serial port ' + this._comPortName + ': ' + error)
		   this._ready = false
        }.bind(this));
        serial.on('data', this.receiveSerial.bind(this));
		this._loadUserlist()
		this._configManager.zconListRead = this.zconListRead.bind(this)
	},
	
	zconListRead: function(socket, data) {
		console.log("zconListRead: printing list of users")
		var users = this.variables.get('users')
		socket.emit("zconListWrite", users)
	},

	_loadUserlist: function() {
		console.log("fx_rfid: Load triggered...")
		var p=Q.nfcall(fs.readFile, this.usersFilename, {encoding: 'utf-8'})
		p.fail(function () {
			console.log("fx_rfid: Failed to read config file " + this.usersFilename)
		}.bind(this))
		p.then(function (data) {
			var users = JSON.parse(data)
            users.lastUser = null
			this.variables.set('users', users)
			this._configManager.update()
			this._configManager.updateUsers()
		}.bind(this))
	},
    
	_saveUserlist: function() {
		console.log("fx_rfid: Save triggered...")
		var users = this.variables.get('users')
	    var p=Q.nfcall(fs.writeFile, this.usersFilename, JSON.stringify(users, null, 4), {encoding: 'utf-8'})
        p.fail(function () {
			console.log("fx_rfid: Failed to write config file " + this.usersFilename)
		}.bind(this))
		p.then(function (data) {
			// all fine
			this._configManager.updateUsers()
		}.bind(this))
	},
    
    getInputIndexes: function() {
        return this._inputIndexes
    },
    
    getName: function() {
        return "rfid Receiver"
    },
	
    getConfigHtml: function(idx) {
		var user = this.variables.get('users').lastUser
		if (!user) {
			var metaconfig = { c: [
				{ name: '', type: 'text', desc: 'No user recognized. Please place badge on reader.' },
				{ name: 'Save', type: 'button', id: 'mode', desc: 'Saves current color to next user', css:'width:50px;' },
			],
			name: this.getName(),
			}
		} else {
			var metaconfig = { c: [
				{ name: 'Nick', type: 'string', id: 'nick', desc: 'Nickname', css:'width:150px;' },
				{ name: 'Counter', type: 'int', id: 'counter', desc: 'Counter', css:'width:50px;' },
				{ name: 'da', type: 'int', id: 'da', desc: '0 = kommt noch, 1 = anwesend, 2 = abgesagt', css:'width:50px;' },
				{ name: 'paid', type: 'int', id: 'paid', desc: '0 = non-pay, 1 = paid, 2 = unpaid', css:'width:50px;' },
				{ name: 'Save', type: 'button', id: 'mode', desc: 'Saves current color to this user', css:'width:50px;' },
			],
			name: this.getName(),
			}
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
	
	getConfigData: function() {
		var user = this.variables.get('users').lastUser
		if (!user) return {
			mode: this._mode,
		}
        return {
			nick: user.nick,
			counter: user.counter,
			da: user.da,
			paid: user.paid,
        }
	},
	
	setConfigData: function(data) {
		var user = this.variables.get('users').lastUser
		if (!user) {
			this._mode = data.mode
			this._configManager.toast("Please place card to save light config")
			return
		}
		user.nick = data.nick
		user.counter = data.counter
		user.da = data.da
		user.paid = data.paid
		if (data.mode) {
			var fxEntry = this._configManager.fxList[1]
			var fxCfg = fxEntry.fx.saveConfigData()
			user.fx = { name: fxEntry.name, cfg: fxCfg }
			this._configManager.updateUsers()
			this._configManager.toast("Config saved for user '" + user.nick + "'")
		}
		this._saveUserlist()
	},
    
	saveConfigData: function() {
        return {
        }
	},
	
	loadConfigData: function(data) {
	},
    
    renderColors: function(inputColors, variables) {
    	return inputColors
    },
    
}
    self.init()
    return self
}
