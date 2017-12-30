var util = require('./fx_util')

var audioData = []

function arrayFill(array, value, start, end) {
    if (!Array.isArray(array)) {
        throw new TypeError('array is not a Array');
    }

    var length = array.length;
    start = parseInt(start, 10) || 0;
    end = end === undefined ? length : (parseInt(end, 10) || 0);

    var i;
    var l;

    if (start < 0) {
        i = Math.max(length + start, 0);
    } else {
        i = Math.min(start, length);
    }

    if (end < 0) {
        l = Math.max(length + end, 0);
    } else {
        l = Math.min(end, length);
    }

    for (; i < l; i++) {
        array[i] = value;
    }

    return array;
};

if (!Array.prototype.fill) {
    Object.defineProperty(Array.prototype, 'fill', {
        enumerable: false,
        value: function fill(value) {
            var start = arguments.length > 1 ? arguments[1] : undefined;
            var end = arguments.length > 2 ? arguments[2] : undefined;

            return arrayFill(this, value, start, end);
        }
    });
}

module.exports = function (numLeds, config, socket) {
    var slot = 1
    var cycle = 0
    var rev = 0
    console.log('LOADED MISAN')
    socket.on('stream', function(audio) {
        audioData = audio
        console.log(audioData)
    })
    var self = {
        
        // FX configuration
        pixels: Array(numLeds).fill({}),
        _inputIndexes: [],
        numLeds: numLeds,
        type: 'fire',
        color: 'red',

        getInputIndexes: function () {
            return this._inputIndexes
        },

        getName: function () {
            return "Misan"
        },

        init: function () {
        },

        /** idx: the index in the effect list. Can be used to identify parameters.
         */
        getConfigHtml: function (idx) {
            var colorValues = {
                red: "Red Fire",
                blue: "Blue Fire",
            }
            var typeValues = {
                fire: 'fire',
                linear: "linear",
            }
            var metaconfig = {
                c: [
                    { name: 'color', type: 'combo', id: 'color', desc: 'Color of the effect', css: 'width:150px;', combo: colorValues },
                    { name: 'type', type: 'combo', id: 'type', desc: 'Type of the effect', css: 'width:150px;', combo: typeValues },
                ],
                name: this.getName(),
            }
            return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
        },

        getConfigData: function () {
            return {
                color: this.color,
                type: this.type,
            }
        },

        setConfigData: function (data) {
            this.color = data.color
            this.type = data.type
        },

        saveConfigData: function () {
            var cfg = {
                foo: this.foo,
                pixels: this.pixels,
                color: this.color,
                type: this.type,
            }
            return cfg
        },

        loadConfigData: function (data) {
            this.foo = data.foo
            this.pixels = data.pixels
            this.color = data.color
            this.type = data.type
            temperatureColorMap = createTemperatureMap(this.color)
        },


        renderColors: function (inputColors) {
            var numLeds = this.numLeds
            console.log(audioData)
            audio = audioData.slice(0, numLeds)
            if (Math.random() * 10 | 0 == 0) {
                console.log(audio)
            }
            return audio.map(function(bit) {
                return {r: 128 + ( (bit | 0) * 128 ) | 0, g: 0, b: 0}
            })
            
        },

    }
    self.init()
    return self
}
