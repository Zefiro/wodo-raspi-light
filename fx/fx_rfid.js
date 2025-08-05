var util = require('./fx_util')
var dict = require("dict")
const winston = require('winston')

const { SerialPort } = require('serialport')
var pn532 = require('pn532');

const fs = require('fs').promises

/* Hardware:
 * /dev/ttyAMA0 for Raspi internal UART (rx = pin 5)
 * /dev/ttyUSB0 for USB UART
 *
 * not working? See who's using it:
 *   sudo fuser /dev/ttyAMA0
 *
 *
 * Prepare for an event
 *----------------------
 * - connect either rfid or nfc reader
 *   - select which one in function init()
 *   - update filter in sendUserlistToBrowser here, and in on.userlistToBrowser in zcon.html
 * - prepare data file (tbd), see "// YEARLY_UPDATE"
 *   - update auto-fill in receiveSerial() for !user-branch
 *   - take previous userlist-(event|year).json and copy to userlist.json
 *   - set resetUsersOnLoad=true, start ONCE, then set to false again. This resets "Da" for all already-known users.
 *   - select default effect, e.g. "single color black"
 *   - for each card, hold it to the reader, if necessary change 'day' etc, press return or click save
 *   - backup: copy userlist.json to userlist-(event|year)-precon.json
 *   - optional backup: copy userlist.json to userlist-(event|year)-xxxsave.json
 *
 * After the event
 *-----------------
 * - copy userlist.json to userlist-(event|year).json
 *
 * TODO for 2019
 * + repair rdm parser, with the new parser format
 * - perhaps move "repeated detection" into receiveSerial, not inside the parser
 * - centralize strings ('2018', perhaps more?) and rfid/nfc type
 */

/*
SerialPort.list(function (err, ports) {
  console.log("Serial ports found:");
    ports.forEach(function(port) {
      console.log(port.comName);
      console.log(port.pnpId);
      console.log(port.manufacturer);
    });
});
//*/

module.exports = async function(layout, configManager, god) { 
	var self = {

    // FX configuration
	_configManager: configManager,
//    _comPortName: '/dev/ttyUSB0',
    _comPortName: '/dev/ttyAMA0',
	_ready: false,
	logger: winston.loggers.get('fx_rfid'),
	usersFilename: 'userlist.json',
	/** 0: normal mode
	  * 1: about to save config
	  */
	_mode: 0,
	userLogoutTimeout: 5 * 60 * 1000,
	userSaveTimeout: 1 * 60 * 1000,
	resetUsersOnLoad: false, // use only when initializing before a con -- // YEARLY_UPDATE
    allowNewUsers: false, // should unknown cards create a new user? otherwise they'll be ignored

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
        if (!ignoreRepeatedRfidTimeout) ignoreRepeatedRfidTimeout = 3 * 1000
        if (!clearBufferTimeout) clearBufferTimeout = 500
        var data = new Buffer(0)
	    var lastReceivedTime = Date.now()
		var lastReceivedRfid = ''
	    var lastReceivedRfidTime = Date.now()
        return function(emitter, buffer) {
            if (data.length > 9999) {
                data = ""
	            this.logger.error("fx_rfid: parserForRDM6300: buffer overflow, resetting buffer")
            }
            var now = Date.now()
            if (data.length > 0 && now - lastReceivedTime > clearBufferTimeout) {
                data = new Buffer(0)
	            this.logger.error("fx_rfid: parserForRDM6300: timeout reached, resetting buffer")
            }			
            lastReceivedTime = now
//this.logger.debug("Raw: |" + buffer + "| (" + buffer.length + ")")
//for(var i = 0; i < buffer.length; i++) this.logger.debug("#"+i+": |"+buffer[i]+"|")
            data = Buffer.concat([data,buffer])
            while (data.length >= length) {
				if (data[0] !== 2 || data[13] !== 3) {
	                this.logger.error("fx_rfid: parserForRDM6300: buffer framing error")
					return
				}
                var out = data.slice(1, length-1).toString()
                data = data.slice(length)
//                this.logger.debug("out: |"+out+"| ("+out.length+") -- rest: |"+data+"|")
                if (lastReceivedRfid === out && now - lastReceivedRfidTime < ignoreRepeatedRfidTimeout) {
//					this.logger.info("Ignored repeated: " + out)
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
            this.logger.info('Timeout: deselecting user %o', this.variables.get('users').lastUser)
			this.variables.get('users').lastUser = null
			this._configManager.update()
			this._configManager.updateUsers()
		}.bind(this), this.userLogoutTimeout)
	},
	setSaveTimeout: function(user) {
		clearTimeout(this.currentTimeout)
		if (!this.userSaveTimeout) return
		this.currentTimeout = setTimeout(function(){
			this._mode = 0
			this._configManager.update()
		}.bind(this), this.userSaveTimeout)
	},

    receiveSerial: async function(data) {
        this.logger.debug('Received: %o', data)
		data = data.replace(/(\r\n|\n|\r)/gm, "")
		var user = null
		var users = this.variables.get('users').users
		users.forEach(function(value, index) {
		    if (value.rfid === data) user = value
		})
        if (data == '000000000000') {
   			this._configManager.toast("Invalid rfid scanned: '" + data + "'")
   			this.logger.warn("Invalid rfid scanned: '" + data + "'")
            return
        } else if (!user) {
            if (this.allowNewUsers) {
                // YEARLY_UPDATE set the new year here (and also in zcon.html)
                user = {rfid: data, nick:"User #"+(users.length+1), counter:-1, da: 0, paid: 1, day: 'DO', 'event': 'zcon2024' }
                this.logger.info("New user found (rfid='" + user.rfid + "')")
                users.push(user)
                this._configManager.toast("New user found (rfid='" + user.rfid + "')")
            } else {
                this.logger.info("Unknown user found (rfid='" + data + "'), ignored")
                this._configManager.toast("Unknown user found (rfid='" + data + "'), ignored")
                return
            }
		} else {
			// assume user arrived when the card is seen
			if (user.da === 0) {
				user.da = 1
				user.arrivalTime = new Date()
			}
            this.logger.info("Matching user found: %o (event: %o, counter: %o, day: %o, da: %o, paid: %o)", user.nick, user.event, user.counter, user.day, user.da, user.paid)
		}
		if (this._mode == 0) {
			user.counter++
			if (user.fx) {
	            var fx = await this._configManager.addEffect(user.fx.name)
                var cfg = user.fx.cfg
                fx.fx.loadConfigData(cfg)
                this._configManager.fxList[1] = fx
     			this._configManager.toast("Config loaded for user '" + user.nick + "'")
			}
			await this._saveUserlist('by user detection')
     		this.variables.get('users').lastUser = user
			this._configManager.update()
			this._configManager.updateUsers()
			this.setUserTimeout(user)
		} else if (this._mode == 1) {
			var fxEntry = this._configManager.fxList[1]
			var fxCfg = fxEntry.fx.saveConfigData()
			user.fx = { name: fxEntry.name, cfg: fxCfg }
			this._mode = 0
    		this.variables.get('users').lastUser = null
			await this._saveUserlist('for unfinished coding...')
			this._configManager.update()
			this._configManager.updateUsers()
			this._configManager.toast("Config saved for user '" + user.nick + "'")
		} else this.logger.error("fx_rfid: unknown mode " + this._mode)
	},

// ------------------------------------------------------------------------------------------------------------------------

	init: async function() {
		if (true) { // harcoded selection of receiver type
    		await this.init_rfid();
		} else {
			await this.init_nfc();
		}
		await this._loadUserlist()
		this._configManager.sendUserlistToBrowser = this.sendUserlistToBrowser.bind(this)
	},
	
	init_rfid: async function() {
        var serial = new SerialPort({ 
            path: this._comPortName,
            baudRate: 9600,
//            parser: this.parserForRDM6300(),
        });
		serial.on('open', function (data) {
            this.logger.info('Serial port "' + this._comPortName + '" opened')
			this._ready = true
        }.bind(this));
        serial.on('error', function (error) {
           this.logger.error('fx_rfid: failed to open serial port ' + this._comPortName + ': ' + error)
		   this._ready = false
        }.bind(this));
		// 2019-07 quick repair hack for the changed implementation of serialport
		// parser handling was changed, options.parser is replaced with serial.pipe and a changed interface
		let serialReceive = this.receiveSerial.bind(this)
		let emiter = {
			emit: async function(key, data) {
				// "key" will be "data"
				await serialReceive(data)
			}
		}
		let parser = this.parserForRDM6300().bind(this)
        serial.on('data', data => parser(emiter, data))
	},

	init_nfc: async function() {
        var serial = new serialport(this._comPortName, {
            baudrate: 115200
        });
		var rfid = new pn532.PN532(serial, { pollInterval: 200 } );
		rfid.on('ready', (function() {
			this.logger.info('nfc ready')
			rfid.on('tag', (async function(tag) {
				await this.receiveSerial(tag.uid);
			}).bind(this));
		}).bind(this));
	},
	
	sendUserlistToBrowser: function(socket, data) {
		var users = util.clone(this.variables.get('users'))		
		users.users = users.users.filter(user => {
			return user.event == "zcon2024" || user.da == 1
		})
		this.logger.info("sendUserlistToBrowser: printing list of users (" + users.users.length + " of " + this.variables.get('users').users.length + ")")
		socket.emit("userlistToBrowser", users)
	},

	_loadUserlist: async function() {
		this.logger.info("fx_rfid: Load triggered...")
        let data = {}
        try {
            data = await fs.readFile(this.usersFilename, {encoding: 'utf-8'})
		} catch (error) {
			this.logger.error("fx_rfid: Failed to read config file %s: %o", this.usersFilename, error)
            return
		}
        this.logger.info("rx_rfid: parsing userlist")
        var users = JSON.parse(data)
        users.lastUser = null
        this.variables.set('users', users)
        if (this.resetUsersOnLoad) { // use once to reset 'da' of all users
            var resetCounter = 0
            this.logger.debug(users.users)
            users.users.forEach(user => {
                if (user.da) {
                    user.da = 0
                    resetCounter++
                }
            })
            if (resetCounter) {
                this.logger.warn("Resetting " + resetCounter + " users to be not 'da'")
                await this._saveUserlist("after resetting 'da' for all users")
            }
        }
        this._configManager.update()
        this._configManager.updateUsers()
        this.logger.info("fx_rfid: userlist loaded ("+users.users.length+" users)")
	},
    
	_saveUserlist: async function(reason) {
		this.logger.info("fx_rfid: Save triggered %s", reason ? reason : 'for unknown reason')
		var users = this.variables.get('users')
        let json = JSON.stringify(users)
        let users2 = JSON.parse(json)
		delete users2.lastUser
        json = JSON.stringify(users2, null, 4)
        try {
            await fs.writeFile(this.usersFilename, json, {encoding: 'utf-8'})
        } catch (error) {
			this.logger.error("fx_rfid: Failed to write config file %s: %o", this.usersFilename, error)
            return
		}
        this._configManager.updateUsers()
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
				{ name: 'day', type: 'string', id: 'day', desc: 'day of arrival (DO / FR)', css:'width:50px;' },
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
			day: user.day,
			da: user.da,
			paid: user.paid,
        }
	},
	
	setConfigData: async function(data) {
		var user = this.variables.get('users').lastUser
		if (!user) {
			this._mode = data.mode
			this._configManager.toast("Please place card to save light config")
			return
		}
		user.nick = data.nick
		user.counter = data.counter
		user.day = data.day
		user.da = data.da
		user.paid = data.paid
		if (data.mode) { // mode 0 = any soft config change, mode 1 = 'save' has been clicked
			var fxEntry = this._configManager.fxList[1]
			var fxCfg = fxEntry.fx.saveConfigData()
			user.fx = { name: fxEntry.name, cfg: fxCfg }
			this._configManager.updateUsers()
			this._configManager.toast("Config saved for user '" + user.nick + "'")
            await this._saveUserlist('by web ui')
		}
	},
    
	saveConfigData: function() {
        return {
        }
	},
	
	loadConfigData: function(data) {
	},
    
    renderColors: function(canvas, variables) {
    	return canvas
    },
    
}
    await self.init()
    return self
}
