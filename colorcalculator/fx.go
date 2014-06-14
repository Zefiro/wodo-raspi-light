package colorcalculator

import (
	"fmt"
	"math/rand"
	"bytes"
	"strings"
	"time"
	"net/http"
	"strconv"
)

const (
	Numleds = 100
	// in Hz
	UpdateFrequency = 20
	Led_maxColor    = 255
)

// ----------------------------------------------------------------------------------------------------
func min(a, b int) int {
	if (a < b) { return a }
	return b
}
func max(a, b int) int {
	if (a > b) { return a }
	return b
}
// ----------------------------------------------------------------------------------------------------
type RGB struct {
	Red   int
	Green int
	Blue  int
}

func (this *RGB) BlendWith(other RGB) {
	this.Red = max(this.Red, other.Red)
	this.Green = max(this.Green, other.Green)
	this.Blue = max(this.Blue, other.Blue)
}
// ----------------------------------------------------------------------------------------------------
type LedStrip [Numleds]RGB

func ToJSON(leds LedStrip) string {
	var buffer bytes.Buffer
	buffer.WriteString("{\"c\": [")
	for i,led := range leds {
		if i > 0 {
		buffer.WriteString(",")
		}
		buffer.WriteString(fmt.Sprintf("\"#%02X%02X%02X\"", led.Red, led.Green, led.Blue))
	}
	buffer.WriteString("]}")
	return buffer.String()
}

type ColorCalculator interface {
	CalculateColors(Leds LedStrip) LedStrip
	printState() string
	WriteConfigHtml(formId string) string
	ParseConfigHtml(formId string, request *http.Request) string
}

// ----------------------------------------------------------------------------------------------------
type ColorGradient struct {
	colors []RGBt
	minPos int
	maxPos int
}

type RGBt struct {
	RGB
	startPos int
}

func NewColorGradient() *ColorGradient {
	this := &ColorGradient{}
	return this
}

func (this *ColorGradient) Add(col RGBt) {
	this.colors = append(this.colors, col)
	// recalculate min/max positions
	this.minPos = this.colors[0].startPos
	this.maxPos = this.colors[0].startPos
	for _, curCol := range this.colors {
		this.minPos = min(this.minPos, curCol.startPos)
		this.maxPos = max(this.maxPos, curCol.startPos)
	}
}

func (this *ColorGradient) GetColor(position int) RGB {
	if len(this.colors) == 0 {
		return RGB{0,0,0}
	}
	if len(this.colors) == 1 {
		return RGB{this.colors[0].RGB.Red, this.colors[0].RGB.Green, this.colors[0].RGB.Blue}
	}

	if position < this.minPos {
		// underflow
		position = this.minPos
	}	
	if position > this.maxPos {
		// overflow
		position = this.maxPos
	}	

	startCol := this.colors[0]
	endCol := this.colors[0]
	for _, curCol := range this.colors {
		if position == curCol.startPos {
			return RGB{curCol.RGB.Red, curCol.RGB.Green, curCol.RGB.Blue}
		}
		if position > curCol.startPos && (position - curCol.startPos < position - startCol.startPos || position < startCol.startPos) {
			startCol = curCol
		}
		if position < curCol.startPos && (curCol.startPos - position < endCol.startPos - position || position >= endCol.startPos) {
			endCol = curCol
		}
	}
	percentage := float32(position - startCol.startPos) / float32(endCol.startPos - startCol.startPos)
	red := int(float32(startCol.RGB.Red) * (1 - percentage) + float32(endCol.RGB.Red) * percentage)
	green := int(float32(startCol.RGB.Green) * (1 - percentage) + float32(endCol.RGB.Green) * percentage)
	blue := int(float32(startCol.RGB.Blue) * (1 - percentage) + float32(endCol.RGB.Blue) * percentage)
	col := RGB{red, green, blue}

//fmt.Printf("Col(%d): %d<X<%d, %f%% RGB(%d,%d,%d) --", position, startCol.startPos, endCol.startPos, percentage, col.Red, col.Green, col.Blue)
	return col
}

// ----------------------------------------------------------------------------------------------------
type SfxBase struct {
	startIdx int
	endIdx   int
}

func NewSfxBase(startIdx, endIdx int) *SfxBase {
	this := &SfxBase{startIdx: startIdx, endIdx: endIdx}
	return this
}

// ----------------------------------------------------------------------------------------------------
type SfxGroup struct {
	SfxBase
	sfxList []ColorCalculator
}

func NewSfxGroup() *SfxGroup {
	this := &SfxGroup{}
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
	return this
}

func (this *SfxGroup) AddSfx(sfx ColorCalculator) {
	this.sfxList = append(this.sfxList, sfx)
}

func (this *SfxGroup) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"group\",\"name\":\"Effect group\",\"desc\":\"some witty desc\",\"sfxList\":[")
	for idx, sfx := range this.sfxList {
		if idx > 0 {
			buffer.WriteString(",")
		}
		groupFormId := fmt.Sprintf("%s_%d", formId, idx)
		buffer.WriteString(sfx.WriteConfigHtml(groupFormId))
	}
	buffer.WriteString("]}")

	return buffer.String()
}

func (this *SfxGroup) ParseConfigHtml(formId string, request *http.Request) string {
	fmt.Printf("parseconfig SfxGroup[%s]...\n", formId)
	for idx, sfx := range this.sfxList {
		groupFormId := fmt.Sprintf("%s_%d", formId, idx)
		sfx.ParseConfigHtml(groupFormId, request)
	}
	return this.WriteConfigHtml(formId)
}

func (this *SfxGroup) CalculateColors(leds LedStrip) LedStrip {
	for _, sfx := range this.sfxList {
		leds = sfx.CalculateColors(leds)
	}
	return leds
}

func (this *SfxGroup) printState() string {
	return fmt.Sprintf("Color Group TODO")
}

// ----------------------------------------------------------------------------------------------------
type SfxFire struct {
	SfxBase
	lastNow int64
	sparks []spark
	fireColors *ColorGradient
	// TODO currently depending on update frequency
	newSparkProbability int
}

type spark struct {
	pos int
	size int
	strength int
	ttl int
}

func NewSfxFire() *SfxFire {
	this := &SfxFire{}
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
	this.newSparkProbability = 1
	this.initialize()
	return this
}

func (this *SfxFire) initialize() {
	this.lastNow = time.Now().UnixNano()
	this.fireColors = NewColorGradient()
	this.fireColors.Add(RGBt{RGB{  0,   0,   0},    0})
	this.fireColors.Add(RGBt{RGB{100,   0,   0},  100})
	this.fireColors.Add(RGBt{RGB{200,  30,  30},  500})
	this.fireColors.Add(RGBt{RGB{200, 200,  50},  800})
	this.fireColors.Add(RGBt{RGB{ 50,  50, 200},  900})
	this.fireColors.Add(RGBt{RGB{255, 255, 255}, 1000})
}

func (this *SfxFire) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"fx\",\"name\":\"Fire effect\",\"desc\":\"\",\"config\":[")
	buffer.WriteString(fmt.Sprintf("{\"type\":\"combo\",\"id\":\"IDENTIFIER_newSpark\",\"text\":\"%% new sparks:\",\"options\":[{\"text\":\"none\",\"value\":0},{\"text\":\"many\",\"value\":50},{\"text\":\"medium\",\"value\":10},{\"text\":\"Custom\",\"type\":\"input\"}],\"value\":%d}", this.newSparkProbability))
	buffer.WriteString(fmt.Sprintf(",{\"type\":\"bool\",\"id\":\"IDENTIFIER_restart\",\"text\":\"restart fire\",\"value\":%t}", false))
	buffer.WriteString("]}")

	return strings.Replace(buffer.String(), "IDENTIFIER", fmt.Sprintf("conf_%s_fire", formId), -1)
}

func (this *SfxFire) ParseConfigHtml(formId string, request *http.Request) string {
	baseKey := fmt.Sprintf("conf_%s_fire_", formId)
	strSpark := request.FormValue(baseKey + "newSpark")
	intSpark, err := strconv.Atoi(strSpark)
	if err != nil {
		// TODO
	}
	this.newSparkProbability = intSpark

	restart := request.FormValue(baseKey + "restart") != ""
	if restart {
		this.sparks = []spark{}
	}
	fmt.Printf("parseconfig SfxFire[%s]: restart=%t\n", formId, restart)
	this.initialize()
	return this.WriteConfigHtml(formId)
}

func (this *SfxFire) CalculateColors(leds LedStrip) LedStrip {
	now := time.Now().UnixNano()
	ms := int((now - this.lastNow) / int64(time.Millisecond))
	this.lastNow = now

	if rand.Intn(100) < this.newSparkProbability {
		// create new spark
		spark := spark{}
		spark.pos = rand.Intn(this.SfxBase.endIdx - this.SfxBase.startIdx)
		spark.size = rand.Intn(4) + 1
		spark.strength = rand.Intn(1000)
		spark.ttl = rand.Intn(5000)
		this.sparks = append(this.sparks, spark)
	}

	for idx := len(this.sparks)-1; idx >= 0; idx-- {
		spark := &this.sparks[idx]
		for i := -spark.size/2; i < spark.size/2; i++ {
			ledIdx := this.SfxBase.startIdx + spark.pos + i
			if ledIdx >= this.SfxBase.startIdx && ledIdx <= this.SfxBase.endIdx {
				strength := spark.strength * min(spark.ttl/10, 100) / 100
				leds[ledIdx].BlendWith(this.fireColors.GetColor(strength))
			}
		}
		spark.ttl -= ms
		if spark.ttl <= 0 {
			this.sparks = append(this.sparks[:idx], this.sparks[idx+1:]...)
		}
	}

	return leds
}

func (this *SfxFire) printState() string {
	return fmt.Sprintf("%d", 0)
}

// ----------------------------------------------------------------------------------------------------
type SfxColor struct {
	SfxBase
	color RGB
}

func NewSfxColor(color RGB) *SfxColor {
	this := &SfxColor{}
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
	this.color = color
	this.initialize()
	return this
}

func (this *SfxColor) initialize() {
}

func (this *SfxColor) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"fx\",\"name\":\"Solid Color\",\"desc\":\"\",\"config\":[")
	buffer.WriteString(fmt.Sprintf("{\"type\":\"combo\",\"id\":\"IDENTIFIER_col\",\"text\":\"Color:\",\"options\":[{\"text\":\"Red\",\"value\":\"#FF0000\"},{\"text\":\"Green\",\"value\":\"#00FF00\"},{\"text\":\"Blue\",\"value\":\"#0000FF\"},{\"text\":\"Yellow\",\"value\":\"#FFFF00\"},{\"text\":\"Turquois\",\"value\":\"#00FFFF\"},{\"text\":\"Purple\",\"value\":\"#FF00FF\"},{\"text\":\"White\",\"value\":\"#FFFFFF\"},{\"text\":\"Black\",\"value\":\"#000000\"},{\"text\":\"Custom\",\"type\":\"input\"}],\"value\":\"#%02X%02X%02X\"}", this.color.Red, this.color.Green, this.color.Blue))
	buffer.WriteString("]}")

	return strings.Replace(buffer.String(), "IDENTIFIER", fmt.Sprintf("conf_%s_color", formId), -1)
}

func (this *SfxColor) ParseConfigHtml(formId string, request *http.Request) string {
	baseKey := fmt.Sprintf("conf_%s_color_", formId)
	strColor := request.FormValue(baseKey + "col")
	if strings.HasPrefix(strColor, "#") {
		strColor = strColor[1:]
	}
	if len(strColor) < 6 {
		strColor += "000000"
	}
	red, err := strconv.ParseInt(strColor[0:2], 16, 0)
	if err != nil {
		// TODO
	}
	green, err := strconv.ParseInt(strColor[2:4], 16, 0)
	if err != nil {
		// TODO
	}
	blue, err := strconv.ParseInt(strColor[4:6], 16, 0)
	if err != nil {
		// TODO
	}
	this.color = RGB{int(red), int(green), int(blue)}
	return this.WriteConfigHtml(formId)
}

func (this *SfxColor) CalculateColors(leds LedStrip) LedStrip {
	for idx := 0; idx <= this.endIdx-this.startIdx; idx++ {
		ledIdx := this.startIdx + idx
		leds[ledIdx] = this.color
	}
	return leds
}

func (this *SfxColor) printState() string {
	return fmt.Sprintf("Solid Color #%x%x%x", this.color.Red, this.color.Green, this.color.Blue)
}

// ----------------------------------------------------------------------------------------------------
type SfxBlend struct {
	SfxBase
	sourceA ColorCalculator
	sourceB ColorCalculator
	mask ColorCalculator
}

func NewSfxBlend() *SfxBlend {
	this := &SfxBlend{}
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
	this.sourceA = nil
	this.sourceB = NewSfxColor(RGB{0,128,0})
	this.mask = NewSfxColor(RGB{192,192,192})
	this.initialize()
	return this
}

func (this *SfxBlend) initialize() {
}

func (this *SfxBlend) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"fx\",\"name\":\"Blend\",\"desc\":\"Blends between input sources\",\"config\":[")
	buffer.WriteString("{\"type\":\"fx\",\"text\":\"Source B\",\"fx\":")
	buffer.WriteString(this.sourceB.WriteConfigHtml(formId + "_B"))
	buffer.WriteString("}")
	buffer.WriteString(",{\"type\":\"fx\",\"text\":\"Blendmask\",\"fx\":")
	buffer.WriteString(this.mask.WriteConfigHtml(formId + "_m"))
	buffer.WriteString("}")
	buffer.WriteString("]}")

	return buffer.String()
}

func (this *SfxBlend) ParseConfigHtml(formId string, request *http.Request) string {
	fmt.Printf("parseconfig SfxBlend[%s]...\n", formId)
	this.sourceB.ParseConfigHtml(formId + "_B", request)
	this.mask.ParseConfigHtml(formId + "_m", request)
	return this.WriteConfigHtml(formId)
}

func (this *SfxBlend) CalculateColors(leds LedStrip) LedStrip {
	ledsA := leds
	ledsB := leds
	mask := leds
	if this.sourceA != nil {
		ledsA = this.sourceA.CalculateColors(ledsA)
	}
	if this.sourceB != nil {
		ledsB = this.sourceB.CalculateColors(ledsB)
	}
	if this.mask != nil {
		mask = this.mask.CalculateColors(mask)
	}
	for idx := 0; idx <= this.endIdx-this.startIdx; idx++ {
		ledIdx := this.startIdx + idx
		leds[ledIdx].Red = ledsA[ledIdx].Red * (255 - mask[ledIdx].Red) / 255 + ledsB[ledIdx].Red * mask[ledIdx].Red / 255
		leds[ledIdx].Green = ledsA[ledIdx].Green * (255 - mask[ledIdx].Green) / 255 + ledsB[ledIdx].Green * mask[ledIdx].Green / 255
		leds[ledIdx].Blue = ledsA[ledIdx].Blue * (255 - mask[ledIdx].Blue) / 255 + ledsB[ledIdx].Blue * mask[ledIdx].Blue / 255
	}
	return leds
}

func (this *SfxBlend) printState() string {
	return fmt.Sprintf("Blend")
}

// ----------------------------------------------------------------------------------------------------
type SfxGradient struct {
	SfxBase
	lastNow int64
	colors *ColorGradient
}

func NewSfxGradient() *SfxGradient {
	this := &SfxGradient{}
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
	this.initialize()
	return this
}

func (this *SfxGradient) initialize() {
	this.lastNow = time.Now().UnixNano()
	this.colors = NewColorGradient()
	this.colors.Add(RGBt{RGB{200,   0,   0},   10})
	this.colors.Add(RGBt{RGB{200, 200,   0},   30})
	this.colors.Add(RGBt{RGB{  0, 200,   0},   50})
	this.colors.Add(RGBt{RGB{  0, 200, 200},   70})
	this.colors.Add(RGBt{RGB{  0,   0, 200},   90})
}

func (this *SfxGradient) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"fx\",\"name\":\"Color Gradient\",\"desc\":\"\",\"config\":[")
	buffer.WriteString(fmt.Sprintf("{\"type\":\"bool\",\"id\":\"IDENTIFIER_restart\",\"text\":\"restart fire\",\"value\":%t}", false))
	buffer.WriteString("]}")

	return strings.Replace(buffer.String(), "IDENTIFIER", fmt.Sprintf("conf_%s_gradient", formId), -1)
}

func (this *SfxGradient) ParseConfigHtml(formId string, request *http.Request) string {
	baseKey := fmt.Sprintf("conf_%s_gradient_", formId)
	restart := request.FormValue(baseKey + "restart") != ""
	if restart {
	}
	fmt.Printf("parseconfig SfxGradient[%s]: restart=%t\n", formId, restart)
	this.initialize()
	return this.WriteConfigHtml(formId)
}

func (this *SfxGradient) CalculateColors(leds LedStrip) LedStrip {
	now := time.Now().UnixNano()
	ms := int((this.lastNow - now) / int64(time.Millisecond))
	this.lastNow = now
_ = ms
	for idx := 0; idx <= this.endIdx-this.startIdx; idx++ {
		ledIdx := this.startIdx + idx
		col := this.colors.GetColor(idx)
		leds[ledIdx] = col
	}

	return leds
}

func (this *SfxGradient) printState() string {
	return fmt.Sprintf("TODO")
}

// ----------------------------------------------------------------------------------------------------
type SfxSegments struct {
	SfxBase
	columns int
	lines []SfxSegmentLines
}

type SfxSegmentLines struct {
	delay int
	mode int
	lines []RGB
}

func NewSfxSegments() *SfxSegments {
	this := &SfxSegments{}
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
//	this.lines = make([]SfxSegmentLines)
	this.initialize()
	return this
}

func (this *SfxSegments) initialize() {
}

func (this *SfxSegments) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"fx\",\"name\":\"Segments\",\"desc\":\"Effect inspired by Pum\",\"config\":[")
// TODO...
	buffer.WriteString(fmt.Sprintf("{\"type\":\"bool\",\"id\":\"IDENTIFIER_restart\",\"text\":\"restart fire\",\"value\":%t}", false))
	buffer.WriteString("]}")

	return strings.Replace(buffer.String(), "IDENTIFIER", fmt.Sprintf("cfg_%s_seg", formId), -1)
}

func (this *SfxSegments) ParseConfigHtml(formId string, request *http.Request) string {
	baseKey := fmt.Sprintf("cfg_%s_seg_", formId)
	restart := request.FormValue(baseKey + "restart") != ""
	if restart {
	}
	fmt.Printf("parseconfig SfxGradient[%s]: restart=%t\n", formId, restart)
	this.initialize()
	return this.WriteConfigHtml(formId)
}

func (this *SfxSegments) CalculateColors(leds LedStrip) LedStrip {
/*
	for idx := 0; idx <= this.endIdx-this.startIdx; idx++ {
		ledIdx := this.startIdx + idx
		col := this.colors.GetColor(idx)
		leds[ledIdx] = col
	}
*/
	return leds
}

func (this *SfxSegments) printState() string {
	return fmt.Sprintf("TODO")
}

// ----------------------------------------------------------------------------------------------------
type SfxLinear struct {
	SfxBase
        // input: speed
        iSpeed        int
        // 
	iLength       int
        // current sub-state, 0..Led_maxColor-1
	dimm          float32
        // increment to dimm in each takt
	speed         float32
        // 
	delay         float32
        // current state, 0=fade from black, 1-12=fading, 13=fade to black (used for reverse colors with speed < 0)
	// TODO I removed color reversing, thus state=13 is obsolete now?
	state         int
        // 
	preStartDelay int
	flags         struct {
        	// input: direction starting from left or right
		startFromLeft bool
	        // input: whether to initially start fading from black
		fadeFromBlack bool
	}
}

func NewSfxLinear(speed int, length int) *SfxLinear {
	this := &SfxLinear{iSpeed: speed, iLength: length}
	this.flags.fadeFromBlack = true
	this.flags.startFromLeft = false
	this.SfxBase.startIdx = 0
	this.SfxBase.endIdx = Numleds - 1
	this.initialize()
	return this
}

func (this *SfxLinear) initialize() {
	this.dimm = 0
	this.state = 0
	this.delay = 0
	var tmp float32 = float32((Led_maxColor+1)*12*100) / float32(this.iSpeed)
	this.speed = tmp / float32(UpdateFrequency)
	if this.iLength != 0 {
		this.delay = float32((Led_maxColor+1)*12) / float32(this.iLength)
	}
	if this.flags.fadeFromBlack {
		this.state = 0
		this.preStartDelay = 0
	} else {
		this.state = 1
		this.preStartDelay = 9999
	}
}

func (this *SfxLinear) WriteConfigHtml(formId string) string {
	var buffer bytes.Buffer

	buffer.WriteString("{\"type\":\"fx\",\"name\":\"Linear Moodlight\",\"desc\":\"\",\"config\":[")
	buffer.WriteString(fmt.Sprintf("{\"type\":\"bool\",\"id\":\"IDENTIFIER_black\",\"text\":\"start with fading from black\",\"value\":%t}", this.flags.fadeFromBlack))
	buffer.WriteString(fmt.Sprintf(",{\"type\":\"select\",\"id\":\"IDENTIFIER_left\",\"text\":\"Direction:\",\"options\":[{\"text\":\"from left\",\"value\":true},{\"text\":\"from right\",\"value\":false}],\"value\":%t}", this.flags.startFromLeft))
	buffer.WriteString(fmt.Sprintf(",{\"type\":\"combo\",\"id\":\"IDENTIFIER_speed\",\"text\":\"Speed:\",\"options\":[{\"text\":\"too fast\",\"value\":100},{\"text\":\"fast\",\"value\":600},{\"text\":\"medium\",\"value\":2000},{\"text\":\"slow\",\"value\":6000},{\"text\":\"very slow\",\"value\":60000},{\"text\":\"ultra slow\",\"value\":60000},{\"text\":\"Custom\",\"type\":\"input\"}],\"value\":%d}", this.iSpeed))
	buffer.WriteString(fmt.Sprintf(",{\"type\":\"combo\",\"id\":\"IDENTIFIER_length\",\"text\":\"Length:\",\"options\":[{\"text\":\"very short\",\"value\":6},{\"text\":\"short\",\"value\":16},{\"text\":\"rather short\",\"value\":24},{\"text\":\"medium\",\"value\":64},{\"text\":\"long\",\"value\":128},{\"text\":\"very long\",\"value\":256},{\"text\":\"ultra long\",\"value\":512},{\"text\":\"Synchronous\",\"value\":0},{\"text\":\"Custom\",\"type\":\"input\"}],\"value\":%d}", this.iLength))
	buffer.WriteString("]}")

	return strings.Replace(buffer.String(), "IDENTIFIER", fmt.Sprintf("conf_%s_lin", formId), -1)
}

func (this *SfxLinear) ParseConfigHtml(formId string, request *http.Request) string {
	baseKey := fmt.Sprintf("conf_%s_lin_", formId)
	strSpeed := request.FormValue(baseKey + "speed")
	intSpeed, err := strconv.Atoi(strSpeed)
	if err != nil {
		// TODO
	}
	this.iSpeed = intSpeed
	strLength := request.FormValue(baseKey + "length")
	intLength, err := strconv.Atoi(strLength)
	if err != nil {
		// TODO
	}
	this.iLength = intLength
	this.flags.startFromLeft = request.FormValue(baseKey + "left") == "true"
	this.flags.fadeFromBlack = request.FormValue(baseKey + "black") != ""
	fmt.Printf("parseconfig SfxLinear[%s]: black=%t, left=%t, speed=%d, length=%d\n", formId, this.flags.fadeFromBlack, this.flags.startFromLeft, this.iSpeed, this.iLength)
	this.initialize()
	return this.WriteConfigHtml(formId)
}

func (this *SfxLinear) CalculateColors(leds LedStrip) LedStrip {
	// animate
	this.dimm += this.speed
	for this.dimm >= Led_maxColor+1 {
		this.dimm -= Led_maxColor + 1
		this.state++
		if this.state > 12 {
			this.state = 1
			if this.preStartDelay < 9999 {
				this.preStartDelay++
			}
		}
	}

	// iterate through all LEDs
	var stateLocal int = this.state
	var dimmLocal float32 = this.dimm
	var preStartDelayLocal = this.preStartDelay
	for idx := 0; idx <= this.endIdx-this.startIdx; idx++ {
		ledIdx := this.startIdx + idx
		if this.flags.startFromLeft {
			ledIdx = this.endIdx - idx
		}
		dimmLocal -= this.delay
		for dimmLocal < 0 {
			dimmLocal += Led_maxColor + 1
			stateLocal--
			if stateLocal < 1 {
				if preStartDelayLocal > 0 {
					preStartDelayLocal--
					stateLocal = 12
				}
			}

		}

		var dimm int = int(dimmLocal)
		var red, green, blue int
		switch stateLocal {
		case 0: // fade from black (startup)
			red = 0
			green = dimm
			blue = 0
		case 1:
			red = 0
			green = Led_maxColor
			blue = 0
		case 2:
			red = dimm
			green = Led_maxColor
			blue = 0
		case 3:
			red = Led_maxColor
			green = Led_maxColor
			blue = 0
		case 4:
			red = Led_maxColor
			green = Led_maxColor - dimm
			blue = 0
		case 5:
			red = Led_maxColor
			green = 0
			blue = 0
		case 6:
			red = Led_maxColor
			green = 0
			blue = dimm
		case 7:
			red = Led_maxColor
			green = 0
			blue = Led_maxColor
		case 8:
			red = Led_maxColor - dimm
			green = 0
			blue = Led_maxColor
		case 9:
			red = 0
			green = 0
			blue = Led_maxColor
		case 10:
			red = 0
			green = dimm
			blue = Led_maxColor
		case 11:
			red = 0
			green = Led_maxColor
			blue = Led_maxColor
		case 12:
			red = 0
			green = Led_maxColor
			blue = Led_maxColor - dimm
		default:
			// relevant for startup, could by anything below or above allowed range
			red = 0
			green = 0
			blue = 0
		}
		leds[ledIdx].Red = red
		leds[ledIdx].Green = green
		leds[ledIdx].Blue = blue
	}
	return leds
}

func (this *SfxLinear) printState() string {
	return fmt.Sprintf("dimm: %6.2f, state: %2d", this.dimm, this.state)
}

// ----------------------------------------------------------------------------------------------------
type SfxMask struct {
	*SfxBase
	maskType        int
	state           float32
	speed           float32
	currentStartIdx int
	currentEndIdx   int
	internalSfx     ColorCalculator
}

func NewSfxMask(speed int, content ColorCalculator) *SfxMask {
	this := &SfxMask{internalSfx: content, state: 0, maskType: 1}
	this.SfxBase = NewSfxBase(0, Numleds-1)
	this.currentStartIdx = this.startIdx
	this.currentEndIdx = this.startIdx
	var tmp float32 = float32(12*100) / float32(speed)
	this.speed = tmp / float32(UpdateFrequency)
	return this
}

func (this *SfxMask) CalculateColors(leds LedStrip) LedStrip {
	this.state += this.speed
	switch this.maskType {
	case 0:
	case 1:
		if this.currentEndIdx < this.endIdx {
			this.currentEndIdx = int(this.state)
		}
	}
	if this.currentEndIdx > this.endIdx {
		this.currentEndIdx = this.endIdx
	}

	var ledMasked = this.internalSfx.CalculateColors(leds)
	for i := this.currentStartIdx; i <= this.currentEndIdx; i++ {
		leds[i] = ledMasked[i]
	}
	return leds
}

func (this *SfxMask) printState() string {
	return fmt.Sprintf("%1.2f: %d-%d", this.state, this.currentStartIdx, this.currentEndIdx)
}

