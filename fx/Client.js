var util = require('./fx_util')
var dict = require("dict")

module.exports = function(_numLeds, name) { return {

    // FX configuration
    _inputIndexes: [],
	variables: dict({
		clientId: 1,
		clientData: "",
	}),
	
    getInputIndexes: function() {
        return this._inputIndexes
    },
    
    getName: function() {
        return "External Client"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Client ID', type: 'int', id: 'clientId', desc: 'ID of the client', css:'width:50px;' },
			{ name: 'Data', type: 'string', id: 'clientData', desc: 'Data (String)', css:'width:400px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { clientId: this.variables.get('clientId'), clientData: this.variables.get('clientData') }
	},
	
	setConfigData: function(data) {
		this.variables.set('clientId', data.clientId)
		this.variables.set('clientData', data.clientData)
	},

	saveConfigData: function() {
		return { clientId: this.variables.get('clientId'), clientData: this.variables.get('clientData') }
	},
	
	loadConfigData: function(data) {
		this.variables.set('clientId', data.clientId)
		this.variables.set('clientData', data.clientData)
	},

    renderColors: function(inputColors, variables) {
    	return inputColors
    },
    
}}
